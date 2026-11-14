# -*- coding: utf-8 -*-
"""
meteoblue 10 日天气预报抓取器（零第三方依赖，只用 Python 标准库）。

为什么不用 requests/bs4：
    这个脚本要在你的 Mac 上被 launchd 每天自动调用，而系统自带的 python3
    默认没有 requests 和 beautifulsoup4。为了让「双击就能跑」成立，
    抓取用 urllib、解析用正则，装不装包都能工作。
    （若环境里恰好有 bs4，update.py 会用它做一次交叉校验。）

公开接口：
    fetch(lat, lon, timeout=30)  -> {"days": [...], "source": "..."}
      days 每项：date / wd / day / night / tmax / tmin / wind / wdir / precip / sun
"""
import gzip
import io
import os
import random
import re
import ssl
import threading
import time
import urllib.request
import urllib.error

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/122.0 Safari/537.36")

WEEK_URL = "https://www.meteoblue.com/en/weather/week/%.3f%s%.3f%s"

# 云端 CI 的出口 IP 更容易撞上 meteoblue 速率限制：CD_MIN_INTERVAL 给所有请求
# 加一个全局最小间隔（本机默认 0，行为不变），429 再单独做长退避。
MIN_INTERVAL = float(os.environ.get("CD_MIN_INTERVAL", "0") or 0)
_rate_lock = threading.Lock()
_last_request = [0.0]


def _throttle():
    if MIN_INTERVAL <= 0:
        return
    with _rate_lock:
        wait = _last_request[0] + MIN_INTERVAL - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        _last_request[0] = time.monotonic()


def url_for(lat, lon):
    ns = "N" if lat >= 0 else "S"
    ew = "E" if lon >= 0 else "W"
    return WEEK_URL % (abs(lat), ns, abs(lon), ew)


def _num(txt):
    m = re.search(r"-?\d+(?:\.\d+)?", txt or "")
    return float(m.group()) if m else None


def _clean(s):
    """去掉 HTML 标签、折叠空白。"""
    s = re.sub(r"<[^>]+>", " ", s or "")
    s = s.replace("&nbsp;", " ").replace("&amp;", "&")
    return re.sub(r"\s+", " ", s).strip()


def http_get(url, timeout=30, retries=4, backoff=1.5):
    """带节流与重试的 GET，返回 str；失败抛最后一次异常。"""
    last = None
    for i in range(retries):
        _throttle()
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": UA,
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept-Encoding": "gzip, identity",
                "Connection": "close",
            })
            ctx = ssl.create_default_context()
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
                raw = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
                return raw.decode("utf-8", "ignore")
        except urllib.error.HTTPError as e:
            last = e
            if i < retries - 1:
                # 429 是速率限制；短退避会让并发线程一起再撞一次限流
                time.sleep((6 + i * 6 + random.random() * 2) if e.code == 429
                           else (backoff + i * 1.2))
        except Exception as e:  # noqa: BLE001
            last = e
            if i < retries - 1:
                time.sleep(backoff + i * 1.2)
    raise last


# --- 正则（针对 meteoblue week 页面的固定结构，比 BS4 快且零依赖） -------------
RE_BLOCK = re.compile(r'<div class="tab-content">')
RE_DATE = re.compile(r'<time[^>]*datetime="(\d{4}-\d{2}-\d{2})"')
RE_WD = re.compile(r'tab-day-short">\s*([A-Za-z]{3})')
RE_DAY_ICON = re.compile(
    r'weather-pictogram-wrapper day\s*"[^>]*>\s*<img[^>]*?title="([^"]*)"', re.S)
RE_NIGHT_ICON = re.compile(
    r'weather-pictogram-wrapper-second night\s*"[^>]*>\s*<img[^>]*?title="([^"]*)"', re.S)
RE_TMAX = re.compile(r'tab-temp-max"[^>]*>\s*(-?\d+(?:\.\d+)?)')
RE_TMIN = re.compile(r'tab-temp-min"[^>]*>\s*(-?\d+(?:\.\d+)?)')
RE_WIND = re.compile(r'class="wind"[^>]*>(.*?)</div>', re.S)
RE_WDIR = re.compile(r'winddir\s+([A-Z]{1,3})')
RE_PRECIP = re.compile(r'tab-precip"[^>]*>(.*?)</div>', re.S)
RE_SUN = re.compile(r'tab-sun"[^>]*>(.*?)</div>', re.S)


def parse(html):
    """把 week 页面 HTML 解析成 10 天列表。"""
    # 每个 tab-content 到 tab-predictability 结束为一个预报块
    chunks = html.split('<div class="tab-content">')[1:]
    days = []
    for raw in chunks:
        seg = raw.split('<div class="tab-predictability"')[0]
        m = RE_DATE.search(seg)
        if not m:
            continue
        date = m.group(1)

        wd = RE_WD.search(seg)
        day_icon = RE_DAY_ICON.search(seg)
        night_icon = RE_NIGHT_ICON.search(seg)

        wind_seg = RE_WIND.search(seg)
        wind_txt = _clean(wind_seg.group(1)) if wind_seg else ""
        # meteoblue 的风速单元格形如 "21-63"（平均—阵风），取前者与历史数据口径一致
        winds = re.findall(r"\d+(?:\.\d+)?", wind_txt)
        wind = float(winds[0]) if winds else None
        wdir = RE_WDIR.search(wind_txt)
        if not wdir and wind_seg:
            wdir = RE_WDIR.search(wind_seg.group(1))

        prec = RE_PRECIP.search(seg)
        prec_txt = _clean(prec.group(1)) if prec else ""
        prec_txt = prec_txt.replace("-", "-").strip() or "-"

        sun = RE_SUN.search(seg)
        sun_txt = _clean(sun.group(1)) if sun else ""
        sun_h = _num(sun_txt)

        days.append({
            "date": date,
            "wd": wd.group(1) if wd else "",
            "day": day_icon.group(1) if day_icon else "",
            "night": night_icon.group(1) if night_icon else "",
            "tmax": float(RE_TMAX.search(seg).group(1)) if RE_TMAX.search(seg) else None,
            "tmin": float(RE_TMIN.search(seg).group(1)) if RE_TMIN.search(seg) else None,
            "wind": wind,
            "wdir": wdir.group(1) if wdir else "",
            "precip": prec_txt,
            "sun": sun_h,
        })
    return days[:10]


def fetch(lat, lon, timeout=30):
    """抓取并解析单个坐标点，返回 dict。失败抛异常。"""
    url = url_for(lat, lon)
    html = http_get(url, timeout=timeout)
    if len(html) < 20000:
        raise RuntimeError("页面过短，可能被拦截（%d bytes）" % len(html))
    days = parse(html)
    if len(days) < 3:
        raise RuntimeError("解析到 %d 天，页面结构可能已变更" % len(days))
    return {"days": days, "source": url}
