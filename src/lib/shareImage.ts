import { BRAND } from "../data/brand";
import { CATEGORY_BY_ID } from "../data/categories";
import { COUNTRY_OUTLINE, DISTRICTS, DISTRICT_BY_ID, MAP_HEIGHT, MAP_WIDTH } from "../data/districts";
import { localizeDigits, translate, type Lang, type StringKey } from "../i18n/strings";
import { computeStats, displayTitle, districtCategories, journeyPath, journeyStops, timeline } from "./mapModel";
import type { LifeMap } from "./types";

/* ---------- Options ---------- */

export type CardFormat = "post" | "story";
export type CardTheme = "paper" | "forest" | "night";

export const FORMATS: Record<CardFormat, { w: number; h: number }> = {
  post: { w: 1080, h: 1350 }, // 4:5, the largest a feed post gets on Facebook / Instagram
  story: { w: 1080, h: 1920 }, // 9:16, WhatsApp status / Facebook & Instagram stories
};

interface Theme {
  bg: string;
  glow: string;
  ink: string;
  ink2: string;
  muted: string;
  rule: string;
  land: string;
  border: string;
  shadow: string;
  eyebrow: string;
  pill: string;
  pillInk: string;
  journey: string;
  /** Category colours read well as text on light themes only. */
  colouredVerbs: boolean;
}

export const THEMES: Record<CardTheme, Theme & { swatch: string }> = {
  paper: {
    swatch: "#FAF6EF",
    bg: "#FAF6EF",
    glow: "#F1E6D2",
    ink: "#1D1B18",
    ink2: "#4A443C",
    muted: "#8A8175",
    rule: "#E6DCCB",
    land: "#E6DBC6",
    border: "#FAF6EF",
    shadow: "rgba(170,150,110,0.30)",
    eyebrow: "#0B5D3B",
    pill: "#0B5D3B",
    pillInk: "#FFFFFF",
    journey: "#D9473A",
    colouredVerbs: true,
  },
  forest: {
    swatch: "#0B4A32",
    bg: "#0B4A32",
    glow: "#11603F",
    ink: "#FFFFFF",
    ink2: "rgba(255,255,255,0.82)",
    muted: "rgba(255,255,255,0.58)",
    rule: "rgba(255,255,255,0.14)",
    land: "#F1E8D6",
    border: "#D5C6A8",
    shadow: "rgba(0,0,0,0.28)",
    eyebrow: "#F2C14E",
    pill: "#F2C14E",
    pillInk: "#1D1B18",
    journey: "#E4573D",
    colouredVerbs: false,
  },
  night: {
    swatch: "#16181D",
    bg: "#16181D",
    glow: "#252830",
    ink: "#FFFFFF",
    ink2: "rgba(255,255,255,0.8)",
    muted: "rgba(255,255,255,0.55)",
    rule: "rgba(255,255,255,0.12)",
    land: "#EEE5D3",
    border: "#CFC1A4",
    shadow: "rgba(0,0,0,0.4)",
    eyebrow: "#F2C14E",
    pill: "#F2C14E",
    pillInk: "#16181D",
    journey: "#F06A4E",
    colouredVerbs: false,
  },
};

const SITE_HOST: string = (import.meta.env.VITE_SITE_HOST as string | undefined) ?? location.host;
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const LABEL_INK = "#1D1B18";

/* ---------- Text helpers ---------- */

async function ensureFonts() {
  if (!("fonts" in document)) return;
  const loads = [
    document.fonts.load('600 64px "Fraunces"', "Bangladesh"),
    document.fonts.load('500 24px "Inter"', "Bangladesh"),
    document.fonts.load('600 24px "Inter"', "Bangladesh"),
    document.fonts.load('700 24px "Inter"', "Bangladesh"),
    // District names and titles may be Bangla in either UI language.
    document.fonts.load('500 24px "Noto Sans Bengali"', "বাংলাদেশ"),
    document.fonts.load('600 24px "Noto Sans Bengali"', "বাংলাদেশ"),
    document.fonts.load('700 60px "Noto Sans Bengali"', "বাংলাদেশ"),
  ];
  await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 2500))]);
}

