/* ============================================================
   从成都出发 · 山海自驾图谱  —  前端逻辑
   ============================================================ */
(function () {
  "use strict";

  const DEST = window.DESTINATIONS || [];
  const CATS = window.CATEGORIES || [];
  const WMETA = window.WEATHER_META || {};
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (n) => Number(n).toLocaleString("en-US");
  // 四路独立散列：让同类目的地的色调/构图/镜像/装饰不会撞车
  const sig = (s) => {
    let a = 0, b = 0, c = 0, e = 0;
    for (let i = 0; i < s.length; i++) {
      const o = s.charCodeAt(i);
      a = (a * 31 + o) % 9973;
      b = (b * 37 + o * 7) % 7919;
      c = (c * 41 + o * 13) % 6833;
      e = (e * 43 + o * 3) % 5779;
    }
    return [a, b, c, e];
  };

  const CAT = {};
  CATS.forEach((c) => (CAT[c.key] = c));

  /* ---------------- 天气词典 ---------------- */
  const WMAP = {
    "Clear, cloudless sky": ["晴", "sun"],
    "Clear and few clouds": ["晴间多云", "partly"],
    "Partly cloudy": ["多云", "partly"],
    "Mostly cloudy": ["阴间多云", "cloud"],
    "Overcast": ["阴", "overcast"],
    "Fog": ["雾", "fog"],
    "Mixed with showers": ["阵雨", "rain"],
    "Mixed with snow showers": ["阵雪", "snow"],
    "Mostly cloudy with a mixture of snow and rain": ["雨夹雪", "snow"],
    "Mostly cloudy with occasional rain": ["多云，局部有雨", "rain"],
    "Mostly cloudy with occasional snow": ["多云，局部有雪", "snow"],
    "Mostly cloudy with rain": ["阴有雨", "rain"],
    "Mostly cloudy with thunderstorms and showers": ["雷阵雨", "storm"],
    "Overcast with occasional rain": ["阴，局部有雨", "rain"],
    "Overcast with occasional snow": ["阴，局部有雪", "snow"],
    "Overcast with rain": ["阴有雨", "rain"],
    "Overcast with snow": ["阴有雪", "snow"],
    "Partly cloudy with a chance of local thunderstorms": ["多云，局地雷雨", "storm"],
    "Partly cloudy with local thunderstorms and showers possible": ["多云，有雷阵雨", "storm"],
    "Showers, thunderstorms likely": ["阵雨伴雷暴", "storm"]
  };
  const wx = (s) => WMAP[s] || [s || "—", "cloud"];

  const ICONS = {
    sun: '<circle cx="12" cy="12" r="4.4" fill="#C08A3E"/><g stroke="#C08A3E" stroke-width="1.5" stroke-linecap="round"><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6"/></g>',
    partly: '<circle cx="9.2" cy="9.4" r="3.4" fill="#C08A3E"/><g stroke="#C08A3E" stroke-width="1.3" stroke-linecap="round"><path d="M9.2 2.8v1.7M3.2 9.4h1.7M4.9 5.1l1.2 1.2M13.5 5.1l-1.2 1.2"/></g><path d="M9 17.6h8.1a3.1 3.1 0 0 0 .3-6.2 4.4 4.4 0 0 0-8.3-.7A3.5 3.5 0 0 0 9 17.6Z" fill="#9AA7AC"/>',
    cloud: '<path d="M7 17.8h9.6a3.4 3.4 0 0 0 .3-6.8 4.9 4.9 0 0 0-9.2-.8A3.9 3.9 0 0 0 7 17.8Z" fill="#9AA7AC"/>',
    overcast: '<path d="M6.6 13.4h8.6a3 3 0 0 0 .2-6 4.4 4.4 0 0 0-8.2-.7 3.5 3.5 0 0 0-.6 6.7Z" fill="#B4BEC2"/><path d="M6 18.2h10.4a3.2 3.2 0 0 0 .3-6.4 4.6 4.6 0 0 0-8.7-.7A3.7 3.7 0 0 0 6 18.2Z" fill="#8D9BA1"/>',
    rain: '<path d="M6.6 13.2h9.2a3.2 3.2 0 0 0 .3-6.4 4.7 4.7 0 0 0-8.8-.8 3.7 3.7 0 0 0-.7 7.2Z" fill="#9AA7AC"/><g stroke="#4B7FA3" stroke-width="1.6" stroke-linecap="round"><path d="M8.4 16l-1 3M12 16l-1 3M15.6 16l-1 3"/></g>',
    storm: '<path d="M6.6 12.8h9.2a3.2 3.2 0 0 0 .3-6.4 4.7 4.7 0 0 0-8.8-.8 3.7 3.7 0 0 0-.7 7.2Z" fill="#8D9BA1"/><path d="M12.6 14.4 9.8 18.6h2.6l-1 3.2 3.6-4.6h-2.4l.9-2.8Z" fill="#D9A227"/>',
    snow: '<path d="M6.6 13h9.2a3.2 3.2 0 0 0 .3-6.4 4.7 4.7 0 0 0-8.8-.8A3.7 3.7 0 0 0 6.6 13Z" fill="#A8B4BA"/><g fill="#7FA5C0"><circle cx="8.4" cy="16.4" r="1.2"/><circle cx="12" cy="18.4" r="1.2"/><circle cx="15.6" cy="16.4" r="1.2"/></g>',
    fog: '<path d="M7.4 12.4h9.2a3.1 3.1 0 0 0 .2-6.2 4.6 4.6 0 0 0-8.6-.6 3.6 3.6 0 0 0-.8 6.8Z" fill="#B4BEC2"/><g stroke="#9AA7AC" stroke-width="1.6" stroke-linecap="round"><path d="M6 15.6h11M7.6 18.6h8.4"/></g>'
  };
  const icon = (kind, cls) => '<svg viewBox="0 0 24 24" class="' + (cls || "") + '" aria-hidden="true">' + (ICONS[kind] || ICONS.cloud) + "</svg>";

  /* ---------------- 场景插画 ----------------
     每张卡片按 id 派生出：2 套色调 × 3 种构图 × 水平镜像 × 4 种装饰开关。
     同类目的地并排时不会看起来像复制粘贴。
  ------------------------------------------ */
  let uid = 0;
  const PAL = {
    lake: [
      { sky: ["#E3EEF4", "#F9FBF7"], far: "#A9C0CB", mid: "#6E8B9B", near: "#3E5F73", sun: "#D98555", water: "#A9C8D8", hi: "#EAF3F6" },
      { sky: ["#E9F1E9", "#FBF9F0"], far: "#A8BEAF", mid: "#628C89", near: "#3A6267", sun: "#E0A86A", water: "#A8CDC9", hi: "#F1F8F4" }
    ],
    snow: [
      { sky: ["#E6EFF5", "#FBFCFA"], far: "#BACBD8", mid: "#8FA6B8", near: "#5B7C9B", sun: "#E0B47C", water: "#F4F8FA", hi: "#FFFFFF" },
      { sky: ["#EAEAF2", "#F9F6F4"], far: "#B9BFCE", mid: "#8B97AE", near: "#54637E", sun: "#D9A47B", water: "#F6F6FA", hi: "#FFFFFF" }
    ],
    sea: [
      { sky: ["#F6EAD6", "#EAF1EA"], far: "#8CB8B6", mid: "#4E9AA0", near: "#2E7A80", sun: "#E0A15E", water: "#4E9AA0", hi: "#FFFFFF" },
      { sky: ["#EAF1F0", "#F8F4E8"], far: "#9CBDB4", mid: "#5B9FA0", near: "#337C82", sun: "#D9885C", water: "#5B9FA0", hi: "#FFFFFF" }
    ],
    grass: [
      { sky: ["#EDF1E2", "#FAF9F0"], far: "#B3C495", mid: "#8AA566", near: "#55702F", sun: "#E8C46A", water: "#CFE0D8", hi: "#FFFFFF" },
      { sky: ["#EAF0E6", "#FBF8ED"], far: "#AFC1A0", mid: "#7E9B62", near: "#4C672F", sun: "#DFB96C", water: "#C9DBD0", hi: "#FFFFFF" }
    ],
    canyon: [
      { sky: ["#F3EBD9", "#FBF5E6"], far: "#C0A578", mid: "#8A6B44", near: "#3C5233", sun: "#D98555", water: "#9FC4CE", hi: "#FBF6E6" },
      { sky: ["#F1E7DC", "#FAF3EA"], far: "#C4A488", mid: "#946B52", near: "#40523A", sun: "#C96B4A", water: "#A9C3C4", hi: "#FCF4EA" }
    ],
    town: [
      { sky: ["#F4E9E0", "#FAF3E9"], far: "#A9B0A6", mid: "#7B4A5C", near: "#5A3947", sun: "#D98555", water: "#EDE4D4", hi: "#B4471F" },
      { sky: ["#EFEDE4", "#F9F6EC"], far: "#AFB2A4", mid: "#6E5566", near: "#4C3F4C", sun: "#D07A4E", water: "#E9E2D3", hi: "#B4471F" }
    ],
    desert: [
      { sky: ["#F9EBCB", "#F7E0BE"], far: "#E2BC82", mid: "#CBA463", near: "#B08226", sun: "#D98555", water: "#EBD6A8", hi: "#F6E4C2" },
      { sky: ["#F7E4CE", "#F3D2AE"], far: "#DDB18A", mid: "#C08A62", near: "#9A6B36", sun: "#C96B49", water: "#E9CDA4", hi: "#F3DCC0" }
    ],
    pet: [
      { sky: ["#F7EADD", "#FBF3E5"], far: "#D6B48D", mid: "#AE875E", near: "#6B7A45", sun: "#D9793F", water: "#C3D6C5", hi: "#FFF2DC" },
      { sky: ["#F1E9D6", "#F9F1E1"], far: "#C7B191", mid: "#9B8060", near: "#5E7040", sun: "#C96B49", water: "#C9D9C2", hi: "#FBEBD0" }
    ],
    hike: [
      { sky: ["#E6EFE8", "#FAF8EF"], far: "#9FBBA6", mid: "#628A72", near: "#2E5B49", sun: "#D9965B", water: "#BFD8CE", hi: "#F7F4E6" },
      { sky: ["#F1EBDC", "#FBF6EA"], far: "#C4B294", mid: "#8E8B5B", near: "#3F5A3E", sun: "#C97A48", water: "#D8D6BC", hi: "#FBF4E2" }
    ],
    climb: [
      { sky: ["#DEE7EF", "#F7FAFB"], far: "#AFBECC", mid: "#7C8EA3", near: "#3E4E63", sun: "#DFA96E", water: "#F1F6F9", hi: "#FFFFFF" },
      { sky: ["#E6E3EC", "#F8F5F3"], far: "#B5B6C5", mid: "#868F9E", near: "#414A5A", sun: "#D99A6C", water: "#F4F5F7", hi: "#FFFFFF" }
    ]
  };

  function sceneFor(d) {
    const cat = d.cat;
    const sets = PAL[cat] || PAL.lake;
    const [a, b, c, e] = sig(d.id);
    const p = sets[(a + e) % 2];   // 色调
    const v = b % 3;               // 构图
    const flip = c % 2 === 1;      // 水平镜像
    const deco = e % 4;            // 装饰开关
    const sx = 46 + (a % 300);
    const sy = 19 + (b % 28);
    const dy = (c % 11) - 5;
    const id = "g" + (++uid);

    const head = '<svg viewBox="0 0 400 132" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + p.sky[0] + '"/><stop offset="1" stop-color="' + p.sky[1] + '"/></linearGradient></defs>' +
      '<rect width="400" height="132" fill="url(#' + id + ')"/>';

    const sun = (big) => '<circle cx="' + sx + '" cy="' + sy + '" r="' + (big ? 15 : 11) + '" fill="' + p.sun + '" opacity=".88"/>' +
      '<circle cx="' + sx + '" cy="' + sy + '" r="' + (big ? 27 : 20) + '" fill="' + p.sun + '" opacity=".1"/>';
    const hill = (pts, fill, op) => '<path d="' + pts + ' L400 132 L0 132Z" fill="' + fill + '" opacity="' + (op == null ? 1 : op) + '"/>';
    const tree = (x, y, h, col) => '<g fill="' + col + '"><path d="M' + x + ' ' + y + ' l' + (h * .42).toFixed(1) + ' -' + h + ' l' + (h * .42).toFixed(1) + ' ' + h + 'Z"/>' +
      '<rect x="' + (x + h * .38).toFixed(1) + '" y="' + y + '" width="1.6" height="' + (h * .2).toFixed(1) + '"/></g>';
    const birds = (x, y, k) => {
      let g = '<g fill="none" stroke="' + p.near + '" stroke-width="1.3" opacity=".5" stroke-linecap="round">';
      for (let i = 0; i < k; i++) {
        const bx = x + i * 16, by = y + (i % 2) * 7;
        g += '<path d="M' + bx + ' ' + by + ' q4 -4 8 0 q4 -4 8 0"/>';
      }
      return g + '</g>';
    };
    const ripples = '<g stroke="' + p.hi + '" stroke-width="1.3" opacity=".55">' +
      '<path d="M28 112h54M104 120h76M212 111h46M286 122h70M64 128h96M240 127h72"/></g>';
    const waves = '<g stroke="' + p.hi + '" stroke-width="1.6" fill="none" opacity=".45">' +
      '<path d="M12 102 Q34 96 56 102 T100 102"/><path d="M120 114 Q142 108 164 114 T208 114"/>' +
      '<path d="M250 98 Q272 92 294 98 T338 98"/><path d="M60 126 Q82 120 104 126 T148 126"/>' +
      '<path d="M300 130 Q322 124 344 130 T388 130"/></g>';

    let inner = "";

    if (cat === "lake") {
      const far = [
        'M0 88 L58 62 L104 82 L166 50 L226 78 L292 56 L352 80 L400 66',
        'M0 92 L70 68 L128 88 L190 58 L250 84 L316 66 L400 88',
        'M0 84 L48 70 L96 86 L150 52 L214 82 L280 60 L340 82 L400 68'
      ][v];
      const near = 'M0 99 L74 78 L132 98 L198 74 L266 96 L338 76 L400 94';
      inner = hill(far, p.far, .62) + hill(near, p.mid, .95) +
        '<rect y="98" width="400" height="34" fill="' + p.water + '"/>' +
        '<path d="' + near + '" fill="none" stroke="' + p.near + '" stroke-width="1.3" opacity=".35"/>' + ripples;
      if (v === 0) {
        inner += '<g fill="' + p.near + '" opacity=".8"><path d="M282 98 l16 -19 l16 19z"/><path d="M304 98 l10 -12 l10 12z"/></g>' +
          '<path d="M288 104 h44" stroke="' + p.hi + '" stroke-width="1.2" opacity=".5"/>';
      } else if (v === 1) {
        inner += '<g stroke="' + p.near + '" stroke-width="1.5" opacity=".7">' +
          '<path d="M42 132 q-3 -22 2 -34M52 132 q2 -26 6 -38M62 132 q-2 -20 2 -30"/></g>' +
          '<g fill="' + p.near + '"><ellipse cx="44" cy="97" rx="2.4" ry="5"/><ellipse cx="59" cy="93" rx="2.4" ry="5"/></g>';
      } else {
        inner += '<path d="M150 118 q26 -8 52 0 l-8 7 h-36z" fill="' + p.near + '" opacity=".75"/>' +
          '<path d="M176 118 v-18 l16 16z" fill="' + p.hi + '" opacity=".85"/>' +
          tree(338, 100, 20, p.near);
      }
      if (deco % 2 === 0) inner += birds(60 + deco * 14, 30 + deco * 4, 3);
    } else if (cat === "snow") {
      const peaks = [
        '<path d="M0 106 L60 52 L124 106Z" fill="' + p.far + '" opacity=".85"/>' +
        '<path d="M96 112 L206 14 L320 112Z" fill="' + p.mid + '"/>' +
        '<path d="M206 14 L240 52 L224 44 L210 60 L194 42 L178 54 L166 44Z" fill="' + p.hi + '"/>' +
        '<path d="M272 112 L336 58 L400 112Z" fill="' + p.far + '"/>',
        '<path d="M0 112 L78 44 L156 112Z" fill="' + p.mid + '"/>' +
        '<path d="M78 44 L108 76 L96 68 L84 82 L70 66 L58 76 L48 68Z" fill="' + p.hi + '"/>' +
        '<path d="M180 112 L268 40 L356 112Z" fill="' + p.far + '"/>' +
        '<path d="M268 40 L294 68 L282 62 L270 74 L258 60 L246 70 L238 62Z" fill="' + p.hi + '" opacity=".9"/>' +
        '<rect y="82" width="400" height="16" fill="' + p.water + '" opacity=".55"/>',
        '<path d="M0 110 L44 76 L88 104 L146 34 L206 100 L260 62 L316 102 L364 70 L400 96Z" fill="' + p.mid + '"/>' +
        '<path d="M146 34 L168 58 L158 52 L148 64 L138 50 L128 58 L120 50Z" fill="' + p.hi + '"/>' +
        '<path d="M260 62 L276 78 L268 72 L260 82 L252 70 L244 78 L238 70Z" fill="' + p.hi + '" opacity=".9"/>'
      ][v];
      inner = '<g transform="translate(0,' + dy + ')">' + peaks + '</g>' +
        '<path d="M0 132 L0 108 Q110 92 216 112 T400 104 L400 132Z" fill="' + p.water + '"/>' +
        '<path d="M0 132 L0 120 Q140 110 260 124 T400 118 L400 132Z" fill="' + p.far + '" opacity=".45"/>';
      const tx = v === 2 ? [30, 70, 340] : [44, 76, 330, 356];
      tx.forEach((x, i) => { inner += tree(x, 124 + (i % 2) * 3, 13 + (i % 3) * 5, p.near); });
      if (deco === 2) inner += '<g fill="' + p.hi + '" opacity=".7"><circle cx="90" cy="22" r="1"/><circle cx="130" cy="34" r="1"/><circle cx="168" cy="18" r="1"/></g>';
    } else if (cat === "climb") {
      // 冰壁 + 路绳 + 结组攀登者：与「雪山」的远峰剪影区分开
      const peakX = 196 + v * 44;
      const pts = [[peakX + 22, 118], [peakX + 38, 94], [peakX + 50, 68], [peakX + 58, 42]];
      const climber = (x, y, s) => '<g fill="' + p.near + '" opacity=".95" transform="translate(' + x + ',' + y + ') scale(' + s + ')">' +
        '<circle cx="0" cy="-9" r="2.6"/>' +
        '<path d="M-2.6 -6 h5.2 l1.5 8.5 h-8.2Z"/>' +
        '<path d="M-2 -2 l-3.2 7.4 h2.8 l2.2 -5.4Z"/>' +
        '<path d="M2 -2 l3.6 7.4 h-3 l-2.6 -5.4Z"/>' +
        '<rect x="-4.6" y="-5.4" width="2.8" height="5" rx=".9"/></g>';
      inner = '<g fill="' + p.hi + '" opacity=".55">' +
        '<ellipse cx="' + (56 + deco * 12) + '" cy="26" rx="30" ry="7"/>' +
        '<ellipse cx="' + (300 - deco * 10) + '" cy="36" rx="22" ry="6"/></g>' +
        hill('M0 94 L62 62 L130 86 L198 48 L268 84 L338 56 L400 82', p.far, .58) +
        '<path d="M' + peakX + ' 132 L' + (peakX + 46) + ' 18 L' + (peakX + 152) + ' 132Z" fill="' + p.mid + '"/>' +
        '<path d="M' + (peakX + 46) + ' 18 L' + (peakX + 70) + ' 52 L' + (peakX + 58) + ' 46 L' +
        (peakX + 46) + ' 62 L' + (peakX + 34) + ' 48 L' + (peakX + 22) + ' 54Z" fill="' + p.hi + '" opacity=".92"/>' +
        '<path d="M' + peakX + ' 132 Q' + (peakX + 34) + ' 74 ' + (peakX + 46) + ' 20" fill="none" stroke="' + p.hi + '" stroke-width="1.4" opacity=".38"/>' +
        '<path d="M' + pts.map((q) => q[0] + " " + q[1]).join(" L") + '" fill="none" stroke="' + p.hi + '" stroke-width="1.6" opacity=".85"/>' +
        hill('M0 132 L0 116 Q118 102 232 120 T400 110 L400 132Z', p.near, .92) +
        climber(pts[3][0], pts[3][1], .8) + climber(pts[2][0], pts[2][1], .92) +
        (v === 2 ? climber(pts[1][0], pts[1][1], 1) : "") +
        '<g fill="' + p.sun + '"><circle cx="' + pts[0][0] + '" cy="' + pts[0][1] + '" r="1.6"/></g>';
      if (deco % 2 === 1) inner += birds(64, 40, 2);
    } else if (cat === "sea") {
      inner = sun(v !== 2) +
        '<rect y="86" width="400" height="46" fill="' + p.mid + '"/>' +
        '<path d="M0 86 h400 v5 h-400z" fill="' + p.near + '" opacity=".3"/>' + waves +
        '<path d="M0 132 L0 122 Q96 110 196 124 T400 116 L400 132Z" fill="' + p.sky[1] + '" opacity=".85"/>' +
        '<path d="M0 132 L0 126 Q120 114 240 128 T400 122 L400 132Z" fill="' + p.far + '" opacity=".5"/>';
      if (v === 1) {
        inner += '<g fill="' + p.near + '" opacity=".8"><path d="M236 86 v-32 l22 30z" fill="' + p.hi + '"/>' +
          '<path d="M258 86 v-22 l-16 20z" fill="' + p.far + '"/><rect x="232" y="84" width="30" height="3" rx="1"/></g>' +
          birds(70, 34, 3);
      } else if (v === 2) {
        inner += '<g fill="' + p.near + '" opacity=".7"><rect x="62" y="52" width="9" height="34"/>' +
          '<path d="M55 52 l11 -14 l11 14z" fill="' + p.hi + '"/><rect x="60" y="44" width="13" height="6" fill="' + p.sun + '"/></g>' +
          '<path d="M0 100 Q70 92 140 104" fill="none" stroke="' + p.hi + '" stroke-width="1.4" opacity=".5"/>';
      } else {
        inner += '<path d="M' + (sx - 34) + ' 86 q34 10 68 0" fill="none" stroke="' + p.sun + '" stroke-width="2" opacity=".35"/>';
      }
      if (deco % 3 === 0) inner += '<g fill="' + p.near + '" opacity=".55"><circle cx="330" cy="104" r="4"/><circle cx="344" cy="108" r="3"/></g>';
    } else if (cat === "grass" || cat === "pet") {
      inner = '<g fill="' + p.hi + '" opacity=".72">' +
        '<ellipse cx="' + (58 + deco * 18) + '" cy="30" rx="28" ry="9"/><ellipse cx="' + (78 + deco * 18) + '" cy="25" rx="18" ry="8"/>' +
        '<ellipse cx="300" cy="' + (40 + deco * 4) + '" rx="24" ry="8"/></g>' +
        '<g transform="translate(0,' + dy + ')">' +
        hill('M0 94 Q100 68 200 92 T400 82', p.far, .9) +
        hill('M0 110 Q120 86 240 108 T400 100', p.mid, 1) + '</g>' +
        hill('M0 126 Q140 108 280 126 T400 118', p.near, 1) +
        '<g stroke="#3E5723" stroke-width="1.1" opacity=".45"><path d="M60 128 l3 -8M120 130 l-2 -7M210 127 l3 -7M300 129 l-2 -8M350 127 l3 -7"/></g>';
      if (v === 0) {
        inner += '<g fill="#F7F5EC" opacity=".9"><circle cx="94" cy="120" r="1.6"/><circle cx="152" cy="116" r="1.4"/><circle cx="238" cy="124" r="1.5"/></g>' +
          '<g fill="#3B4A32"><ellipse cx="196" cy="116" rx="5" ry="3"/><rect x="194" y="118" width="1.4" height="4"/><rect x="200" y="118" width="1.4" height="4"/></g>';
      } else if (v === 1) {
        inner += '<g fill="' + p.hi + '" stroke="' + p.far + '" stroke-width="1"><path d="M248 118 l18 -16 l18 16z"/></g>' +
          '<rect x="256" y="118" width="5" height="6" fill="' + p.near + '"/>' +
          '<path d="M0 124 Q80 112 140 122 T260 116" fill="none" stroke="' + p.water + '" stroke-width="3" opacity=".8"/>';
      } else {
        inner += '<g stroke="' + p.near + '" stroke-width="1" opacity=".7"><path d="M120 96 v28M120 96 q40 5 80 0"/>' +
          '<path d="M138 99 v8M158 99 v9M178 99 v8" stroke="' + p.sun + '" stroke-width="3"/></g>';
      }
      if (deco % 2 === 1) inner += birds(120, 44, 2);
    } else if (cat === "hike") {
      // 山脊 + 蜿蜒小径 + 背包徒步者，与峡谷、草原的构图区分开
      const ridge = [
        'M0 92 L52 62 L88 78 L142 44 L190 74 L246 50 L296 80 L348 58 L400 86',
        'M0 88 L46 66 L96 84 L154 48 L208 80 L262 54 L318 82 L400 62',
        'M0 94 L60 58 L104 80 L160 52 L214 78 L270 46 L330 76 L400 90'
      ][v];
      const trail = 'M196 132 Q226 118 184 108 Q148 98 202 88 Q240 80 222 70';
      inner = '<g fill="' + p.hi + '" opacity=".6">' +
        '<ellipse cx="' + (74 + deco * 16) + '" cy="30" rx="26" ry="7"/>' +
        '<ellipse cx="' + (300 - deco * 8) + '" cy="' + (40 + deco * 3) + '" rx="20" ry="6"/></g>' +
        hill(ridge, p.far, .78) +
        '<g transform="translate(0,' + dy + ')">' +
        hill('M0 104 Q96 82 196 102 T400 92', p.mid, .9) + '</g>' +
        hill('M0 132 L0 120 Q108 110 196 124 T400 116 L400 132Z', p.mid, .8) +
        '<path d="' + trail + '" fill="none" stroke="' + p.hi + '" stroke-width="3.2" opacity=".9" stroke-linecap="round"/>' +
        '<path d="' + trail + '" fill="none" stroke="' + p.near + '" stroke-width=".9" opacity=".35"/>';
      const ts = v === 1 ? [42, 70, 300, 334, 364] : [34, 62, 90, 296, 326, 368];
      ts.forEach((x, i) => { inner += tree(x, 118 + (i % 2) * 5, 14 + (i % 3) * 5, p.near); });
      const hx = 186 + (deco - 2) * 3;
      inner += '<g fill="' + p.near + '" opacity=".92">' +
        '<circle cx="' + hx + '" cy="101" r="3"/>' +
        '<path d="M' + (hx - 2.5) + ' 105 h5 l1.6 11 h-8Z"/>' +
        '<rect x="' + (hx - 6) + '" y="106" width="3.4" height="7" rx="1"/>' +
        '<path d="M' + (hx - 2) + ' 115 l-2.4 9 h2.8 l2 -6Z"/>' +
        '<path d="M' + (hx + .5) + ' 115 l3.2 9 h-2.8 l-2.4 -6Z"/></g>' +
        '<path d="M' + (hx + 7) + ' 106 l4 19" stroke="' + p.near + '" stroke-width="1.3" opacity=".8"/>';
      if (deco % 2 === 1) inner += birds(112, 42, 2);
    } else if (cat === "canyon") {
      const leftW = 88 + v * 18, rightW = 104 - v * 8;
      // 远景横贯全宽，崖壁压在前景，中央不会形成一块独立的浅色梯形
      inner =
        '<path d="M0 88 L64 62 L128 84 L196 54 L264 82 L332 60 L400 84 L400 132 L0 132Z" fill="' + p.far + '" opacity=".62"/>' +
        '<path d="M0 104 Q100 90 200 104 T400 96 L400 132 L0 132Z" fill="' + p.mid + '" opacity=".3"/>' +
        '<rect y="70" width="400" height="8" fill="' + p.hi + '" opacity=".3"/>' +
        (v === 1 ? '<path d="M196 56 L208 56 L214 132 L190 132Z" fill="' + p.water + '" opacity=".45"/>' : '') +
        '<path d="M0 0 L' + leftW + ' 0 L' + (leftW - 20) + ' 132 L0 132Z" fill="' + p.far + '"/>' +
        '<path d="M400 0 L' + (400 - rightW) + ' 0 L' + (400 - rightW + 22) + ' 132 L400 132Z" fill="' + p.far + '"/>' +
        '<path d="M0 0 L' + (leftW * .55) + ' 0 L' + (leftW * .42) + ' 132 L0 132Z" fill="' + p.mid + '" opacity=".82"/>' +
        '<path d="M400 0 L' + (400 - rightW * .5) + ' 0 L' + (400 - rightW * .42) + ' 132 L400 132Z" fill="' + p.mid + '" opacity=".82"/>' +
        '<g fill="none" stroke="' + p.hi + '" stroke-width="1.3" opacity=".4">' +
        '<path d="M' + leftW + ' 0 L' + (leftW - 20) + ' 132"/><path d="M' + (400 - rightW) + ' 0 L' + (400 - rightW + 22) + ' 132"/></g>' +
        '<path d="M158 132 Q200 114 242 132Z" fill="' + p.water + '" opacity=".42"/>';
      const ts = v === 2 ? [128, 152, 178, 244, 268] : [134, 162, 240, 268];
      ts.forEach((x, i) => { inner += tree(x, 118 + (i % 2) * 4, 17 + (i % 3) * 6, p.near); });
      if (v === 2) inner += '<g fill="' + p.sun + '" opacity=".6"><circle cx="152" cy="94" r="4.5"/><circle cx="178" cy="100" r="4"/><circle cx="246" cy="96" r="4.5"/></g>';
    } else if (cat === "town") {
      inner = hill('M0 90 L50 62 L96 88 L150 58 L206 86 L262 62 L316 88 L366 64 L400 84', p.far, .55);
      const houses = [
        [[26, 92, 54, 40], [96, 84, 66, 48], [178, 94, 50, 38], [244, 82, 70, 50], [330, 96, 48, 36]],
        [[40, 96, 58, 36], [112, 76, 72, 56], [210, 88, 60, 44], [292, 92, 66, 40]],
        [[60, 94, 70, 38], [170, 86, 76, 46], [286, 96, 60, 36]]
      ][v];
      let walls = '<g fill="' + p.water + '" stroke="#B7A78F" stroke-width=".8">';
      let roofs = '<g fill="' + p.mid + '">';
      let doors = '<g fill="#4A3B31" opacity=".7">';
      houses.forEach((h, i) => {
        const [x, y, w, hh] = h;
        walls += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + hh + '"/>';
        roofs += '<path d="M' + (x - 8) + ' ' + y + ' L' + (x + w / 2) + ' ' + (y - 16 - (i % 2) * 5) + ' L' + (x + w + 8) + ' ' + y + 'Z"/>';
        doors += '<rect x="' + (x + w * .45) + '" y="' + (y + hh * .5) + '" width="7" height="' + (hh * .5) + '"/>';
      });
      inner += '<g transform="translate(' + (deco - 2) + ',0)">' + walls + '</g>' + roofs + '</g>' + doors + '</g>' + '</g>';
      if (v === 1) inner += '<g fill="' + p.mid + '"><rect x="356" y="42" width="16" height="54"/>' +
        '<path d="M350 42 l14 -14 l14 14z"/><rect x="361" y="56" width="6" height="8" fill="' + p.hi + '"/></g>';
      inner += '<g fill="' + p.hi + '"><circle cx="94" cy="100" r="2.6"/><circle cx="172" cy="94" r="2.4"/><circle cx="322" cy="102" r="2.4"/></g>';
    } else {
      inner = sun(v !== 2) +
        '<g transform="translate(0,' + dy + ')">' +
        hill('M0 108 Q96 66 196 100 T400 88', p.far, 1) +
        hill('M0 124 Q120 98 240 120 T400 110', p.mid, 1) + '</g>' +
        hill('M0 132 L0 126 Q140 118 280 130 T400 124 L400 132Z', p.near, .55) +
        '<path d="M0 108 Q96 66 196 100 T400 88" fill="none" stroke="' + p.hi + '" stroke-width="1.4" opacity=".55"/>';
      if (v === 2) inner += '<g stroke="' + p.mid + '" stroke-width="2" opacity=".45"><path d="M0 96 q100 -18 200 0 t200 -6"/><path d="M0 108 q100 -16 200 2 t200 -4"/></g>';
      if (v !== 1) {
        inner += '<g fill="' + p.near + '" opacity=".8"><path d="M120 118 l6 -9 l6 9z"/><path d="M132 120 l5 -7 l5 7z"/>' +
          '<circle cx="126" cy="122" r="1.2"/><circle cx="137" cy="123" r="1.2"/></g>';
      } else {
        inner += '<g stroke="' + p.near + '" stroke-width="1.4" fill="none" opacity=".75"><path d="M280 120 v-16M280 106 l-6 -4M280 108 l7 -5"/></g>';
      }
      if (deco === 3) inner += birds(200, 30, 2);
    }

    const wrap = flip ? '<g transform="translate(400,0) scale(-1,1)">' : '<g>';
    // 太阳单独放，镜像只作用于地貌，构图差异更明显
    const hasSun = cat === "lake" || cat === "snow" || cat === "grass" || cat === "town" || cat === "pet" || cat === "hike";
    return head + (hasSun ? sun(v === 0) : "") + wrap + inner + "</g></svg>";
  }

  /* ---------------- 状态 ---------------- */
  const state = { cat: "all", trip: "all", sort: "rec", q: "", fav: new Set(), mounted: false,
                  rBand: "all", rCat: "all" };  // rBand / rCat：方位距离图的圈层与风光聚焦
  try { state.fav = new Set(JSON.parse(localStorage.getItem("cdx-fav") || "[]")); } catch (e) { }

  /* ---------------- 筛选器 ---------------- */
  function buildChips() {
    const catBox = $("#catChips");
    const counts = {};
    DEST.forEach((d) => (counts[d.cat] = (counts[d.cat] || 0) + 1));
    catBox.innerHTML =
      '<button class="chip is-on" data-cat="all">全部<span class="n">' + DEST.length + "</span></button>" +
      CATS.map((c) =>
        '<button class="chip" data-cat="' + c.key + '" style="--cc:' + catColor(c.key) + '">' +
        '<i class="swatch" style="background:' + catColor(c.key) + ';opacity:1"></i>' + c.name +
        '<span class="n">' + (counts[c.key] || 0) + "</span></button>"
      ).join("");

    const trips = [
      { key: "all", name: "不限" },
      { key: "weekend", name: "周末可达" },
      { key: "short", name: "小长假" },
      { key: "mid", name: "长假远征" },
      { key: "long", name: "深度长线" }
    ];
    $("#tripChips").innerHTML = trips
      .map((t, i) => '<button class="chip' + (i === 0 ? " is-on" : "") + '" data-trip="' + t.key + '">' + t.name + "</button>")
      .join("");

    $("#catChips").addEventListener("click", (e) => {
      const b = e.target.closest("[data-cat]"); if (!b) return;
      state.cat = b.dataset.cat;
      $$("#catChips .chip").forEach((x) => x.classList.toggle("is-on", x === b));
      render();
    });
    $("#tripChips").addEventListener("click", (e) => {
      const b = e.target.closest("[data-trip]"); if (!b) return;
      state.trip = b.dataset.trip;
      $$("#tripChips .chip").forEach((x) => x.classList.toggle("is-on", x === b));
      render();
    });
    $("#search").addEventListener("input", (e) => { state.q = e.target.value.trim(); render(); });
    $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
  }

  const catColor = (k) => ({ lake: "#1F5C86", snow: "#5B7C9B", sea: "#0E6E73", grass: "#55702F", canyon: "#8A5323", town: "#7B4A5C", desert: "#B08226", pet: "#C1663B", hike: "#2E6B58", climb: "#3F4B66" }[k] || "#1B211C");

  /* ---------------- 日期对齐 ----------------
     meteoblue 的十日预报常按 UTC 排期：成都时间凌晨抓取时，起始日仍是前一天。
     所以不能用 weather[0] 代表「今天」，一律按浏览器本地日期定位。
  ------------------------------------------ */
  /** 本地时区 YYYY-MM-DD；不用 toISOString，避免 UTC 偏移把日期算成前一天。 */
  function localYMD(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  const todayKey = () => localYMD(new Date());
  /** weather 数组中「今天」的下标；找不到时退回首个未来日期，再退回 0。 */
  function todayIndex(wxs) {
    if (!wxs || !wxs.length) return -1;
    const k = todayKey();
    const i = wxs.findIndex((x) => x.date === k);
    if (i >= 0) return i;
    const j = wxs.findIndex((x) => x.date > k);
    return j >= 0 ? j : 0;
  }

  /* ---------------- 综合推荐评分 ----------------
     默认排序不再只看星级：把「景致质量 / 当季适配 / 未来五天天气 / 出行轻松度」
     加权成 0—100 分。权重与阈值集中在 REC，改推荐口味只动这一处。
     每次 filtered() 重算一次，跨午夜或天气更新后无需手工清缓存。
  ----------------------------------------------- */
  const REC = {
    w: { quality: 0.30, season: 0.20, weather: 0.30, ease: 0.20 },
    days: 5,                        // 从今天起评估的出发窗口（含今天）
    decay: 0.8,                     // 逐日权重按 0.8 等比衰减：1 / 0.8 / 0.64 / 0.51 / 0.41
    kind: { sun: 1, partly: 0.9, cloud: 0.68, overcast: 0.55, fog: 0.42, rain: 0.24, snow: 0.32, storm: 0.08 },
    kmHalf: 700, costHalf: 500,      // 半饱和常数：达到该值时「轻松度」用掉一半预算
    gainHalf: 1400, dayHalf: 6       // 攀登卷同理：累计爬升 1400 米、周期 6 天各用掉一半
  };
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const DAY_CN = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

  /** 把「4—6 月 / 9—11 月」「10—4 月」「11 月—次年 3 月」等中文季节文本解析成月份集合。 */
  function seasonMonths(text) {
    const s = String(text || ""), out = new Set();
    const re = /(\d{1,2})\s*月?\s*(?:上旬|中旬|下旬)?\s*[—\-–~至]+\s*(?:次年\s*)?(\d{1,2})\s*月?/g;
    let m;
    while ((m = re.exec(s))) {
      const a = +m[1], b = +m[2];
      if (a < 1 || a > 12 || b < 1 || b > 12) continue;
      if (a <= b) { for (let i = a; i <= b; i++) out.add(i); }
      else { for (let i = a; i <= 12; i++) out.add(i); for (let i = 1; i <= b; i++) out.add(i); }
    }
    const single = /(?:^|[^\d])\s*(\d{1,2})\s*月/g;
    while ((m = single.exec(s))) { const v = +m[1]; if (v >= 1 && v <= 12) out.add(v); }
    if (/春秋/.test(s)) [3, 4, 5, 9, 10, 11].forEach((x) => out.add(x));
    if (/夏季|避暑/.test(s)) [6, 7, 8].forEach((x) => out.add(x));
    if (/冬季|看雪|滑雪|冰雪/.test(s)) [12, 1, 2].forEach((x) => out.add(x));
    return out;
  }

  /** 当季 = 1；「全年」但不在最佳区间 = 0.72；刚过季 / 将入季 = 0.5；明显淡季 = 0.32；无法解析 = 0.6。 */
  function seasonScore(d, month) {
    const s = String(d.season || "");
    const months = seasonMonths(s);
    if (months.has(month)) return 1;
    if (/全年/.test(s)) return 0.72;
    if (!months.size) return 0.6;
    const prev = month === 1 ? 12 : month - 1;
    const next = month === 12 ? 1 : month + 1;
    if (months.has(prev) || months.has(next)) return 0.5;
    return 0.32;
  }

  /** 降水量取区间上界；cm（雪）按 2 倍折算出行影响。 */
  function precipPenalty(p) {
    if (!p || p === "-") return 0;
    const m = String(p).match(/(\d+(?:\.\d+)?)\s*(mm|cm)/i);
    if (!m) return 0;
    return Math.min(0.32, (+m[1] * (m[2].toLowerCase() === "cm" ? 2 : 1)) / 26);
  }

  /** 单日出行舒适度：天气现象为主，降水 / 气温 / 大风为辅。 */
  function dayComfort(w) {
    const dk = wx(w.day)[1], nk = wx(w.night)[1];
    let s = REC.kind[dk] != null ? REC.kind[dk] : 0.6;
    if (REC.kind[nk] != null && REC.kind[nk] < 0.4) s -= 0.08;
    s -= precipPenalty(w.precip);
    if (w.tmax < 12) s -= Math.min(0.18, (12 - w.tmax) / 28);
    else if (w.tmax > 28) s -= Math.min(0.14, (w.tmax - 28) / 20);
    if (w.wind > 25) s -= Math.min(0.14, (w.wind - 25) / 120);
    return clamp01(s);
  }

  /** 今天起 REC.days 天（含今天）按 REC.decay 等比衰减加权；无可用预报时给中性 0.5，不奖励也不重罚。 */
  function weatherScore(d) {
    const wxs = d.weather || [];
    const ti = todayIndex(wxs);
    if (ti < 0) return { score: 0.5, days: 0 };
    const future = wxs.slice(ti).filter((x) => x.date >= todayKey()).slice(0, REC.days);
    if (!future.length) return { score: 0.5, days: 0 };
    let sum = 0, wsum = 0;
    future.forEach((x, i) => { const w = Math.pow(REC.decay, i); sum += dayComfort(x) * w; wsum += w; });
    return { score: clamp01(sum / wsum), days: future.length };
  }

  /** 普通卷：里程 62% + 单程交通成本 38%；攀登卷不比路费，改看累计爬升与攀登周期。 */
  const easeScore = (d) => d.cat === "climb"
    ? clamp01(
        1 - 0.62 * (d.gain / (d.gain + REC.gainHalf))
          - 0.38 * (d.climbDays / (d.climbDays + REC.dayHalf)))
    : clamp01(
        1 - 0.62 * (d.km / (d.km + REC.kmHalf))
          - 0.38 * (d.cost / (d.cost + REC.costHalf)));

  function recReason(p, wxr, d) {
    const climb = d && d.cat === "climb";
    const r = [];
    if (p.season >= 0.99) r.push("正当时");
    else if (p.season <= 0.36) r.push("非最佳季");
    if (!wxr.days) r.push("天气待更新");
    else if (p.weather >= 0.78) r.push("近" + (DAY_CN[wxr.days] || wxr.days) + "日晴好");
    else if (p.weather <= 0.42) r.push("近期有雨雪");
    if (p.quality >= 0.9) r.push("五星景致");
    if (p.ease >= 0.72) r.push(climb ? "强度温和" : "近程轻松");
    else if (p.ease <= 0.28) r.push(climb ? "高强度周期" : "长线规划");
    return r.slice(0, 3).join(" · ") || "均衡之选";
  }

  function recScore(d) {
    const month = new Date().getMonth() + 1;
    const wxr = weatherScore(d);
    const parts = { quality: clamp01(d.rating / 5), season: seasonScore(d, month), weather: wxr.score, ease: easeScore(d) };
    const raw = REC.w.quality * parts.quality + REC.w.season * parts.season +
      REC.w.weather * parts.weather + REC.w.ease * parts.ease;
    return {
      score: Math.round(raw * 1000) / 10,
      parts: parts,
      hasWx: wxr.days > 0,
      window: wxr.days,
      reason: recReason(parts, wxr, d)
    };
  }
  function refreshRec() { DEST.forEach((d) => { d._rec = recScore(d); }); }

  /* ---------------- 推荐依据展示 ---------------- */
  function recTitle(r) {
    const pct = (x) => Math.round(x * 100);
    return "综合推荐 " + r.score.toFixed(1) + " 分 · " + r.reason +
      "｜景致 " + pct(r.parts.quality) + " / 当季 " + pct(r.parts.season) +
      " / 天气 " + pct(r.parts.weather) + " / 轻松度 " + pct(r.parts.ease) +
      (r.hasWx ? "（近 " + r.window + " 天预报）" : "（暂无天气，按中性计）");
  }
  function recSection(d) {
    const r = d._rec || recScore(d);
    const pct = (x) => Math.round(x * 100);
    const climb = d.cat === "climb";
    const rows = [
      { k: "景致质量", w: 30, v: pct(r.parts.quality), note: d.rating + ".0 ★" },
      { k: "当季适配", w: 20, v: pct(r.parts.season), note: r.parts.season >= 0.99 ? "正当时" : r.parts.season >= 0.7 ? "全年可去" : r.parts.season >= 0.59 ? "季节待核" : r.parts.season >= 0.49 ? "临界月" : "非最佳季" },
      { k: "近" + (DAY_CN[REC.days] || REC.days) + "日天气", w: 30, v: pct(r.parts.weather), note: !r.hasWx ? "暂无预报" : r.parts.weather >= 0.78 ? "适宜出行" : r.parts.weather <= 0.42 ? "有雨雪" : "一般" },
      climb
        ? { k: "爬升与用时", w: 20, v: pct(r.parts.ease), note: r.parts.ease >= 0.72 ? "强度温和" : r.parts.ease <= 0.28 ? "高强度周期" : "适中" }
        : { k: "里程与花费", w: 20, v: pct(r.parts.ease), note: r.parts.ease >= 0.72 ? "近程轻松" : r.parts.ease <= 0.28 ? "长线规划" : "适中" }
    ];
    return '<div class="d-sec d-rec"><h4>综合推荐 · 现在去合不合适</h4>' +
      '<div class="d-rec__head"><b>' + r.score.toFixed(1) + '<small>/ 100</small></b><span>' + esc(r.reason) + "</span></div>" +
      '<div class="d-rec__bars">' + rows.map((x) =>
        '<div class="d-rec__row"><span>' + x.k + "<i>" + x.w + "%</i></span>" +
        '<em><i style="width:' + x.v + '%"></i></em><b>' + x.v + "</b><u>" + esc(x.note) + "</u></div>").join("") +
      "</div>" +
      '<p class="d-rec__note">按景致 30% + 当季 20% + 未来 ' + REC.days + ' 天天气 30% + ' +
      (climb ? "爬升与用时" : "里程与花费") + ' 20% 加权；' +
      (climb ? "本卷不计车程与路费，强度项按累计爬升与攀登周期折算；" : "") +
      '天气从今天起按 ' + REC.decay + ' 等比衰减，每次筛选与每日数据更新后自动重算。' +
      (r.hasWx ? "本次实际采用近 " + r.window + " 天预报。" : "该目的地暂无可用预报，天气项按中性 50 分计。") + "</p></div>";
  }

  /* ---------------- 卡片 ---------------- */
  function cardHTML(d) {
    const rec = d._rec || recScore(d);
    const ti = todayIndex(d.weather);
    const w = ti >= 0 ? d.weather[ti] : null;
    const strip = (ti >= 0 ? d.weather.slice(ti + 1, ti + 4) : []).map((x) => {
      const [label, kind] = wx(x.day);
      return '<div class="wx-mini" title="' + esc(x.date + " " + label + " " + x.tmin + "~" + x.tmax + "°C") + '">' +
        icon(kind) + "<i>" + Math.round(x.tmax) + "°</i></div>";
    }).join("");
    const now = w ? wx(w.day) : ["—", "cloud"];
    const c = CAT[d.cat] || { name: "" };
    return '<button class="card" data-id="' + d.id + '" style="--cat:' + catColor(d.cat) + '">' +
      '<div class="card__scene">' + sceneFor(d) +
      '<div class="card__top">' +
      '<span class="tag" style="--cat:' + catColor(d.cat) + '">' + c.name + "</span>" +
      '<span class="card__fav' + (state.fav.has(d.id) ? " is-on" : "") + '" data-fav="' + d.id + '" role="button" aria-label="收藏">' +
      '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 20s-7-4.4-7-9.2A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7 2.8C19 15.6 12 20 12 20Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>' +
      "</span></div></div>" +
      '<div class="card__body">' +
      '<div class="card__title"><span class="card__name">' + esc(d.name) + '</span><span class="card__sub">' + esc(d.sub) + "</span></div>" +
      '<div class="card__tags">' + (d.tags || []).slice(0, 2).map((t) => "<span>" + esc(t) + "</span>").join("") +
      '<span class="card__score" title="' + esc(recTitle(rec)) + '"><em>推荐</em>' + rec.score.toFixed(1) + "</span></div>" +
      '<div class="card__figs">' +
      (d.cat === "climb"
        ? '<div class="fig"><b>' + fmt(d.gain) + "</b><span>米爬升</span></div>" +
          '<div class="fig fig--txt"><b>' + esc(String(d.span).replace(/\s+/g, "")) + "</b><span>用时</span></div>" +
          '<div class="fig"><b>' + fmt(d.summit) + "</b><span>顶峰海拔</span></div>"
        : '<div class="fig"><b>' + fmt(d.km) + "</b><span>公里</span></div>" +
          '<div class="fig"><b>' + d.hrs + "</b><span>小时车程</span></div>" +
          '<div class="fig"><b>¥' + d.toll + "</b><span>过路费</span></div>") +
      "</div>" +
      '<div class="card__wx">' + icon(now[1], "wx-ico") +
      '<div class="wx-main"><b>' + (w ? Math.round(w.tmax) + "° / " + Math.round(w.tmin) + "°" : "暂无天气") + "</b><span>" +
      (w ? now[0] + " · " + (w.date === todayKey() ? "今日" : w.date.slice(5).replace("-", "/")) : "待更新") + "</span></div>" +
      '<div class="wx-strip">' + strip + "</div></div>" +
      '<div class="card__foot">' + (d.cat === "climb" ? "查看攀登数据与十日天气" : "查看路线与十日天气") +
      '<svg viewBox="0 0 20 20" width="13" height="13"><path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></div>' +
      "</div></button>";
  }

  function filtered() {
    refreshRec();
    let list = DEST.slice();
    if (state.cat !== "all") list = list.filter((d) => d.cat === state.cat);
    if (state.trip !== "all") list = list.filter((d) => d.trip.key === state.trip);
    if (state.q) {
      const q = state.q.toLowerCase();
      list = list.filter((d) =>
        (d.name + d.sub + d.intro + d.tags.join("") + d.route + d.roads).toLowerCase().includes(q));
    }
    const sorters = {
      rec: (a, b) => b._rec.score - a._rec.score || b.rating - a.rating || a.km - b.km,
      star: (a, b) => b.rating - a.rating || a.km - b.km,
      km: (a, b) => a.km - b.km,
      alt: (a, b) => b.alt - a.alt,
      cost: (a, b) => a.cost - b.cost,
      name: (a, b) => a.name.localeCompare(b.name, "zh")
    };
    return list.sort(sorters[state.sort] || sorters.rec);
  }

  function render() {
    const list = filtered();
    $("#grid").innerHTML = list.map(cardHTML).join("");
    $("#resultCount").textContent = list.length + " 个目的地";
    if (!list.length) {
      $("#resultHint").textContent = "";
    } else if (list.every((d) => d.cat === "climb")) {
      // 攀登卷不比车程与路费，结果栏改报爬升与周期
      const gain = Math.round(list.reduce((s, d) => s + d.gain, 0) / list.length);
      const ds = list.map((d) => d.climbDays);
      $("#resultHint").textContent = "爬升均值 " + fmt(gain) + " 米 · 周期 " +
        Math.min.apply(null, ds) + "—" + Math.max.apply(null, ds) + " 天";
    } else {
      const km = list.reduce((s, d) => s + d.km, 0);
      $("#resultHint").textContent = "里程均值 " + fmt(Math.round(km / list.length)) + " 公里 · 过路费均值 ¥" +
        Math.round(list.reduce((s, d) => s + d.toll, 0) / list.length);
    }
    $("#empty").hidden = list.length > 0;
    // 进场动画只在首次浏览时出现；筛选切换时重播会干扰快速操作
    if (!state.mounted) { observeCards(); state.mounted = true; }
  }

  /* ---------------- 进场动效 ---------------- */
  let cardIO = null;
  function observeCards() {
    if (!("IntersectionObserver" in window)) return;
    if (cardIO) cardIO.disconnect();
    cardIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-revealing");
        cardIO.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -36px 0px", threshold: 0.06 });
    $$("#grid .card").forEach((el, i) => {
      el.style.animationDelay = ((i % 3) * 55) + "ms";
      cardIO.observe(el);
    });
  }

  /* ---------------- 抽屉 ---------------- */
  let lastFocus = null;
  function openDrawer(id) {
    const d = DEST.find((x) => x.id === id); if (!d) return;
    lastFocus = document.activeElement;
    const c = CAT[d.cat] || { name: "" };
    $("#dCat").textContent = c.name + " / " + d.trip.name;
    $("#dCat").style.setProperty("--cat", catColor(d.cat));

    const wxs = d.weather.length ? d.weather : [];
    const ti = todayIndex(wxs);
    const today = ti >= 0 ? wxs[ti] : null;
    const tKey = todayKey();
    const wRows = wxs.map((x) => {
      const [label, kind] = wx(x.day);
      const [nlabel, nkind] = wx(x.night);
      const isToday = x.date === tKey;
      const cls = "d-day" + (isToday ? " is-today" : "") + (x.date < tKey ? " is-past" : "");
      return '<div class="' + cls + '" title="' + esc(x.date + " 白天 " + label + " / 夜间 " + nlabel + " · 风 " + x.wind + " km/h " + x.wdir) + '">' +
        "<b>" + (isToday ? "今天" : x.date.slice(5).replace("-", "/")) + "</b>" +
        "<i>" + ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][new Date(x.date + "T00:00:00").getDay()] + "</i>" +
        icon(kind) +
        '<span class="t">' + Math.round(x.tmax) + "°<small>" + Math.round(x.tmin) + "°</small></span>" +
        '<span class="p">' + (x.precip && x.precip !== "-" ? x.precip : "") + "</span>" +
        "</div>";
    }).join("");

    $("#dBody").innerHTML =
      '<div class="d-hero">' + sceneFor(d) + "</div>" +
      '<div class="d-intro">' +
      '<h2 class="d-title">' + esc(d.name) + "</h2>" +
      '<p class="d-sub">' + esc(d.sub) + (d.cat === "climb" ? " · 顶峰 " + fmt(d.summit) + " 米" : " · 海拔 " + fmt(d.alt) + " 米") + "</p>" +
      '<div class="d-badges">' +
      '<span class="badge badge--star"><em>' + "★".repeat(d.rating) + "☆".repeat(5 - d.rating) + "</em>" + d.rating + ".0</span>" +
      d.tags.map((t) => '<span class="badge">' + esc(t) + "</span>").join("") +
      (d.cat === "climb"
        ? '<span class="badge">' + esc(d.span) + "</span>"
        : '<span class="badge">建议 ' + d.days + " 天</span>") +
      "</div>" +
      '<div class="d-meta">' +
      (d.cat === "climb"
        ? meta("单程里程", fmt(d.km), "km") + meta("车程", d.hrs, "小时") +
          meta("顶峰海拔", fmt(d.summit), "m") + meta("累计爬升", fmt(d.gain), "m") +
          meta("徒步往返", d.trek, "km") + meta("建议用时", d.span) +
          meta("难度", d.grade.split(" · ")[0]) + meta("最佳季节", d.season.split("，")[0])
        : meta("单程里程", fmt(d.km), "km") + meta("车程", d.hrs, "小时") +
          meta("过路费", "¥" + d.toll) + meta("电费约", "¥" + d.energy) +
          meta("门票", ticketShort(d)) + meta("海拔", fmt(d.alt), "m") +
          meta("最佳季节", d.season.split("，")[0]) + meta("行程", d.trip.hint)) +
      "</div></div>" +

      recSection(d) +

      '<div class="d-sec"><h4>路线</h4><p class="d-route">' + esc(d.route) +
      "<em>" + esc(d.roads) + "</em></p></div>" +

      '<div class="d-sec"><h4>看点</h4><p class="d-text">' + esc(d.intro) + "</p></div>" +

      '<div class="d-wx"><div class="d-wx__head"><span>未来 10 天 · 逐日预报</span><b>METEOBLUE</b></div>' +
      '<div class="d-wx__rows">' + wRows + "</div>" +
      '<div class="d-wx__note">格内为当日最高 / 最低气温，蓝色数字为降水量。' +
      (today ? (today.date === tKey ? "今日" : today.date.slice(5).replace("-", "/")) + "：" + wx(today.day)[0] + "，风 " + today.wind + " km/h " + (today.wdir || "") + (today.sun != null ? "，日照 " + today.sun + " 小时" : "") + "。" : "该目的地暂无天气数据，运行一次天气更新即可补齐。") +
      (d.cat === "climb" ? "预报点为进山村 / 山脚，峰顶气温约再低 15—20 ℃、风力更大，冲顶窗口以当日实测与向导判断为准。" : "") +
      "数据源 meteoblue，远期预报误差较大。</div></div>" +

      '<div class="d-sec"><h4>实用贴士</h4><ul class="d-tips">' + d.tips.map((t) => "<li>" + esc(t) + "</li>").join("") + "</ul></div>" +

      (d.cat === "climb"
        ? '<div class="d-sec d-permit"><h4>许可与备案</h4><p class="d-text">' + esc(d.permit) + "</p></div>"
        : '<div class="d-cost"><div><span>单程交通成本（过路 + 电）· ' +
          (d.chargeStops ? "建议补电 " + d.chargeStops + " 次" : "无需中途补电") + '</span><br><b>¥' + fmt(d.cost) + '</b></div>' +
          '<span style="text-align:right">往返交通约 ¥' + fmt(d.cost * 2) + "<br>不含门票、食宿</span></div>") +

      '<div class="d-rel"><h4>同类风光</h4><div class="rel-list">' +
      DEST.filter((x) => x.cat === d.cat && x.id !== d.id)
        .sort((a, b) => (d.cat === "climb" ? a.alt - b.alt : a.km - b.km)).slice(0, 4).map((x) =>
        '<button class="rel" data-rel="' + x.id + '"><b>' + esc(x.name) + "</b><span>" +
        (d.cat === "climb" ? "爬升 " + fmt(x.gain) + " m · " + esc(x.span) : x.km + " km · " + esc(x.sub.split("·")[1] || x.sub)) +
        "</span></button>"
      ).join("") + "</div></div>";

    $("#dBody").scrollTop = 0;
    $("#drawer").classList.add("is-open");
    $("#drawer").setAttribute("aria-hidden", "false");
    $("#scrim").hidden = false;
    requestAnimationFrame(() => $("#scrim").classList.add("is-open"));
    document.body.style.overflow = "hidden";
    $("#dClose").focus();
  }
  const meta = (k, v, u) => '<div><p><b' + (String(v).length > 7 ? ' class="sm"' : "") + ">" + esc(v) + "</b>" + (u ? "<i>" + esc(u) + "</i>" : "") + "</p><span>" + esc(k) + "</span></div>";
  function ticketShort(d) {
    if (/免费/.test(d.ticket)) return "免费";
    if (/预约/.test(d.ticket)) return "需预约";
    const m = d.ticket.match(/(\d+)\s*元/);
    return m ? "¥" + m[1] : d.ticket.split("（")[0];
  }

  function closeDrawer() {
    $("#drawer").classList.remove("is-open");
    $("#drawer").setAttribute("aria-hidden", "true");
    $("#scrim").classList.remove("is-open");
    setTimeout(() => { $("#scrim").hidden = true; }, 400);
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ---------------- 方位距离图 · 圈层聚焦 ----------------
     默认 143 个点全画成小圆点、不写标签，避免叠成一团。
     点任一圈层（图上的环带或右侧按钮）后，只有这一段的点会亮起并出现名字，
     其余淡出；风光按钮可再收窄一次。右侧清单始终列出亮起的全部目的地。
  ---------------------------------------------------- */
  const BANDS = [
    { key: "b1", name: "家门口",   min: 0,    max: 300,     hint: "当天往返" },
    { key: "b2", name: "川西短线", min: 300,  max: 600,     hint: "2—3 天" },
    { key: "b3", name: "小长假",   min: 600,  max: 1000,    hint: "3—5 天" },
    { key: "b4", name: "长假远征", min: 1000, max: 1600,    hint: "5—7 天" },
    { key: "b5", name: "跨省长线", min: 1600, max: 2200,    hint: "7 天起" },
    { key: "b6", name: "深度长线", min: 2200, max: Infinity, hint: "建议飞抵或分段" }
  ];
  const bandOf = (km) => (BANDS.find((b) => km > b.min && km <= b.max) || BANDS[BANDS.length - 1]).key;
  const bandLabel = (b) => (b.max === Infinity ? b.min + " km 以上" : b.min + "—" + b.max + " km");

  function renderRadial() {
    // 半径按里程的 0.62 次幂压缩；上限取实际最远点，避免 2100 km 以上的长线被压到同一圈
    const W = 800, H = 760, cx = 400, cy = 380, R = 322, minR = 82;
    const far = DEST.reduce((m, d) => Math.max(m, d.km), 0);
    const MAX = Math.max(3200, Math.ceil(far / 200) * 200);
    const rr = (km) => minR + Math.pow(Math.min(km, MAX) / MAX, 0.62) * (R - minR);

    const focusMode = state.rBand !== "all" || state.rCat !== "all";
    const catOk = (d) => state.rCat === "all" || d.cat === state.rCat;
    const bandOk = (d) => state.rBand === "all" || bandOf(d.km) === state.rBand;
    const on = DEST.filter((d) => catOk(d) && bandOk(d));
    const onIds = new Set(on.map((d) => d.id));
    let s = "";

    // 1) 可点击的环带：用「描边宽度 = 环带厚度」的空心圆，命中区域正好只有这一圈
    const edges = [0].concat(BANDS.map((b) => Math.min(b.max, MAX)));
    BANDS.forEach((b, i) => {
      const rIn = rr(edges[i]), rOut = rr(edges[i + 1]);
      s += '<circle class="band' + (state.rBand === b.key ? " is-on" : "") + '" data-rband="' + b.key +
        '" cx="' + cx + '" cy="' + cy + '" r="' + ((rIn + rOut) / 2).toFixed(1) +
        '" stroke-width="' + Math.max(1, rOut - rIn).toFixed(1) +
        '" tabindex="0" role="button" aria-label="只看' + b.name + '，' + bandLabel(b) + '">' +
        "<title>" + esc(b.name + " · " + bandLabel(b) + " · " + b.hint + "（点击只看这一段）") + "</title></circle>";
    });

    // 2) 圈层边界与刻度（沿北偏东 22.5° 排开，避开八条方位射线）
    const ticks = [300, 600, 1000, 1600, 2200];
    ticks.forEach((k) => {
      s += '<circle class="ring" cx="' + cx + '" cy="' + cy + '" r="' + rr(k).toFixed(1) + '"/>';
    });
    s += '<circle class="ring ring--outer" cx="' + cx + '" cy="' + cy + '" r="' + R + '"/>';
    const la = (22.5 * Math.PI) / 180;
    ticks.concat([MAX]).forEach((k) => {
      const r = rr(k);
      s += '<text class="ring-lbl" x="' + (cx + r * Math.sin(la)).toFixed(1) +
        '" y="' + (cy - r * Math.cos(la) + 3).toFixed(1) + '" text-anchor="middle">' +
        fmt(k) + (k === MAX ? " km" : "") + "</text>";
    });

    // 3) 方位
    const dirs = [["北", 0], ["东北", 45], ["东", 90], ["东南", 135], ["南", 180], ["西南", 225], ["西", 270], ["西北", 315]];
    dirs.forEach(([n, a]) => {
      const t = (a * Math.PI) / 180;
      s += '<line class="spoke" x1="' + cx + '" y1="' + cy + '" x2="' + (cx + R * Math.sin(t)).toFixed(1) + '" y2="' + (cy - R * Math.cos(t)).toFixed(1) + '"/>';
      s += '<text class="dir" x="' + (cx + (R + 22) * Math.sin(t)).toFixed(1) + '" y="' + (cy - (R + 22) * Math.cos(t) + 4).toFixed(1) +
        '" text-anchor="middle">' + n + "</text>";
    });

    // 4) 坐标
    const items = DEST.map((d) => {
      const t = (d.bearing * Math.PI) / 180, r = rr(d.km);
      return { d, x: cx + r * Math.sin(t), y: cy - r * Math.cos(t), r };
    });

    // 5) 标签避让：只给「亮起」的点算标签，右/左各 9 个偏移 + 正上，共 19 个候选位置
    const placed = [{ x: cx - 27, y: cy - 27, w: 54, h: 36 }];  // 保护圆心「成都」
    const overlaps = (a, b) =>
      a.x < b.x + b.w + 5 && a.x + a.w + 5 > b.x &&
      a.y < b.y + b.h + 4 && a.y + a.h + 4 > b.y;
    const inCanvas = (o) => o.x >= 4 && o.x + o.w <= W - 4 && o.y >= 4 && o.y + o.h <= H - 4;
    const labels = {};
    if (focusMode) {
      items.filter((it) => onIds.has(it.d.id)).slice().sort((a, b) => a.r - b.r).forEach((it) => {
        const w = it.d.name.length * 11 + 10, h = 14;
        const opts = [];
        for (const off of [0, -11, 11, -22, 22, -33, 33, -44, 44]) {
          opts.push({ x: it.x + 9, y: it.y + off - h / 2, w, h, tx: it.x + 9, ty: it.y + off + 3.5, anchor: "start", link: off !== 0 ? [it.x + 9, it.y + off] : null });
          opts.push({ x: it.x - 9 - w, y: it.y + off - h / 2, w, h, tx: it.x - 9, ty: it.y + off + 3.5, anchor: "end", link: off !== 0 ? [it.x - 9, it.y + off] : null });
        }
        opts.push({ x: it.x - w / 2, y: it.y - 20, w, h, tx: it.x, ty: it.y - 9, anchor: "middle", link: [it.x, it.y - 13] });
        const sel = opts.find((o) => inCanvas(o) && !placed.some((b) => overlaps(o, b)));
        if (!sel) return;
        placed.push({ x: sel.x, y: sel.y, w: sel.w, h: sel.h });
        labels[it.d.id] = sel;
      });
    }

    // 6) 点与标签同组；未聚焦时靠悬停浮出名字，聚焦时才有常驻标签
    items.forEach((it) => {
      const L = labels[it.d.id];
      const rightSide = it.x > cx + 170;
      const tipX = rightSide ? it.x - 9 : it.x + 9;
      const tipY = Math.max(14, Math.min(H - 10, it.y - 8));
      s += '<g class="pt' + (focusMode && onIds.has(it.d.id) ? " is-on" : "") +
        '" data-id="' + it.d.id + '" data-band="' + bandOf(it.d.km) + '" style="--c:' + catColor(it.d.cat) + '">' +
        "<title>" + esc(it.d.name + " · " + it.d.km + " km · " + it.d.sub) + "</title>" +
        (L && L.link ? '<line class="pt-link" x1="' + it.x.toFixed(1) + '" y1="' + it.y.toFixed(1) +
          '" x2="' + L.link[0].toFixed(1) + '" y2="' + L.link[1].toFixed(1) + '"/>' : "") +
        '<circle class="pt-dot" cx="' + it.x.toFixed(1) + '" cy="' + it.y.toFixed(1) + '" r="3.4"/>' +
        '<text class="pt-tip" x="' + tipX.toFixed(1) + '" y="' + tipY.toFixed(1) +
          '" text-anchor="' + (rightSide ? "end" : "start") + '">' + esc(it.d.name) + "</text>" +
        (L ? '<text class="pt-lbl" x="' + L.tx.toFixed(1) + '" y="' + L.ty.toFixed(1) +
          '" text-anchor="' + L.anchor + '">' + esc(it.d.name) + "</text>" : "") +
        "</g>";
    });

    s += '<g class="center" transform="translate(' + cx + "," + cy + ')"><circle r="6"/><text y="-16" text-anchor="middle">成都</text></g>';
    const svg = $("#radialSvg");
    svg.innerHTML = s;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.classList.toggle("is-focused", focusMode);
    renderRadialPanel(on, focusMode);
  }

  /** 右侧控制板：圈层按钮 + 风光按钮 + 亮起点清单（清单始终完整，不受标签避让影响）。 */
  function renderRadialPanel(list, focusMode) {
    const bandN = {};
    BANDS.forEach((b) => (bandN[b.key] = DEST.filter((d) =>
      bandOf(d.km) === b.key && (state.rCat === "all" || d.cat === state.rCat)).length));
    const catN = {};
    CATS.forEach((c) => (catN[c.key] = DEST.filter((d) =>
      d.cat === c.key && (state.rBand === "all" || bandOf(d.km) === state.rBand)).length));

    const band = BANDS.find((b) => b.key === state.rBand);
    const cat = state.rCat === "all" ? null : (CAT[state.rCat] || null);
    const status = focusMode
      ? "当前 · " + (band ? band.name + " " + bandLabel(band) : "全部圈层") +
        (cat ? " / " + cat.name : " / 全部风光") + " · 亮起 " + list.length + " 处"
      : "共 " + DEST.length + " 处 · 点一圈或选一类风光，只亮起对应地点";

    let html = '<div class="rl-head"><p class="legend-hint">距离圈层 · 点一圈看一段</p>' +
      '<button class="rl-reset" data-rband="all"' + (focusMode ? "" : " hidden") + ">显示全部</button></div>";

    html += '<div class="rl-bands">' + BANDS.map((b, i) =>
      '<button class="rl-band' + (state.rBand === b.key ? " is-on" : "") + '" data-rband="' + b.key +
      '" aria-pressed="' + (state.rBand === b.key) + '">' +
      '<span class="rl-band__no">' + (i + 1) + "</span>" +
      '<span class="rl-band__txt"><b>' + b.name + "</b><em>" + bandLabel(b) + "</em></span>" +
      '<span class="rl-band__n">' + bandN[b.key] + "</span></button>").join("") + "</div>";

    html += '<div class="rl-cats">' +
      '<button class="rl-cat' + (state.rCat === "all" ? " is-on" : "") + '" data-rcat="all">全部风光</button>' +
      CATS.map((c) => '<button class="rl-cat' + (state.rCat === c.key ? " is-on" : "") + '" data-rcat="' + c.key +
        '"><i style="background:' + catColor(c.key) + '"></i>' + c.name +
        "<small>" + catN[c.key] + "</small></button>").join("") + "</div>";

    html += '<p class="rl-status">' + status + "</p>";
    html += focusMode
      ? '<div class="rl-list">' + (list.length
        ? list.slice().sort((a, b) => a.km - b.km).map((d) =>
          '<button class="rl-row" data-rid="' + d.id + '"><i style="background:' + catColor(d.cat) + '"></i>' +
          '<span class="rl-row__name">' + esc(d.name) + "</span>" +
          '<span class="rl-row__km">' + fmt(d.km) + " km</span></button>").join("")
        : '<p class="rl-empty">这一段没有该风光的目的地，换个圈层或风光试试。</p>') + "</div>"
      : "";
    $("#radialLegend").innerHTML = html;
  }

  /* ---------------- 天气总览表 ---------------- */
  function tempColor(t) {
    const stops = [[-15, [44, 76, 124]], [-5, [78, 116, 150]], [5, [143, 178, 196]], [12, [200, 214, 208]], [18, [227, 206, 154]], [25, [216, 154, 90]], [33, [180, 71, 31]], [40, [140, 40, 20]]];
    if (t <= stops[0][0]) return "rgb(" + stops[0][1].join(",") + ")";
    for (let i = 0; i < stops.length - 1; i++) {
      const [t1, c1] = stops[i], [t2, c2] = stops[i + 1];
      if (t <= t2) {
        const k = (t - t1) / (t2 - t1);
        const c = c1.map((v, j) => Math.round(v + (c2[j] - v) * k));
        return "rgb(" + c.join(",") + ")";
      }
    }
    return "rgb(140,40,20)";
  }
  function textOn(rgb) {
    const m = rgb.match(/\d+/g).map(Number);
    const l = (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255;
    return l > 0.62 ? "#1B211C" : "#FBF8F0";
  }

  function renderWb(filterCat) {
    const list = (filterCat && filterCat !== "all") ? DEST.filter((d) => d.cat === filterCat) : DEST.slice();
    // 表头取所有点日期的并集，避免首条目的地缺某天时整列消失
    const dates = Array.from(new Set(DEST.flatMap((d) => d.weather.map((x) => x.date)))).sort();
    const WD = ["日", "一", "二", "三", "四", "五", "六"];
    const tKey = todayKey();
    let head = '<thead><tr><th class="dname" style="text-align:left">目的地</th>' +
      dates.map((dt) => {
        const dd = new Date(dt + "T00:00:00");
        const isToday = dt === tKey;
        const cls = "wd" + (isToday ? " is-today" : "") + (dt < tKey ? " is-past" : "");
        return '<th class="' + cls + '">' + (isToday ? "今天" : dt.slice(5).replace("-", "/")) +
          "<br><small>周" + WD[dd.getDay()] + "</small></th>";
      }).join("") + "</tr></thead>";

    let rows = "";
    (filterCat && filterCat !== "all" ? [filterCat] : CATS.map((c) => c.key)).forEach((ck) => {
      const group = list.filter((d) => d.cat === ck);
      if (!group.length) return;
      rows += '<tr class="wb-group"><td colspan="' + (dates.length + 1) + '">' +
        '<span class="wb-group__dot" style="background:' + catColor(ck) + '"></span>' +
        "<b>" + esc(CAT[ck] ? CAT[ck].name : ck) + "</b><em>" + group.length + " 处</em></td></tr>";
      group.forEach((d) => {
        rows += '<tr style="--rowcat:' + catColor(d.cat) + '"><td class="dname">' + esc(d.name) + "<small>" + esc(d.sub.split("·")[1] || d.sub) + "</small></td>";
        dates.forEach((dt) => {
          const w = d.weather.find((x) => x.date === dt);
          if (!w) {
            const last = d.weather[d.weather.length - 1];
            const tip = last
              ? d.name + " 的预报截至 " + last.date.slice(5).replace("-", "/") + "，最后一天无数据"
              : d.name + " 暂无预报数据";
            rows += '<td class="wb-cell wb-cell--na" style="background:#EEE7D8;color:#BCB09A" title="' +
              esc(tip) + '">—</td>';
            return;
          }
          const c = tempColor(w.tmax);
          const lbl = wx(w.day)[0];
          rows += '<td class="wb-cell" style="background:' + c + ";color:" + textOn(c) + '" title="' + esc(d.name + " " + dt + "｜" + lbl + "｜" + Math.round(w.tmin) + "~" + Math.round(w.tmax) + "°C｜降水 " + (w.precip === "-" ? "无" : w.precip) + "｜风 " + w.wind + " km/h") +
            '" data-id="' + d.id + '"><span>' + Math.round(w.tmax) + "°</span></td>";
        });
        rows += "</tr>";
      });
    });
    $("#wbTable").innerHTML = head + "<tbody>" + rows + "</tbody>";
  }

  /* ---------------- 事件 ---------------- */
  function bind() {
    document.addEventListener("click", (e) => {
      const fav = e.target.closest("[data-fav]");
      if (fav) {
        e.stopPropagation(); e.preventDefault();
        const id = fav.dataset.fav;
        if (state.fav.has(id)) { state.fav.delete(id); fav.classList.remove("is-on"); toast("已取消收藏"); }
        else { state.fav.add(id); fav.classList.add("is-on"); toast("已收藏 · 共 " + state.fav.size + " 条"); }
        try { localStorage.setItem("cdx-fav", JSON.stringify([...state.fav])); } catch (err) { }
        return;
      }
      const card = e.target.closest(".card");
      if (card) { openDrawer(card.dataset.id); return; }
      const pt = e.target.closest(".pt");
      if (pt) { openDrawer(pt.dataset.id); return; }
      // 方位距离图：环带 / 圈层按钮 / 风光按钮 / 清单行。点当前已选中的圈层再点一次可取消。
      const rb = e.target.closest("[data-rband]");
      if (rb) {
        const key = rb.dataset.rband;
        state.rBand = (key !== "all" && state.rBand === key) ? "all" : key;
        renderRadial();
        return;
      }
      const rc = e.target.closest("[data-rcat]");
      if (rc) {
        const key = rc.dataset.rcat;
        state.rCat = (key !== "all" && state.rCat === key) ? "all" : key;
        renderRadial();
        return;
      }
      const rrow = e.target.closest("[data-rid]");
      if (rrow) { openDrawer(rrow.dataset.rid); return; }
      const rel = e.target.closest("[data-rel]");
      if (rel) { openDrawer(rel.dataset.rel); return; }
      const cell = e.target.closest(".wb-cell");
      if (cell && cell.dataset.id) { openDrawer(cell.dataset.id); return; }
    });
    $("#dClose").addEventListener("click", closeDrawer);
    $("#scrim").addEventListener("click", closeDrawer);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { closeDrawer(); return; }
      // 环带本身可 Tab 聚焦，回车 / 空格等同于点击
      const t = e.target;
      if ((e.key === "Enter" || e.key === " ") && t && t.getAttribute && t.getAttribute("data-rband")) {
        e.preventDefault();
        const key = t.getAttribute("data-rband");
        state.rBand = (key !== "all" && state.rBand === key) ? "all" : key;
        renderRadial();
      }
    });
    // 清单行与图上点位互相高亮
    const crossHi = (id, on) => {
      if (!id) return;
      const p = $('#radialSvg .pt[data-id="' + id + '"]');
      if (p) p.classList.toggle("is-hi", on);
      const r = $('#radialLegend .rl-row[data-rid="' + id + '"]');
      if (r) r.classList.toggle("is-hi", on);
    };
    document.addEventListener("mouseover", (e) => {
      const el = e.target.closest && e.target.closest(".pt, [data-rid]");
      if (el) crossHi(el.dataset.id || el.dataset.rid, true);
    });
    document.addEventListener("mouseout", (e) => {
      const el = e.target.closest && e.target.closest(".pt, [data-rid]");
      if (!el) return;
      const to = e.relatedTarget;
      if (to && to.closest && to.closest(".pt, [data-rid]") === el) return;  // 组内移动不闪
      crossHi(el.dataset.id || el.dataset.rid, false);
    });

    // 天气总览分类
    $("#wbChips").innerHTML = '<button class="chip is-on" data-wc="all">全部</button>' +
      CATS.map((c) => '<button class="chip" data-wc="' + c.key + '">' + c.name + "</button>").join("");
    $("#wbChips").addEventListener("click", (e) => {
      const b = e.target.closest("[data-wc]"); if (!b) return;
      $$("#wbChips .chip").forEach((x) => x.classList.toggle("is-on", x === b));
      renderWb(b.dataset.wc);
    });
  }

  let toastT;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    requestAnimationFrame(() => t.classList.add("is-on"));
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.classList.remove("is-on"); setTimeout(() => (t.hidden = true), 350); }, 1600);
  }

  /* ---------------- 数据新鲜度 ---------------- */
  const DAY_MS = 86400000;

  function ymd(iso) {
    const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? [+m[1], +m[2], +m[3]] : null;
  }

  /** 数据日期距今天数；无法解析返回 null。 */
  function daysOld(iso) {
    const y = ymd(iso);
    if (!y) return null;
    const then = new Date(y[0], y[1] - 1, y[2]);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((now - then) / DAY_MS));
  }

  function mdLabel(iso) {
    const y = ymd(iso);
    return y ? y[1] + " 月 " + y[2] + " 日" : "";
  }

  function hmLabel(iso) {
    const m = String(iso || "").match(/T(\d{2}):(\d{2})/);
    return m ? m[1] + ":" + m[2] : "";
  }

  function renderFreshness() {
    const old = daysOld(WMETA.updated_date);
    const stamp = $("#dataStamp");
    const dot = $("#freshDot");
    const bar = $("#staleBar");
    const hm = hmLabel(WMETA.updated_at);

    if (old === null) {
      stamp.textContent = "meteoblue · 数据待更新";
      return;
    }

    if (old === 0) {
      dot.className = "dot";
      stamp.textContent = "meteoblue · 今日 " + (hm || "已更新");
      if (bar) bar.hidden = true;
      return;
    }

    dot.className = "dot " + (old >= 3 ? "dot--old" : "dot--warn");
    stamp.textContent = "meteoblue · " + mdLabel(WMETA.updated_date) + "更新（" + old + " 天前）";

    if (!bar) return;
    // 用户手动关掉后，当天不再打扰
    const key = "cddrive-hide-stale-" + WMETA.updated_date;
    let dismissed = false;
    try { dismissed = localStorage.getItem(key) === "1"; } catch (e) { /* 隐私模式下忽略 */ }
    if (dismissed) { bar.hidden = true; return; }

    $("#staleTitle").textContent = "天气数据停在 " + mdLabel(WMETA.updated_date) + "，已过期 " + old + " 天";
    $("#staleDesc").textContent = "未来 10 日预报每天都变，建议更新后再做行程判断。";
    bar.hidden = false;
    $("#staleClose").onclick = () => {
      bar.hidden = true;
      try { localStorage.setItem(key, "1"); } catch (e) { /* noop */ }
    };
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    if (!DEST.length) { $("#grid").innerHTML = '<p style="padding:40px">数据未加载</p>'; return; }
    const far = DEST.reduce((m, d) => Math.max(m, d.km), 0);
    const stamp = WMETA.updated_date || (DEST[0].weather[0] ? DEST[0].weather[0].date : "");
    const pretty = stamp ? stamp.replace(/(\d+)-(\d+)-(\d+)/, "$1 年 $2 月 $3 日") : "";
    const hm = hmLabel(WMETA.updated_at);
    $("#footStamp").textContent = "天气抓取于 " + pretty + (hm ? " " + hm : "");
    const wbStamp = $("#wbStamp");
    if (wbStamp) {
      const old2 = daysOld(WMETA.updated_date);
      // meteoblue 各坐标点的排期可能分两批（部分从昨天、部分从今天起算），以实际数据为准
      const starts = Array.from(new Set(DEST.map((d) => d.weather[0] && d.weather[0].date).filter(Boolean))).sort();
      const start = starts[0] || WMETA.forecast_start || "";
      const lag = start && start < todayKey();
      wbStamp.textContent = "数据更新于 " + pretty + (hm ? " " + hm : "") +
        (old2 ? "　·　已过期 " + old2 + " 天" : "　·　今日已更新") +
        (lag ? "　·　" + (starts.length > 1 ? "部分目的地" : "数据源") + "预报起始于 " +
          start.slice(5).replace("-", "/") + "，已过日期置灰" : "");
      if (old2) wbStamp.classList.add("is-old");
    }
    $("#heroYear").textContent = stamp.slice(0, 4) || "2026";
    renderFreshness();
    $("#statFar").textContent = fmt(far);
    $("#statCount").textContent = DEST.length;
    $("#statCats").textContent = CATS.length;

    buildChips();
    render();
    renderRadial();
    renderWb("all");
    bind();
    setupMotion();
  }

  function setupMotion() {
    if (!("IntersectionObserver" in window)) return;
    const secIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-revealing");
        secIO.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -50px 0px", threshold: 0.08 });
    $$(".sect-head").forEach((el, i) => {
      el.style.animationDelay = ((i % 3) * 80) + "ms";
      secIO.observe(el);
    });

    const links = $$(".nav a[href^='#']");
    const navIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.classList.toggle("is-current", a.getAttribute("href") === "#" + e.target.id));
      });
    }, { rootMargin: "-90px 0px -62% 0px" });
    ["atlas", "radial", "weather-board", "about"].forEach((id) => {
      const sec = document.getElementById(id);
      if (sec) navIO.observe(sec);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
