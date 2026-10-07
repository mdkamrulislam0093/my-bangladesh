import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Category } from "../data/categories";
import { COUNTRY_OUTLINE, DISTRICTS, DISTRICT_BY_ID, MAP_HEIGHT as H, MAP_WIDTH as W } from "../data/districts";
import type { Lang } from "../i18n/strings";
import { journeyPath } from "../lib/mapModel";

export interface MapHandle {
  zoomIn(): void;
  zoomOut(): void;
  reset(): void;
  focus(districtId: string, zoom?: number): void;
}

interface Props {
  categories: Map<string, Category[]>;
  lang: Lang;
  selectedId?: string | null;
  highlightId?: string | null;
  onSelect?: (districtId: string) => void;
  /** Pan / pinch / wheel zoom. Static maps leave page scrolling alone. */
  interactive?: boolean;
  journey?: string[];
  showJourney?: boolean;
  /** Show district names next to badges. */
  labels?: boolean;
  /** Show emoji badges on chosen districts. */
  badges?: boolean;
  /** Reveal the outline gently on mount. */
  className?: string;
  ariaLabel?: string;
  onViewChange?: (zoom: number) => void;
  /**
   * For a map that sits inside a scrolling page: at normal zoom one finger scrolls
   * the page (taps still select); once zoomed in, one finger pans the map.
   */
  scrollFriendly?: boolean;
}

type View = { x: number; y: number; k: number };
const MIN_K = 1;
const MAX_K = 8;
const IDENTITY: View = { x: 0, y: 0, k: 1 };

function clampView(v: View): View {
  const k = Math.min(MAX_K, Math.max(MIN_K, v.k));
  const minX = W - W * k;
  const minY = H - H * k;
  return { k, x: Math.min(0, Math.max(minX, v.x)), y: Math.min(0, Math.max(minY, v.y)) };
}

/* ---------- District fills (memoised: does not re-render while panning) ---------- */

const DistrictLayer = memo(function DistrictLayer({
  categories,
  hoverId,
  interactive,
  lang,
  onKeySelect,
}: {
  categories: Map<string, Category[]>;
  hoverId: string | null;
  interactive: boolean;
  lang: Lang;
  onKeySelect?: (id: string) => void;
}) {
  return (
    <g>
      {DISTRICTS.map((d) => {
        const cats = categories.get(d.id);
        const fill = cats?.length ? cats[0].color : hoverId === d.id ? "var(--color-land-hover)" : "var(--color-land)";
        const name = lang === "bn" ? d.nameBn : d.nameEn;
        return (
          <path
            key={d.id}
            d={d.d}
            data-id={d.id}
            className="district"
            fill={fill}
            fillOpacity={cats?.length && hoverId === d.id ? 0.85 : 1}
            stroke="var(--color-paper)"
            strokeWidth={0.9}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            {...(interactive && onKeySelect
              ? {
                  role: "button",
                  tabIndex: 0,
                  "aria-label": name,
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onKeySelect(d.id);
                    }
                  },
                }
              : {})}
          >
            {!interactive && <title>{name}</title>}
          </path>
        );
      })}
    </g>
  );
});

/* ---------- Main component ---------- */

