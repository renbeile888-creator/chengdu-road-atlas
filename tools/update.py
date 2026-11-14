# -*- coding: utf-8 -*-
"""
每日天气更新编排器 —— 「从成都出发」数据刷新入口。

用法：
    python3 tools/update.py              # 今天没更新过就抓，更新过就跳过
    python3 tools/update.py --force      # 强制重抓
    python3 tools/update.py --check      # 只检查是否过期（0=新鲜 1=过期）
    python3 tools/update.py --only lugu,daocheng   # 只更新指定目的地

设计要点：
  1. 幂等：同一天重复执行不会重复抓取，launchd 每小时跑一次也无所谓。
  2. 安全：抓取失败保留该点旧数据；整体失败率超阈值时直接放弃，
     不覆盖 weather.json（宁可数据旧，也不能数据空）。
  3. 原子写入：先写 .tmp 再 os.replace，中途断电不会留下半个文件。
"""
import argparse
import datetime as dt
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import meteoblue  # noqa: E402
from destinations import DEST  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEATHER = os.path.join(ROOT, "data", "weather.json")
DATASET = os.path.join(ROOT, "data", "dataset.js")
LOG = os.path.join(ROOT, "data", "update.log")

MAX_FAIL_RATE = 0.30   # 超过 30% 的点抓不到就整体放弃
JOBS = 6

C_OK, C_WARN, C_ERR, C_DIM, C_OFF = "\033[32m", "\033[33m", "\033[31m", "\033[2m", "\033[0m"
QUIET = False  # --quiet：只把警告与错误打到终端，完整过程仍写 update.log


def today_str():
    return dt.date.today().isoformat()


def now_str():
    return dt.datetime.now().astimezone().isoformat(timespec="seconds")


def log(msg, color=""):
    line = time.strftime("%H:%M:%S ") + msg
    loud = (not QUIET) or color in (C_WARN, C_ERR)
    if loud:
        print((color + line + C_OFF) if color else line, flush=True)
    try:
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


def rotate_log(max_bytes=300000, keep_lines=400):
    """日志超过 300KB 就只留最后 400 行，避免天天跑把磁盘撑满。"""
    try:
        if os.path.exists(LOG) and os.path.getsize(LOG) > max_bytes:
            lines = open(LOG, encoding="utf-8", errors="ignore").read().splitlines()[-keep_lines:]
            with open(LOG, "w", encoding="utf-8") as f:
                f.write("\n".join(lines) + "\n")
    except OSError:
        pass


def load_weather():
    """读取现有 weather.json，兼容旧版（纯 {id: [...]}）结构。"""
    if not os.path.exists(WEATHER):
        return {"_meta": {}, "points": {}}
    try:
        raw = json.load(open(WEATHER, encoding="utf-8"))
    except (ValueError, OSError):
        return {"_meta": {}, "points": {}}
    if isinstance(raw, dict) and "points" in raw:
        return raw
    # 旧结构升级
    meta = {"updated_date": "", "updated_at": "", "source": "meteoblue", "legacy": True}
    return {"_meta": meta, "points": {k: v for k, v in raw.items() if isinstance(v, list)}}


def atomic_write_json(path, obj):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def is_fresh(store):
    """今天已经抓过，且每个点都有 >= 8 天数据。"""
    meta = store.get("_meta") or {}
    if meta.get("updated_date") != today_str():
        return False
    points = store.get("points") or {}
    if not points:
        return False
    return all(len(points.get(d["id"]) or []) >= 8 for d in DEST)


def pick_fail_reason(days, err):
    if err:
        return str(err)[:110]
    return "解析不足"


def fetch_all(targets, force):
    """并发抓取。返回 (points, failures)。"""
    points, fails = {}, {}

    def one(d):
        try:
            res = meteoblue.fetch(d["lat"], d["lon"])
            return d["id"], res["days"], None
        except Exception as e:  # noqa: BLE001
            return d["id"], None, e

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=JOBS) as ex:
        for i, (did, days, err) in enumerate(ex.map(one, targets), 1):
            if days and len(days) >= 8:
                points[did] = days
                first = days[0]
                log("[%2d/%d] %-10s %s  %s %s°/%s°" % (
                    i, len(targets), did, C_OK + "OK" + C_OFF,
                    first["day"][:26].ljust(26),
                    _fmt(first["tmax"]), _fmt(first["tmin"])))
            else:
                fails[did] = pick_fail_reason(days, err)
                log("[%2d/%d] %-10s %s  %s" % (
                    i, len(targets), did, C_ERR + "FAIL" + C_OFF, fails[did]), C_WARN)
    log("抓取完成，用时 %.0f 秒" % (time.time() - t0), C_DIM)
    return points, fails


def _fmt(v):
    if v is None:
        return "?"
    return ("%g" % v)


def rebuild_dataset(store):
    """调用 build_data 重建 dataset.js（该模块 import 时即执行）。"""
    os.environ["CD_QUIET"] = "1" if QUIET else ""
    import build_data  # noqa: F401  内部会读 weather.json 并写 dataset.js
    return build_data


