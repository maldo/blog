import { pick, randInt, rngFromSeed, sanitizeSeed } from "./random";
import { SHAPE_BOX, type Shape, findShape, shapes } from "./shapes";

// ---- Path sampling -------------------------------------------------------

export interface Point {
	x: number;
	y: number;
}

/** What we need from the browser: the length of a path and the point at a distance along it. */
export interface PathMeasure {
	length: number;
	pointAt(distance: number): Point;
}
/** Supplied by the page (an SVGPathElement wrapper), because getPointAtLength needs a DOM. */
export type PathMeasurer = (pathData: string) => PathMeasure;

/** `count` points spaced evenly along a closed path. The first point is not repeated at the end. */
export function samplePath(pathData: string, count: number, measure: PathMeasurer): Point[] {
	const path = measure(pathData);
	return Array.from({ length: count }, (_, i) => path.pointAt((path.length * i) / count));
}

// ---- Numbering -----------------------------------------------------------

export type NumberingMode = "count" | "skip2" | "skip5" | "alphabet" | "backwards";

export const NUMBERING_MODES: { id: NumberingMode; label: string }[] = [
	{ id: "count", label: "1, 2, 3…" },
	{ id: "skip2", label: "By 2s" },
	{ id: "skip5", label: "By 5s" },
	{ id: "alphabet", label: "A, B, C…" },
	{ id: "backwards", label: "Backwards" },
];

export const DOT_COUNTS = [10, 25, 50, 100];

export function isModeAvailable(mode: NumberingMode, dots: number): boolean {
	return mode !== "alphabet" || dots <= 26;
}

/** Labels in connecting order: the first label goes on the dot you start from. */
export function labelsFor(mode: NumberingMode, dots: number): string[] {
	return Array.from({ length: dots }, (_, i) => {
		switch (mode) {
			case "skip2":
				return String((i + 1) * 2);
			case "skip5":
				return String((i + 1) * 5);
			case "alphabet":
				return String.fromCharCode(65 + i);
			case "backwards":
				return String(dots - i);
			default:
				return String(i + 1);
		}
	});
}

// ---- Label placement -----------------------------------------------------

export interface Dot extends Point {
	label: string;
	/** Label centre and size. */
	lx: number;
	ly: number;
	lw: number;
	lh: number;
	/** True when collision nudging pushed the label far enough to deserve a leader line. */
	leader: boolean;
}

interface Layout {
	fontSize: number;
	radius: number;
}

function layoutFor(dots: number): Layout {
	if (dots <= 10) return { fontSize: 24, radius: 7 };
	if (dots <= 25) return { fontSize: 19, radius: 5.5 };
	if (dots <= 50) return { fontSize: 14, radius: 4 };
	return { fontSize: 10.5, radius: 3 };
}

/** Positive when the outline runs clockwise on screen (y points down). */
function signedArea(points: Point[]): number {
	let sum = 0;
	for (let i = 0; i < points.length; i++) {
		const a = points[i];
		const b = points[(i + 1) % points.length];
		sum += a.x * b.y - b.x * a.y;
	}
	return sum / 2;
}

const GAP = 3;
const MARGIN = 6;

/**
 * Puts each label just outside the outline, along the outward normal, then runs a simple
 * collision pass that nudges overlapping labels apart (and off other dots).
 * `points` and `labels` are in connecting order.
 */
export function placeLabels(points: Point[], labels: string[], layout: Layout): Dot[] {
	const n = points.length;
	const clockwise = signedArea(points) > 0;
	const { fontSize, radius } = layout;

	const boxes = points.map((p, i) => {
		const prev = points[(i - 1 + n) % n];
		const next = points[(i + 1) % n];
		let tx = next.x - prev.x;
		let ty = next.y - prev.y;
		const len = Math.hypot(tx, ty) || 1;
		tx /= len;
		ty /= len;
		const nx = clockwise ? ty : -ty;
		const ny = clockwise ? -tx : tx;
		const w = labels[i].length * fontSize * 0.62 + 4;
		const h = fontSize * 1.15;
		const reach = radius + GAP + Math.abs(nx) * (w / 2) + Math.abs(ny) * (h / 2);
		const hx = p.x + nx * reach;
		const hy = p.y + ny * reach;
		return { hx, hy, x: hx, y: hy, w, h };
	});

	const dotBox = radius * 2 + 2;
	const clamp = (v: number, half: number) =>
		Math.min(SHAPE_BOX - MARGIN - half, Math.max(MARGIN + half, v));

	for (let pass = 0; pass < 80; pass++) {
		let moved = false;
		for (let i = 0; i < n; i++) {
			const a = boxes[i];
			for (let j = i + 1; j < n; j++) {
				const b = boxes[j];
				const ox = (a.w + b.w) / 2 + 1 - Math.abs(a.x - b.x);
				const oy = (a.h + b.h) / 2 + 1 - Math.abs(a.y - b.y);
				if (ox <= 0 || oy <= 0) continue;
				moved = true;
				// Separate along whichever axis needs the smaller push.
				if (ox < oy) {
					const s = a.x === b.x ? (i % 2 ? 1 : -1) : Math.sign(a.x - b.x);
					a.x += (s * ox) / 2;
					b.x -= (s * ox) / 2;
				} else {
					const s = a.y === b.y ? (i % 2 ? 1 : -1) : Math.sign(a.y - b.y);
					a.y += (s * oy) / 2;
					b.y -= (s * oy) / 2;
				}
			}
			// Keep labels off every dot (their own included).
			for (let j = 0; j < n; j++) {
				const p = points[j];
				const ox = (a.w + dotBox) / 2 - Math.abs(a.x - p.x);
				const oy = (a.h + dotBox) / 2 - Math.abs(a.y - p.y);
				if (ox <= 0 || oy <= 0) continue;
				moved = true;
				if (ox < oy) a.x += (a.x >= p.x ? 1 : -1) * ox;
				else a.y += (a.y >= p.y ? 1 : -1) * oy;
			}
		}
		for (const b of boxes) {
			// A gentle pull back toward the ideal spot keeps nudged labels close to their dot.
			b.x = clamp(b.x + (b.hx - b.x) * 0.04, b.w / 2);
			b.y = clamp(b.y + (b.hy - b.y) * 0.04, b.h / 2);
		}
		if (!moved) break;
	}

	return points.map((p, i) => {
		const b = boxes[i];
		return {
			...p,
			label: labels[i],
			lx: b.x,
			ly: b.y,
			lw: b.w,
			lh: b.h,
			leader: Math.hypot(b.x - b.hx, b.y - b.hy) > fontSize * 0.8,
		};
	});
}