/** "#RRGGBB" → same colour at alpha 0, so gradients fade without going grey. */
function transparent(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0)`;
}

const hasBangla = (s: string) => /[ঀ-৿]/.test(s);

function font(weight: number, size: number, text: string, display = false) {
  if (hasBangla(text)) return `${weight} ${size}px "Noto Sans Bengali", "Inter", sans-serif`;
  return display ? `${weight} ${size}px "Fraunces", Georgia, serif` : `${weight} ${size}px "Inter", "Noto Sans Bengali", sans-serif`;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth || !line) line = test;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = fit(ctx, `${kept[maxLines - 1]}…`, maxWidth);
  return kept;
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text.replace(/…$/, "");
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1);
  return `${s}…`;
}

function spaced(ctx: CanvasRenderingContext2D, px: number) {
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
}

/* ---------- Map ---------- */

type Box = { x: number; y: number; w: number; h: number };

function drawMap(ctx: CanvasRenderingContext2D, map: LifeMap, lang: Lang, box: Box, th: Theme, size: { badge: number; label: number }) {
  const s = Math.min(box.w / MAP_WIDTH, box.h / MAP_HEIGHT);
  const mw = MAP_WIDTH * s;
  const mh = MAP_HEIGHT * s;
  const mx = box.x + (box.w - mw) / 2;
  const my = box.y + (box.h - mh) / 2;
  const cats = districtCategories(map);

  // Soft glow behind the country
  const g = ctx.createRadialGradient(mx + mw / 2, my + mh / 2, 0, mx + mw / 2, my + mh / 2, Math.max(mw, mh) * 0.7);
  g.addColorStop(0, th.glow);
  g.addColorStop(1, transparent(th.glow));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.save();
  ctx.translate(mx, my);
  ctx.scale(s, s);
  const outline = new Path2D(COUNTRY_OUTLINE);
  ctx.save();
  ctx.translate(0, 7);
  ctx.fillStyle = th.shadow;
  ctx.fill(outline);
  ctx.restore();
  ctx.lineJoin = "round";
  for (const d of DISTRICTS) {
    const p = new Path2D(d.d);
    const c = cats.get(d.id);
    ctx.fillStyle = c?.length ? c[0].color : th.land;
    ctx.fill(p);
    ctx.strokeStyle = c?.length ? "rgba(255,255,255,0.55)" : th.border;
    ctx.lineWidth = 1.2 / s;
    ctx.stroke(p);
  }
  const jp = journeyPath(journeyStops(map));
  if (jp) {
    const path = new Path2D(jp);
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = (size.badge * 0.42) / s;
    ctx.stroke(path);
    ctx.strokeStyle = th.journey;
    ctx.lineWidth = (size.badge * 0.2) / s;
    ctx.stroke(path);
  }
  ctx.restore();

  // Badges + labels, constant size, placed to avoid each other.
  const r = size.badge;
  const pos = (id: string) => {
    const d = DISTRICT_BY_ID[id];
    return [mx + d.cx * s, my + d.cy * s] as const;
  };
  const chosen = [...cats.entries()].filter(([id, c]) => c.length && DISTRICT_BY_ID[id]);
  type B = { x0: number; y0: number; x1: number; y1: number };
  const placed: B[] = chosen.map(([id]) => {
    const [x, y] = pos(id);
    return { x0: x - r, y0: y - r, x1: x + r, y1: y + r };
  });
  const hit = (b: B) => placed.some((p) => !(b.x1 < p.x0 || b.x0 > p.x1 || b.y1 < p.y0 || b.y0 > p.y1));

  for (const [id, list] of chosen) {
    const [x, y] = pos(id);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.arc(x, y + r * 0.14, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = list[0].color;
    ctx.lineWidth = r * 0.16;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = `${Math.round(r * 1.05)}px ${EMOJI_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = LABEL_INK;
    ctx.fillText(list[0].emoji, x, y + r * 0.06);
    if (list.length > 1) {
      const cx = x + r * 0.82;
      const cy = y - r * 0.82;
      ctx.fillStyle = "#1D1B18";
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = r * 0.12;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.52, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.font = `700 ${Math.round(r * 0.66)}px "Inter", sans-serif`;
      ctx.fillStyle = "#fff";
      ctx.fillText(String(list.length), cx, cy + r * 0.03);
    }
  }

  const fs = size.label;
  const sorted = [...chosen].sort((a, b) => b[1].length - a[1].length || a[1][0].priority - b[1][0].priority);
  ctx.textBaseline = "alphabetic";
  for (const [id] of sorted) {
    const d = DISTRICT_BY_ID[id];
    const [x, y] = pos(id);
    const name = lang === "bn" ? d.nameBn : d.nameEn;
    ctx.font = font(700, fs, name);
    const w = ctx.measureText(name).width;
    const h = fs * 1.15;
    const gap = r * 0.35;
    const options = [
      { x, y: y + r + gap + fs * 0.85, align: "center" as const, b: { x0: x - w / 2, y0: y + r + gap, x1: x + w / 2, y1: y + r + gap + h } },
      { x, y: y - r - gap - fs * 0.25, align: "center" as const, b: { x0: x - w / 2, y0: y - r - gap - h, x1: x + w / 2, y1: y - r - gap } },
      { x: x + r + gap, y: y + fs * 0.35, align: "left" as const, b: { x0: x + r + gap, y0: y - h / 2, x1: x + r + gap + w, y1: y + h / 2 } },
      { x: x - r - gap, y: y + fs * 0.35, align: "right" as const, b: { x0: x - r - gap - w, y0: y - h / 2, x1: x - r - gap, y1: y + h / 2 } },
    ];
    const o = options.find((o) => o.b.x0 >= box.x - 30 && o.b.x1 <= box.x + box.w + 30 && !hit(o.b));
    if (!o) continue;
    placed.push(o.b);
    ctx.textAlign = o.align;
    ctx.lineJoin = "round";
    ctx.strokeStyle = th.land;
    ctx.lineWidth = fs * 0.32;
    ctx.strokeText(name, o.x, o.y);
    ctx.fillStyle = LABEL_INK;
    ctx.fillText(name, o.x, o.y);
  }
  ctx.textAlign = "left";
}