export const BangladeshMap = forwardRef<MapHandle, Props>(function BangladeshMap(
  {
    categories,
    lang,
    selectedId,
    highlightId,
    onSelect,
    interactive = false,
    journey = [],
    showJourney = false,
    labels = false,
    badges = true,
    className = "",
    ariaLabel,
    onViewChange,
    scrollFriendly = false,
  },
  ref,
) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>(IDENTITY);
  const viewRef = useRef(view);
  viewRef.current = view;
  const [hoverId, setHoverId] = useState<string | null>(null);
  // Screen pixels per viewBox unit, so badges and labels stay a constant on-screen size.
  const [scale, setScale] = useState(0.6);
  const animRef = useRef<number>(0);

  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) setScale(Math.min(r.width / W, r.height / H));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    onViewChange?.(view.k);
  }, [view.k, onViewChange]);

  const animateTo = useCallback((target: View) => {
    cancelAnimationFrame(animRef.current);
    const from = viewRef.current;
    const to = clampView(target);
    const start = performance.now();
    const dur = 420;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      setView({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, k: from.k + (to.k - from.k) * e });
      if (t < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  }, []);

  const zoomAround = useCallback((v: View, k2: number, qx: number, qy: number): View => {
    const k = Math.min(MAX_K, Math.max(MIN_K, k2));
    return clampView({ k, x: qx - ((qx - v.x) * k) / v.k, y: qy - ((qy - v.y) * k) / v.k });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => animateTo(zoomAround(viewRef.current, viewRef.current.k * 1.6, W / 2, H / 2)),
      zoomOut: () => animateTo(zoomAround(viewRef.current, viewRef.current.k / 1.6, W / 2, H / 2)),
      reset: () => animateTo(IDENTITY),
      focus: (id, zoom = 2.6) => {
        const d = DISTRICT_BY_ID[id];
        if (!d) return;
        const k = Math.max(viewRef.current.k, zoom);
        animateTo({ k, x: W / 2 - d.cx * k, y: H / 2 - d.cy * k });
      },
    }),
    [animateTo, zoomAround],
  );

  /* ----- Pointer gestures: one finger pans, two pinch, a still tap selects ----- */

  const gesture = useRef({
    pointers: new Map<number, { x: number; y: number }>(),
    startX: 0,
    startY: 0,
    moved: 0,
    multi: false,
    downId: null as string | null,
    lastPinch: 0,
  });

  /** Client px → viewBox units (accounting for preserveAspectRatio meet letterboxing). */
  const toViewBox = useCallback((clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    const s = Math.min(r.width / W, r.height / H);
    const ox = (r.width - W * s) / 2;
    const oy = (r.height - H * s) / 2;
    return { x: (clientX - r.left - ox) / s, y: (clientY - r.top - oy) / s, s };
  }, []);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // A new primary pointer means every earlier touch has ended, even if an
    // in-app browser swallowed its pointerup. Drop stale ones so taps keep working.
    if (e.isPrimary) g.pointers.clear();
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.pointers.size === 1) {
      g.startX = e.clientX;
      g.startY = e.clientY;
      g.moved = 0;
      g.multi = false;
      g.downId = (e.target as Element).getAttribute?.("data-id");
    } else {
      g.multi = true;
      const [a, b] = [...g.pointers.values()];
      g.lastPinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
    if (interactive) {
      cancelAnimationFrame(animRef.current);
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    const prev = g.pointers.get(e.pointerId);
    if (!prev) {
      if (e.pointerType === "mouse") {
        const id = (e.target as Element).getAttribute?.("data-id");
        setHoverId(id ?? null);
      }
      return;
    }
    g.moved = Math.max(g.moved, Math.hypot(e.clientX - g.startX, e.clientY - g.startY));
    const cur = { x: e.clientX, y: e.clientY };
    if (!interactive) {
      g.pointers.set(e.pointerId, cur);
      return;
    }
    if (g.pointers.size === 1 && g.moved > 4) {
      const { s } = toViewBox(0, 0);
      const dx = (cur.x - prev.x) / s;
      const dy = (cur.y - prev.y) / s;
      setView((v) => clampView({ ...v, x: v.x + dx, y: v.y + dy }));
    }
    g.pointers.set(e.pointerId, cur);
    if (g.pointers.size === 2) {
      const [a, b] = [...g.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = toViewBox((a.x + b.x) / 2, (a.y + b.y) / 2);
      if (g.lastPinch > 0) {
        const ratio = dist / g.lastPinch;
        setView((v) => zoomAround(v, v.k * ratio, mid.x, mid.y));
      }
      g.lastPinch = dist;
    }
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    const wasSingle = g.pointers.size === 1 && !g.multi;
    g.pointers.delete(e.pointerId);
    if (g.pointers.size < 2) g.lastPinch = 0;
    if (wasSingle && g.moved < 8 && g.downId && onSelect) onSelect(g.downId);
    if (g.pointers.size === 0) g.downId = null;
  };

  // The browser took over the touch (e.g. to scroll the page): forget it, never select.
  const onPointerCancel = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    g.pointers.delete(e.pointerId);
    if (g.pointers.size < 2) g.lastPinch = 0;
    g.downId = null;
  };

  // Wheel / trackpad zoom must be a non-passive listener to stop page scroll.
  useEffect(() => {
    const el = svgRef.current;
    if (!el || !interactive) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const q = toViewBox(e.clientX, e.clientY);
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022));
      setView((v) => zoomAround(v, v.k * factor, q.x, q.y));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [interactive, toViewBox, zoomAround]);

  /* ----- Overlay geometry (unscaled layer, positioned by hand) ----- */

  const px = (n: number) => n / scale; // screen px → viewBox units
  const project = (cx: number, cy: number) => [view.x + cx * view.k, view.y + cy * view.k] as const;

  const chosen = useMemo(() => [...categories.entries()].filter(([, c]) => c.length), [categories]);

  type Placement = { x: number; y: number; anchor: "middle" | "start" | "end" };
  const labelPlacements = useMemo(() => {
    const out = new Map<string, Placement>();
    if (!labels) return out;
    // Greedy collision avoidance: districts with more meaning are placed first, and each
    // label tries below / above / right / left of its badge before giving up.
    const fs = 12 / scale;
    const r = 10.5 / scale;
    const gap = 3 / scale;
    type Box = { x0: number; y0: number; x1: number; y1: number };
    const overlaps = (a: Box, b: Box) => !(a.x1 < b.x0 || a.x0 > b.x1 || a.y1 < b.y0 || a.y0 > b.y1);
    const centre = (id: string) => {
      const d = DISTRICT_BY_ID[id];
      return [view.x + d.cx * view.k, view.y + d.cy * view.k] as const;
    };
    const placed: Box[] = chosen.map(([id]) => {
      const [x, y] = centre(id);
      return { x0: x - r, y0: y - r, x1: x + r, y1: y + r };
    });
    const sorted = [...chosen].sort((a, b) => b[1].length - a[1].length || a[1][0].priority - b[1][0].priority);
    for (const [id] of sorted) {
      const d = DISTRICT_BY_ID[id];
      if (!d) continue;
      const [x, y] = centre(id);
      const name = lang === "bn" ? d.nameBn : d.nameEn;
      const w = name.length * fs * (lang === "bn" ? 0.62 : 0.56);
      const h = fs * 1.2;
      const options: (Placement & { box: Box })[] = [
        { x, y: y + r + gap + fs * 0.9, anchor: "middle", box: { x0: x - w / 2, y0: y + r + gap, x1: x + w / 2, y1: y + r + gap + h } },
        { x, y: y - r - gap - fs * 0.25, anchor: "middle", box: { x0: x - w / 2, y0: y - r - gap - h, x1: x + w / 2, y1: y - r - gap } },
        { x: x + r + gap, y: y + fs * 0.35, anchor: "start", box: { x0: x + r + gap, y0: y - h / 2, x1: x + r + gap + w, y1: y + h / 2 } },
        { x: x - r - gap, y: y + fs * 0.35, anchor: "end", box: { x0: x - r - gap - w, y0: y - h / 2, x1: x - r - gap, y1: y + h / 2 } },
      ];
      const fit = options.find((o) => o.box.x0 >= 0 && o.box.x1 <= W && o.box.y1 <= H && !placed.some((p) => overlaps(o.box, p)));
      if (fit) {
        placed.push(fit.box);
        out.set(id, { x: fit.x, y: fit.y, anchor: fit.anchor });
      }
    }
    return out;
  }, [labels, chosen, view, scale, lang]);

  const jPath = useMemo(() => (showJourney ? journeyPath(journey) : ""), [showJourney, journey]);
  const transform = `translate(${view.x} ${view.y}) scale(${view.k})`;
  const selected = selectedId ? DISTRICT_BY_ID[selectedId] : null;
  const highlighted = highlightId ? DISTRICT_BY_ID[highlightId] : null;
  const hovered = hoverId ? DISTRICT_BY_ID[hoverId] : null;

  return (
    <div className={`relative ${className}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-full w-full select-none"
        style={{ touchAction: !interactive ? "manipulation" : scrollFriendly && view.k < 1.02 ? "pan-y" : "none" }}
        role="img"
        aria-label={ariaLabel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={() => setHoverId(null)}
      >
        <g transform={transform}>
          {/* Soft paper shadow under the country */}
          <path d={COUNTRY_OUTLINE} fill="#d9ccb3" opacity={0.55} transform="translate(0 5)" />
          <DistrictLayer
            categories={categories}
            hoverId={onSelect ? hoverId : null}
            interactive={interactive}
            lang={lang}
            onKeySelect={onSelect}
          />
          <path
            d={COUNTRY_OUTLINE}
            fill="none"
            stroke="#c9b893"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
          {highlighted && (
            <path
              d={highlighted.d}
              fill="var(--color-red)"
              fillOpacity={0.18}
              stroke="var(--color-red)"
              strokeWidth={2}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )}
          {selected && (
            <path
              d={selected.d}
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth={2.2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )}
          {jPath && (
            <g pointerEvents="none" key={jPath}>
              <path
                d={jPath}
                fill="none"
                stroke="#fff"
                strokeWidth={5}
                strokeOpacity={0.7}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                pathLength={1}
                className="journey-draw"
              />
              <path
                d={jPath}
                fill="none"
                stroke="var(--color-red)"
                strokeWidth={2.4}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                pathLength={1}
                className="journey-draw"
              />
            </g>
          )}
        </g>

        {/* Overlay: constant on-screen size regardless of zoom */}
        <g pointerEvents="none">
          {highlighted && (
            <circle
              cx={project(highlighted.cx, highlighted.cy)[0]}
              cy={project(highlighted.cx, highlighted.cy)[1]}
              r={px(10)}
              fill="var(--color-red)"
              className="pulse-ring"
            />
          )}
          {badges &&
            chosen.map(([id, cats]) => {
              const d = DISTRICT_BY_ID[id];
              if (!d) return null;
              const [x, y] = project(d.cx, d.cy);
              const r = px(10.5);
              const name = lang === "bn" ? d.nameBn : d.nameEn;
              return (
                <g key={id} className="animate-pop" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
                  <circle cx={x} cy={y + px(1)} r={r} fill="#000" opacity={0.12} />
                  <circle cx={x} cy={y} r={r} fill="#fff" stroke={cats[0].color} strokeWidth={px(1.6)} />
                  <text x={x} y={y + px(4.2)} fontSize={px(11.5)} textAnchor="middle">
                    {cats[0].emoji}
                  </text>
                  {cats.length > 1 && (
                    <g>
                      <circle cx={x + r * 0.85} cy={y - r * 0.85} r={px(6.5)} fill="var(--color-ink)" stroke="#fff" strokeWidth={px(1.2)} />
                      <text
                        x={x + r * 0.85}
                        y={y - r * 0.85 + px(3)}
                        fontSize={px(8.5)}
                        fontWeight={700}
                        fill="#fff"
                        textAnchor="middle"
                        fontFamily="Inter, sans-serif"
                      >
                        {cats.length}
                      </text>
                    </g>
                  )}
                  {labelPlacements.has(id) && (
                    <text
                      x={labelPlacements.get(id)!.x}
                      y={labelPlacements.get(id)!.y}
                      fontSize={px(12)}
                      fontWeight={600}
                      textAnchor={labelPlacements.get(id)!.anchor}
                      fill="var(--color-ink)"
                      stroke="var(--color-paper)"
                      strokeWidth={px(3)}
                      paintOrder="stroke"
                      strokeLinejoin="round"
                    >
                      {name}
                    </text>
                  )}
                </g>
              );
            })}
        </g>
      </svg>

      {interactive && hovered && (
        <div className="pointer-events-none absolute left-1/2 top-3 hidden -translate-x-1/2 rounded-full bg-ink/90 px-3 py-1 text-sm font-medium text-white shadow-soft md:block">
          {lang === "bn" ? hovered.nameBn : hovered.nameEn}
        </div>
      )}
    </div>
  );
});