// ---- Settings ------------------------------------------------------------

export interface DotsSettings {
	seed: string;
	/** A shape id, or "random" to let the seed choose. */
	shape: string;
	dots: number;
	mode: NumberingMode;
}

export const RANDOM_SHAPE = "random";

export function parseDotsSettings(params: URLSearchParams, fallbackSeed: string): DotsSettings {
	const dots = Number.parseInt(params.get("dots") ?? "", 10);
	const count = DOT_COUNTS.includes(dots) ? dots : 25;
	const mode = NUMBERING_MODES.find((m) => m.id === params.get("mode"))?.id ?? "count";
	const shape = findShape(params.get("shape"))?.id ?? RANDOM_SHAPE;
	return {
		seed: sanitizeSeed(params.get("seed")) ?? fallbackSeed,
		shape,
		dots: count,
		mode: isModeAvailable(mode, count) ? mode : "count",
	};
}

export function dotsSettingsToParams(s: DotsSettings): URLSearchParams {
	return new URLSearchParams({
		seed: s.seed,
		shape: s.shape,
		dots: String(s.dots),
		mode: s.mode,
	});
}

// ---- Putting it together -------------------------------------------------

export interface DotsPuzzle {
	shape: Shape;
	dots: Dot[];
	fontSize: number;
	radius: number;
}

/** The same settings (and the same measurer) always give the same puzzle. */
export function buildDots(settings: DotsSettings, measure: PathMeasurer): DotsPuzzle {
	const rng = rngFromSeed(`${settings.seed}:dots`);
	const shape = findShape(settings.shape) ?? pick(rng, shapes);
	const n = settings.dots;

	// The seed also decides which dot is first and which way round you go.
	const first = randInt(rng, n);
	const step = rng() < 0.5 ? 1 : -1;
	const sampled = samplePath(shape.path, n, measure);
	const ordered = Array.from({ length: n }, (_, k) => sampled[(first + step * k + n * n) % n]);

	const mode = isModeAvailable(settings.mode, n) ? settings.mode : "count";
	const layout = layoutFor(n);
	return {
		shape,
		dots: placeLabels(ordered, labelsFor(mode, n), layout),
		...layout,
	};
}

// ---- SVG -----------------------------------------------------------------

const f = (v: number) => String(Math.round(v * 10) / 10);

/** Pure string output. `showOutline` draws the finished shape in light grey (the answer key). */
export function renderDotsSvg(puzzle: DotsPuzzle, showOutline = false): string {
	const { dots, radius, fontSize } = puzzle;
	const outline = showOutline
		? `<path d="${puzzle.shape.path}" fill="none" stroke="#cbd5e1" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>`
		: "";
	const leaders = dots
		.filter((d) => d.leader)
		.map((d) => `M${f(d.x)} ${f(d.y)}L${f(d.lx)} ${f(d.ly)}`)
		.join("");
	const marks = dots.map((d) => `<circle cx="${f(d.x)}" cy="${f(d.y)}" r="${radius}"/>`).join("");
	const first = dots[0];
	const ring = `<circle cx="${f(first.x)}" cy="${f(first.y)}" r="${radius + 4}" fill="none" stroke="#1f2937" stroke-width="2"/>`;
	const labels = dots
		.map(
			(d) =>
				`<text x="${f(d.lx)}" y="${f(d.ly)}" text-anchor="middle" dominant-baseline="central">${d.label}</text>`
		)
		.join("");

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SHAPE_BOX} ${SHAPE_BOX}" role="img" aria-label="${showOutline ? "Finished picture" : "Connect the dots puzzle"}"><rect width="${SHAPE_BOX}" height="${SHAPE_BOX}" fill="#fff"/>${outline}${
		leaders ? `<path d="${leaders}" fill="none" stroke="#9ca3af" stroke-width="0.8"/>` : ""
	}<g fill="#1f2937">${marks}</g>${ring}<g fill="#1f2937" font-family="system-ui,-apple-system,'Segoe UI',sans-serif" font-weight="700" font-size="${fontSize}">${labels}</g></svg>`;
}