/* ---------- Blocks ---------- */

function drawHeader(ctx: CanvasRenderingContext2D, map: LifeMap, lang: Lang, th: Theme, x: number, y: number, w: number, titleSize: number) {
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 ${Math.round(titleSize * 0.27)}px "Inter", sans-serif`;
  ctx.fillStyle = th.eyebrow;
  spaced(ctx, titleSize * 0.06);
  ctx.fillText("🇧🇩  MY BANGLADESH", x, y + titleSize * 0.27);
  spaced(ctx, 0);

  const title = displayTitle(map, lang);
  const weight = hasBangla(title) ? 700 : 600;
  let size = titleSize;
  ctx.font = font(weight, size, title, true);
  let lines = wrap(ctx, title, w, 2);
  // Prefer one slightly smaller line over two big ones; otherwise keep two lines at full size.
  if (lines.length > 1) {
    for (let s2 = titleSize - 4; s2 >= titleSize * 0.74; s2 -= 4) {
      ctx.font = font(weight, s2, title, true);
      if (ctx.measureText(title).width <= w) {
        size = s2;
        lines = [title];
        break;
      }
    }
    ctx.font = font(weight, size, title, true);
  }
  ctx.fillStyle = th.ink;
  let cy = y + titleSize * 0.27 + size * 1.25;
  lines.forEach((l, i) => {
    if (i) cy += size * 1.12;
    ctx.fillText(l, x, cy);
  });
  const sub = translate(lang, "card.subtitle");
  const subSize = Math.round(titleSize * 0.36);
  ctx.font = font(500, subSize, sub);
  ctx.fillStyle = th.ink2;
  cy += subSize * 1.9;
  ctx.fillText(sub, x, cy);
  return cy + subSize * 0.6;
}

interface Item {
  year?: number;
  name: string;
  verb: string;
  emoji: string;
  color: string;
  tint: string;
}

function items(map: LifeMap, lang: Lang): Item[] {
  return timeline(map).map((e) => {
    const c = CATEGORY_BY_ID[e.category];
    const d = DISTRICT_BY_ID[e.districtId];
    return { year: e.year, name: lang === "bn" ? d.nameBn : d.nameEn, verb: c.verb[lang], emoji: c.emoji, color: c.color, tint: c.tint };
  });
}

/** Timeline rows: emoji dot, place name, "Verb · year". Returns the y after the last row. */
function drawTimeline(ctx: CanvasRenderingContext2D, list: Item[], lang: Lang, th: Theme, box: Box, rowH: number, cols = 1) {
  const t = (k: StringKey, v?: Record<string, string | number>) => translate(lang, k, v);
  const heading = t("card.journey");
  const hs = Math.round(rowH * 0.36);
  ctx.font = font(700, hs, heading);
  ctx.fillStyle = th.eyebrow;
  spaced(ctx, hasBangla(heading) ? 0 : hs * 0.12);
  ctx.fillText(hasBangla(heading) ? heading : heading.toUpperCase(), box.x, box.y + hs);
  spaced(ctx, 0);

  const top = box.y + hs + rowH * 0.45;
  const perCol = Math.max(1, Math.floor((box.y + box.h - top) / rowH));
  const capacity = perCol * cols;
  const overflow = list.length > capacity ? list.length - (capacity - 1) : 0;
  const shown = overflow ? list.slice(0, capacity - 1) : list;
  const colW = box.w / cols;
  const r = rowH * 0.3;

  shown.forEach((it, i) => {
    const col = Math.floor(i / perCol);
    const row = i % perCol;
    const x = box.x + col * colW;
    const y = top + row * rowH;
    const cx = x + r;
    const cy = y + r;
    // connector
    const nextInCol = i + 1 < shown.length && Math.floor((i + 1) / perCol) === col;
    if (nextInCol) {
      ctx.strokeStyle = th.rule;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy + r);
      ctx.lineTo(cx, cy + rowH - r);
      ctx.stroke();
    }
    ctx.fillStyle = th.colouredVerbs ? it.tint : "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${Math.round(r * 1.05)}px ${EMOJI_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = LABEL_INK;
    ctx.fillText(it.emoji, cx, cy + r * 0.06);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    const tx = x + r * 2 + rowH * 0.22;
    const tw = colW - (tx - x) - 12;
    const ns = Math.round(rowH * 0.4);
    ctx.font = font(700, ns, it.name);
    ctx.fillStyle = th.ink;
    ctx.fillText(fit(ctx, it.name, tw), tx, y + ns * 0.95);
    const meta = it.year ? `${it.verb} · ${localizeDigits(it.year, lang)}` : it.verb;
    const ms = Math.round(rowH * 0.29);
    ctx.font = font(600, ms, meta);
    ctx.fillStyle = th.colouredVerbs ? it.color : th.ink2;
    ctx.fillText(fit(ctx, meta, tw), tx, y + ns * 0.95 + ms * 1.35);
  });

  if (overflow) {
    const i = shown.length;
    const col = Math.floor(i / perCol);
    const row = i % perCol;
    const x = box.x + col * colW;
    const y = top + row * rowH;
    const label = t("card.more", { n: overflow });
    ctx.font = font(600, Math.round(rowH * 0.3), label);
    ctx.fillStyle = th.muted;
    ctx.fillText(label, x + r * 2 + rowH * 0.22, y + r + rowH * 0.1);
  }
  const rowsUsed = Math.min(perCol, shown.length + (overflow ? 1 : 0));
  return top + rowsUsed * rowH;
}

function drawQuote(ctx: CanvasRenderingContext2D, map: LifeMap, lang: Lang, th: Theme, box: Box, size: number) {
  const place = map.places[0];
  const text = map.quote?.trim() || place?.text;
  if (!text) return;
  const d = map.quote?.trim() ? null : DISTRICT_BY_ID[place.districtId];
  ctx.font = font(500, size, text);
  const lines = wrap(ctx, `“${text}”`, box.w - size, 3);
  const need = lines.length * size * 1.35 + size * 1.6;
  if (need > box.h) return;
  ctx.fillStyle = th.journey;
  ctx.fillRect(box.x, box.y, Math.max(3, size * 0.14), need - size * 0.3);
  ctx.fillStyle = th.ink;
  lines.forEach((l, i) => ctx.fillText(l, box.x + size * 0.8, box.y + size * 1.05 + i * size * 1.35));
  const who = d ? `— ${lang === "bn" ? d.nameBn : d.nameEn}` : `— ${displayTitle(map, lang)}`;
  ctx.font = font(600, Math.round(size * 0.8), who);
  ctx.fillStyle = th.muted;
  ctx.fillText(who, box.x + size * 0.8, box.y + size * 1.05 + lines.length * size * 1.35 + size * 0.15);
}

function drawStats(ctx: CanvasRenderingContext2D, map: LifeMap, lang: Lang, th: Theme, x: number, y: number, w: number, numSize: number) {
  const st = computeStats(map);
  const cells = [
    { n: st.districts, label: translate(lang, "card.districts") },
    { n: st.divisions, label: translate(lang, "card.divisions") },
    { n: st.chapters, label: translate(lang, "card.chapters") },
  ];
  ctx.strokeStyle = th.rule;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
  const cw = w / cells.length;
  cells.forEach((c, i) => {
    const cx = x + i * cw;
    const num = localizeDigits(c.n, lang);
    ctx.font = font(600, numSize, num, true);
    ctx.fillStyle = th.ink;
    ctx.fillText(num, cx, y + numSize * 1.25);
    const ls = Math.round(numSize * 0.34);
    ctx.font = font(500, ls, c.label);
    ctx.fillStyle = th.ink2;
    ctx.fillText(c.label, cx, y + numSize * 1.25 + ls * 1.5);
    if (i > 0) {
      ctx.beginPath();
      ctx.moveTo(cx - 24, y + numSize * 0.4);
      ctx.lineTo(cx - 24, y + numSize * 1.25 + ls * 1.6);
      ctx.stroke();
    }
  });
  return y + numSize * 1.25 + numSize * 0.34 * 1.6;
}

function drawFooter(ctx: CanvasRenderingContext2D, lang: Lang, th: Theme, x: number, y: number, w: number, size: number) {
  const q = translate(lang, "card.question");
  ctx.font = font(700, size, q);
  const qw = ctx.measureText(q).width;
  // Pill with the invitation
  const ph = size * 1.9;
  ctx.fillStyle = th.pill;
  ctx.beginPath();
  ctx.roundRect(x, y - ph, qw + size * 1.6, ph, ph / 2);
  ctx.fill();
  ctx.fillStyle = th.pillInk;
  ctx.fillText(q, x + size * 0.8, y - ph / 2 + size * 0.36);

  // Right side: the site address, and the maker's credit under it.
  const showHost = SITE_HOST && !/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(SITE_HOST);
  const mid = y - ph / 2;
  ctx.textAlign = "right";
  if (showHost) {
    // The address people should type: bold and in ink, not faint grey.
    ctx.font = `700 ${Math.round(size * 0.88)}px "Inter", sans-serif`;
    ctx.fillStyle = th.ink;
    ctx.fillText(`👉 ${SITE_HOST}`, x + w, mid - size * 0.12);
  }
  const by = showHost ? mid + size * 0.95 : mid + size * 0.3;
  ctx.font = `700 ${Math.round(size * 0.72)}px "Inter", sans-serif`;
  ctx.fillStyle = th.ink2;
  ctx.fillText(BRAND.name, x + w, by);
  const bw = ctx.measureText(BRAND.name).width;
  ctx.font = `500 ${Math.round(size * 0.72)}px "Inter", sans-serif`;
  ctx.fillStyle = th.muted;
  ctx.fillText("Powered by ", x + w - bw, by);
  ctx.textAlign = "left";
}

/* ---------- Layouts ---------- */

function layoutPost(ctx: CanvasRenderingContext2D, map: LifeMap, lang: Lang, th: Theme) {
  const { w: W, h: H } = FORMATS.post;
  const P = 72;
  const headerBottom = drawHeader(ctx, map, lang, th, P, P, W - P * 2, 78);
  const footerTop = H - 250;
  const mapBox = { x: P - 30, y: headerBottom, w: 540, h: footerTop - headerBottom - 10 };
  drawMap(ctx, map, lang, mapBox, th, { badge: 17, label: 21 });

  const col = { x: 610, y: headerBottom + 20, w: W - P - 610, h: footerTop - headerBottom - 40 };
  const list = items(map, lang);
  const hasQuote = !!(map.quote?.trim() || map.places.length);
  const end = drawTimeline(ctx, list, lang, th, { ...col, h: hasQuote ? col.h - 150 : col.h }, 70);
  drawQuote(ctx, map, lang, th, { x: col.x, y: end + 20, w: col.w, h: col.y + col.h - end - 10 }, 24);

  drawStats(ctx, map, lang, th, P, footerTop + 10, W - P * 2, 58);
  drawFooter(ctx, lang, th, P, H - P + 18, W - P * 2, 24);
}

function layoutStory(ctx: CanvasRenderingContext2D, map: LifeMap, lang: Lang, th: Theme) {
  const { w: W, h: H } = FORMATS.story;
  const P = 80;
  const headerBottom = drawHeader(ctx, map, lang, th, P, P + 30, W - P * 2, 92);
  const mapBox = { x: P, y: headerBottom + 10, w: W - P * 2, h: 780 };
  drawMap(ctx, map, lang, mapBox, th, { badge: 22, label: 27 });

  const footerTop = H - 270;
  const tlTop = mapBox.y + mapBox.h + 40;
  const list = items(map, lang);
  const quoteSpace = map.quote?.trim() || map.places.length ? 130 : 0;
  const end = drawTimeline(ctx, list, lang, th, { x: P, y: tlTop, w: W - P * 2, h: footerTop - tlTop - quoteSpace - 20 }, 78, 2);
  drawQuote(ctx, map, lang, th, { x: P, y: end + 16, w: W - P * 2, h: footerTop - end - 30 }, 28);

  drawStats(ctx, map, lang, th, P, footerTop + 10, W - P * 2, 66);
  drawFooter(ctx, lang, th, P, H - P + 10, W - P * 2, 27);
}

/** Draws the shareable image and returns it as a high-quality JPEG (about 3× smaller than PNG for sending on mobile data). */
export async function renderShareCard(map: LifeMap, lang: Lang, format: CardFormat = "post", theme: CardTheme = "paper"): Promise<Blob> {
  await ensureFonts();
  const { w, h } = FORMATS[format];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const th = THEMES[theme];
  ctx.fillStyle = th.bg;
  ctx.fillRect(0, 0, w, h);
  if (format === "story") layoutStory(ctx, map, lang, th);
  else layoutPost(ctx, map, lang, th);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.93));
}
