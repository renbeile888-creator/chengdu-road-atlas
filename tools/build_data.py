# -*- coding: utf-8 -*-
"""合并目的地与天气数据，输出前端可直接 <script> 引入的 dataset.js。
费用口径面向纯电车：按电耗 × 电价估算电费，并给出单程建议补电次数。
"""
import json, math, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from destinations import DEST, CATS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CD = (30.5728, 104.0668)  # 成都天府广场

# 纯电车费用口径（面向标称续航 500—600 km / CLTC 的车型）
KWH_PER_100KM = 18.0       # 高速 + 山路 + 空调综合电耗；CLTC 约 14—16，长途取 18
YUAN_PER_KWH = 1.20        # 高速服务区快充含服务费均价；家充谷电约 0.3—0.6
ENERGY_PER_KM = KWH_PER_100KM / 100 * YUAN_PER_KWH  # 0.216 元/公里，约 0.22
USABLE_RANGE_KM = 380      # 标称 500—600 km 按约七折折算后的高速/高原可用续航


def bearing(lat, lon):
    p1, p2 = math.radians(CD[0]), math.radians(lat)
    dl = math.radians(lon - CD[1])
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def trip_bucket(km):
    if km <= 300:
        return {"key": "weekend", "name": "周末可达", "hint": "1—2 天"}
    if km <= 800:
        return {"key": "short", "name": "小长假", "hint": "3—5 天"}
    if km <= 1500:
        return {"key": "mid", "name": "长假远征", "hint": "5—7 天"}
    return {"key": "long", "name": "深度长线", "hint": "7 天以上"}


_raw = json.load(open(os.path.join(ROOT, "data", "weather.json"), encoding="utf-8"))
if isinstance(_raw, dict) and "points" in _raw:
    weather = _raw.get("points") or {}
    WEATHER_META = _raw.get("_meta") or {}
else:  # 兼容旧版纯 {id: [...]} 结构
    weather = {k: v for k, v in _raw.items() if isinstance(v, list)}
    WEATHER_META = {"updated_date": "", "source": "meteoblue", "legacy": True}

_updated = (WEATHER_META.get("updated_date") or "").strip()


def future_only(rows):
    """丢弃早于抓取当天的格子。

    meteoblue 按 UTC 排期，凌晨抓取时部分坐标点会多给一天昨天；这些格子在前端只能置灰，
    还会让表头多出一整列过去日期。这里统一裁掉，保证每行车都从抓取当天开始。
    """
    if not _updated:
        return rows
    return [r for r in rows if (r.get("date") or "") >= _updated]


out = []
for d in DEST:
    item = dict(d)
    item["energy"] = int(round(d["km"] * ENERGY_PER_KM))  # 电费，取整到元
    # 出发满电；按高速可用续航折算，单程中途需要补电的次数
    item["chargeStops"] = max(0, math.ceil(d["km"] / USABLE_RANGE_KM) - 1)
    item["bearing"] = round(bearing(d["lat"], d["lon"]), 1)
    item["trip"] = trip_bucket(d["km"])
    item["cost"] = d["toll"] + item["energy"]
    item["weather"] = future_only(weather.get(d["id"]) or [])
    out.append(item)

out.sort(key=lambda x: (x["cat"], x["km"]))

# forecast_start 以裁剪后的实际首日为准，避免 meta 里残留昨天让前端回退到旧日期
meta_out = dict(WEATHER_META)
starts = sorted({x["weather"][0]["date"] for x in out if x["weather"] and x["weather"][0].get("date")})
if starts:
    meta_out["forecast_start"] = starts[0]

js = ("window.WEATHER_META=%s;\nwindow.CATEGORIES=%s;\nwindow.DESTINATIONS=%s;\n") % (
    json.dumps(meta_out, ensure_ascii=False, separators=(",", ":")),
    json.dumps(CATS, ensure_ascii=False, separators=(",", ":")),
    json.dumps(out, ensure_ascii=False, separators=(",", ":")),
)
open(os.path.join(ROOT, "data", "dataset.js"), "w", encoding="utf-8").write(js)

if not os.environ.get("CD_QUIET"):
    print("destinations:", len(out), "| size:", len(js), "bytes")
    print("categories:", {c["key"]: sum(1 for x in out if x["cat"] == c["key"]) for c in CATS})