def main():
    global JOBS, QUIET

    ap = argparse.ArgumentParser(description="更新 meteoblue 十日天气与站点数据")
    ap.add_argument("--force", action="store_true", help="忽略当天缓存，强制重抓")
    ap.add_argument("--check", action="store_true", help="只检查是否过期")
    ap.add_argument("--only", default="", help="逗号分隔的目的地 id")
    ap.add_argument("--list", action="store_true", help="列出所有目的地 id")
    ap.add_argument("--jobs", type=int, default=JOBS)
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    QUIET = args.quiet
    rotate_log()

    if args.list:
        for d in DEST:
            print("%-12s %-10s %s" % (d["id"], d["cat"], d["name"]))
        return 0

    store = load_weather()
    meta = store.get("_meta") or {}

    if args.check:
        fresh = is_fresh(store)
        days_old = 0
        if meta.get("updated_date"):
            try:
                days_old = (dt.date.today() - dt.date.fromisoformat(meta["updated_date"])).days
            except ValueError:
                days_old = 999
        stale = [d["id"] for d in DEST if len((store.get("points") or {}).get(d["id"]) or []) < 8]
        if not args.quiet:
            print("updated_date: %s (%s 天前)" % (meta.get("updated_date") or "-", days_old))
            print("missing: %d" % len(stale))
            print("FRESH" if fresh else "STALE")
        return 0 if fresh else 1

    if is_fresh(store) and not args.force:
        if not args.quiet:
            log("数据已是今天（%s）的，跳过抓取。" % today_str(), C_DIM)
            log("如需强制刷新：python3 tools/update.py --force", C_DIM)
        return 0

    targets = DEST
    if args.only:
        want = {s.strip() for s in args.only.split(",") if s.strip()}
        known = {d["id"] for d in DEST}
        unknown = sorted(want - known)
        if unknown:
            log("忽略未知 id：%s（用 --list 查看全部）" % ", ".join(unknown), C_WARN)
        targets = [d for d in DEST if d["id"] in want]
        if not targets:
            log("没有匹配的目的地 id：%s" % args.only, C_ERR)
            return 2

    JOBS = max(1, min(12, args.jobs))
    log("开始抓取 meteoblue · %d 个坐标点 · %d 线程" % (len(targets), JOBS))
    points, fails = fetch_all(targets, args.force)

    total = len(targets)
    fail_rate = len(fails) / total if total else 0

    if total and not points:
        log("全部失败，保留原有数据不动。", C_ERR)
        return 1
    if fail_rate > MAX_FAIL_RATE:
        log("失败率 %.0f%% 超过阈值 %.0f%%，放弃本次更新（原数据未改动）。"
            % (fail_rate * 100, MAX_FAIL_RATE * 100), C_ERR)
        return 1

    # 合并：新抓的覆盖旧的，失败的沿用旧数据；顺带清掉已从 DEST 删除的孤立坐标点
    old_points = store.get("points") or {}
    active = {d["id"] for d in DEST}
    dropped = sorted(set(old_points) - active)
    merged = {k: v for k, v in old_points.items() if k in active}
    merged.update(points)
    if dropped:
        log("  清理已删除的 %d 个坐标点：%s" % (len(dropped), ",".join(dropped)), C_DIM)
    for did, why in fails.items():
        old = old_points.get(did)
        if old:
            log("  %s 沿用旧数据（%s）" % (did, why), C_DIM)

    first_dates = sorted({p[0]["date"] for p in points.values() if p})
    full_run = not args.only

    # 局部刷新（--only）不能把 updated_date 推到今天，否则其他点明明还是旧数据，
    # is_fresh() 却会认为整体新鲜，从此不再自动更新。
    if full_run:
        updated_date = today_str()
        updated_at = now_str()
    else:
        updated_date = meta.get("updated_date") or today_str()
        updated_at = meta.get("updated_at") or now_str()

    new_meta = {
        "updated_date": updated_date,
        "updated_at": updated_at,
        "source": "meteoblue.com/en/weather/week",
        "points": len(merged),
        "fetched": len(points),
        "failed": sorted(fails),
        "forecast_start": first_dates[0] if first_dates else (meta.get("forecast_start") or ""),
        "forecast_days": 10,
    }
    if not full_run:
        new_meta["last_partial_at"] = now_str()
        new_meta["last_partial_ids"] = sorted(points)

    store["_meta"] = new_meta
    store["points"] = merged
    atomic_write_json(WEATHER, store)
    log("已写入 weather.json（%d 个点，其中本次新抓 %d 个）" % (len(merged), len(points)), C_OK)
    if not full_run:
        log("局部刷新：整体数据日期保持 %s，下次运行仍会全量补抓。" % updated_date, C_DIM)

    rebuild_dataset(store)
    log("已重建 dataset.js", C_OK)
    if fails:
        log("提示：%d 个点本次未更新，页面会沿用上次数据。" % len(fails), C_WARN)
    return 0


if __name__ == "__main__":
    sys.exit(main())
