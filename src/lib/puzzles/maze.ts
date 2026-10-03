import { type Rng, pick, randInt, rngFromSeed, sanitizeSeed, shuffle } from "./random";
import { type Theme, characters, findTheme, landscapes } from "./themes";

// ---- Grid ----------------------------------------------------------------

/** Passage bit flags. A set bit means "open": you can walk that way from the cell. */
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;
const DIRS = [N, E, S, W] as const;
const OPPOSITE: Record<number, number> = { [N]: S, [E]: W, [S]: N, [W]: E };

export interface Maze {
	cols: number;
	rows: number;
	/** One byte per cell, row-major: index = y * cols + x. */
	passages: Uint8Array;
}

export type Algorithm = "backtracker" | "prim" | "wilson";

export const ALGORITHMS: { id: Algorithm; label: string; blurb: string }[] = [
	{ id: "backtracker", label: "Winding", blurb: "Long winding corridors (easiest)" },
	{ id: "prim", label: "Twisty", blurb: "Lots of short dead ends" },
	{ id: "wilson", label: "Tricky", blurb: "Unbiased and the hardest" },
];

function neighbor(maze: Maze, i: number, dir: number): number {
	const x = i % maze.cols;
	const y = (i - x) / maze.cols;
	if (dir === N) return y > 0 ? i - maze.cols : -1;
	if (dir === S) return y < maze.rows - 1 ? i + maze.cols : -1;
	if (dir === W) return x > 0 ? i - 1 : -1;
	return x < maze.cols - 1 ? i + 1 : -1;
}

function carve(maze: Maze, i: number, dir: number): number {
	const j = neighbor(maze, i, dir);
	maze.passages[i] |= dir;
	maze.passages[j] |= OPPOSITE[dir];
	return j;
}

function validDirs(maze: Maze, i: number): number[] {
	return DIRS.filter((d) => neighbor(maze, i, d) !== -1);
}

// ---- Generation ----------------------------------------------------------

/** Depth-first search: long corridors, few branches. */
function backtracker(maze: Maze, rng: Rng) {
	const visited = new Uint8Array(maze.cols * maze.rows);
	const first = randInt(rng, visited.length);
	const stack = [first];
	visited[first] = 1;
	while (stack.length) {
		const cur = stack[stack.length - 1];
		const options = validDirs(maze, cur).filter((d) => !visited[neighbor(maze, cur, d)]);
		if (!options.length) {
			stack.pop();
			continue;
		}
		const next = carve(maze, cur, pick(rng, options));
		visited[next] = 1;
		stack.push(next);
	}
}

/** Randomised Prim: grows from a blob outwards, so it makes many short dead ends. */
function prim(maze: Maze, rng: Rng) {
	const total = maze.cols * maze.rows;
	const inMaze = new Uint8Array(total);
	const queued = new Uint8Array(total);
	const frontier: number[] = [];

	const add = (i: number) => {
		inMaze[i] = 1;
		for (const d of validDirs(maze, i)) {
			const n = neighbor(maze, i, d);
			if (!inMaze[n] && !queued[n]) {
				queued[n] = 1;
				frontier.push(n);
			}
		}
	};

	add(randInt(rng, total));
	while (frontier.length) {
		const k = randInt(rng, frontier.length);
		const cell = frontier[k];
		frontier[k] = frontier[frontier.length - 1];
		frontier.pop();
		const toMaze = validDirs(maze, cell).filter((d) => inMaze[neighbor(maze, cell, d)]);
		carve(maze, cell, pick(rng, toMaze));
		add(cell);
	}
}

/** Wilson's algorithm: loop-erased random walks. Every possible maze is equally likely. */
function wilson(maze: Maze, rng: Rng) {
	const total = maze.cols * maze.rows;
	const inMaze = new Uint8Array(total);
	const heading = new Int8Array(total);
	inMaze[randInt(rng, total)] = 1;

	const order = shuffle(
		rng,
		Array.from({ length: total }, (_, i) => i)
	);
	for (const startCell of order) {
		if (inMaze[startCell]) continue;
		// Walk until we hit the maze. Re-visiting a cell overwrites its heading, which erases the loop.
		let cur = startCell;
		while (!inMaze[cur]) {
			const dir = pick(rng, validDirs(maze, cur));
			heading[cur] = dir;
			cur = neighbor(maze, cur, dir);
		}
		cur = startCell;
		while (!inMaze[cur]) {
			inMaze[cur] = 1;
			cur = carve(maze, cur, heading[cur]);
		}
	}
}

export function generateMaze(cols: number, rows: number, algorithm: Algorithm, rng: Rng): Maze {
	const maze: Maze = { cols, rows, passages: new Uint8Array(cols * rows) };
	if (algorithm === "prim") prim(maze, rng);
	else if (algorithm === "wilson") wilson(maze, rng);
	else backtracker(maze, rng);
	return maze;
}

// ---- Solving -------------------------------------------------------------

export interface Distances {
	/** Steps from the origin, or -1 if unreachable. */
	dist: Int32Array;
	/** The cell we came from, or -1 for the origin / unreachable cells. */
	prev: Int32Array;
}

export function bfs(maze: Maze, from: number): Distances {
	const total = maze.cols * maze.rows;
	const dist = new Int32Array(total).fill(-1);
	const prev = new Int32Array(total).fill(-1);
	const queue = new Int32Array(total);
	let head = 0;
	let tail = 0;
	queue[tail++] = from;
	dist[from] = 0;
	while (head < tail) {
		const cur = queue[head++];
		for (const d of DIRS) {
			if (!(maze.passages[cur] & d)) continue;
			const n = neighbor(maze, cur, d);
			if (dist[n] !== -1) continue;
			dist[n] = dist[cur] + 1;
			prev[n] = cur;
			queue[tail++] = n;
		}
	}
	return { dist, prev };
}

/** Cell indices from `from` to `to`, both included. */
export function solvePath(maze: Maze, from: number, to: number): number[] {
	const { prev } = bfs(maze, from);
	const path = [to];
	while (path[path.length - 1] !== from) {
		const p = prev[path[path.length - 1]];
		if (p === -1) return [];
		path.push(p);
	}
	return path.reverse();
}

export type FinishMode = "far" | "near";

/**
 * "far": the cell with the longest walk from the start.
 * "near": a cell about 40% of the way along that longest walk, so little ones get a short trip.
 */
export function pickFinish(maze: Maze, start: number, mode: FinishMode): number {
	const { dist } = bfs(maze, start);
	let farthest = start;
	for (let i = 0; i < dist.length; i++) if (dist[i] > dist[farthest]) farthest = i;
	if (mode === "far") return farthest;

	const target = Math.min(dist[farthest], Math.max(4, Math.round(dist[farthest] * 0.4)));
	let best = farthest;
	for (let i = 0; i < dist.length; i++) {
		if (i === start) continue;
		if (Math.abs(dist[i] - target) < Math.abs(dist[best] - target)) best = i;
	}
	return best;
}

// ---- Settings & presets --------------------------------------------------

export type AgeId = "3-4" | "5-6" | "7-9" | "10plus";

export interface AgePreset {
	id: AgeId;
	label: string;
	size: number;
	algo: Algorithm;
	finish: FinishMode;
	/** Chunky walls and big cells for small hands. */
	wide: boolean;
}

export const AGE_PRESETS: AgePreset[] = [
	{ id: "3-4", label: "3–4", size: 5, algo: "backtracker", finish: "near", wide: true },
	{ id: "5-6", label: "5–6", size: 8, algo: "backtracker", finish: "far", wide: false },
	{ id: "7-9", label: "7–9", size: 14, algo: "prim", finish: "far", wide: false },
	{ id: "10plus", label: "10+", size: 25, algo: "wilson", finish: "far", wide: false },
];

export const MIN_SIZE = 3;
export const MAX_SIZE = 30;

export interface MazeSettings {
	seed: string;
	age: AgeId;
	size: number;
	algo: Algorithm;
	char: string;
	place: string;
}

export function agePreset(id: AgeId): AgePreset {
	return AGE_PRESETS.find((p) => p.id === id) ?? AGE_PRESETS[1];
}

/** Defaults for an age preset. The character and place come from the seed unless given. */
export function settingsForAge(
	age: AgeId,
	seed: string,
	char?: string,
	place?: string
): MazeSettings {
	const preset = agePreset(age);
	const picker = rngFromSeed(`${seed}:theme`);
	return {
		seed,
		age: preset.id,
		size: preset.size,
		algo: preset.algo,
		char: char ?? pick(picker, characters).id,
		place: place ?? pick(picker, landscapes).id,
	};
}

/** Reads settings from a query string. Anything missing or invalid falls back to a default. */
export function parseSettings(params: URLSearchParams, fallbackSeed: string): MazeSettings {
	const seed = sanitizeSeed(params.get("seed")) ?? fallbackSeed;
	const age = AGE_PRESETS.find((p) => p.id === params.get("age"))?.id ?? "5-6";
	const char = findTheme(characters, params.get("char"))?.id;
	const place = findTheme(landscapes, params.get("place"))?.id;
	const base = settingsForAge(age, seed, char, place);

	const size = Number.parseInt(params.get("size") ?? "", 10);
	const algo = ALGORITHMS.find((a) => a.id === params.get("algo"))?.id;
	return {
		...base,
		size: Number.isFinite(size) ? Math.min(MAX_SIZE, Math.max(MIN_SIZE, size)) : base.size,
		algo: algo ?? base.algo,
	};
}

export function settingsToParams(s: MazeSettings): URLSearchParams {
	return new URLSearchParams({
		seed: s.seed,
		age: s.age,
		size: String(s.size),
		algo: s.algo,
		char: s.char,
		place: s.place,
	});
}

// ---- Putting it together -------------------------------------------------

export interface MazePuzzle {
	maze: Maze;
	start: number;
	finish: number;
	solution: number[];
	character: Theme;
	landscape: Theme;
	wide: boolean;
}

/** The same settings always give the same puzzle. */
export function buildMaze(s: MazeSettings): MazePuzzle {
	const preset = agePreset(s.age);
	const maze = generateMaze(s.size, s.size, s.algo, rngFromSeed(`${s.seed}:${s.size}:${s.algo}`));
	const start = 0;
	const finish = pickFinish(maze, start, preset.finish);
	return {
		maze,
		start,
		finish,
		solution: solvePath(maze, start, finish),
		character: findTheme(characters, s.char) ?? characters[0],
		landscape: findTheme(landscapes, s.place) ?? landscapes[0],
		wide: preset.wide,
	};
}

// ---- SVG -----------------------------------------------------------------

const BOARD = 600;
const EMOJI_FONT = "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";

const f = (n: number) => String(Math.round(n * 100) / 100);

/** Pure string output, so it stays sharp at any print size. Pass `solved` for the answer key. */
export function renderMazeSvg(puzzle: MazePuzzle, solved = false): string {
	const { maze, start, finish } = puzzle;
	const size = Math.max(maze.cols, maze.rows);
	const cell = BOARD / size;
	const wall = puzzle.wide ? 10 : Math.min(6, Math.max(2, cell * 0.12));
	const pad = wall;
	const width = maze.cols * cell + pad * 2;
	const height = maze.rows * cell + pad * 2;
	const center = (i: number): [number, number] => [
		pad + ((i % maze.cols) + 0.5) * cell,
		pad + (Math.floor(i / maze.cols) + 0.5) * cell,
	];

	const walls: string[] = [];
	const line = (x1: number, y1: number, x2: number, y2: number) =>
		walls.push(`M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`);
	for (let i = 0; i < maze.passages.length; i++) {
		const x = i % maze.cols;
		const y = (i - x) / maze.cols;
		const px = pad + x * cell;
		const py = pad + y * cell;
		const open = maze.passages[i];
		if (y === 0) line(px, py, px + cell, py);
		if (x === 0) line(px, py, px, py + cell);
		if (!(open & E)) line(px + cell, py, px + cell, py + cell);
		if (!(open & S)) line(px, py + cell, px + cell, py + cell);
	}

	let solution = "";
	if (solved && puzzle.solution.length) {
		const points = puzzle.solution.map((i) => center(i).map(f).join(",")).join(" ");
		solution = `<polyline points="${points}" fill="none" stroke="#ec4899" stroke-opacity="0.75" stroke-width="${f(Math.min(cell * 0.3, 14))}" stroke-linecap="round" stroke-linejoin="round"/>`;
	}

	const emoji = (i: number, glyph: string) => {
		const [cx, cy] = center(i);
		const fontSize = cell * 0.7;
		return `<text x="${f(cx)}" y="${f(cy + fontSize * 0.36)}" font-size="${f(fontSize)}" text-anchor="middle" font-family="${EMOJI_FONT}">${glyph}</text>`;
	};

	const label = solved ? "Solved maze" : "Maze";
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(width)} ${f(height)}" role="img" aria-label="${label}"><rect width="${f(width)}" height="${f(height)}" fill="#fff"/>${solution}<path d="${walls.join("")}" fill="none" stroke="#1f2937" stroke-width="${f(wall)}" stroke-linecap="round" stroke-linejoin="round"/>${emoji(start, puzzle.character.emoji)}${emoji(finish, puzzle.landscape.emoji)}</svg>`;
}

/** "Help the 🦄 unicorn get to the 🏰 castle!" */
export function mazeHeading(puzzle: MazePuzzle): string {
	const { character: c, landscape: l } = puzzle;
	return `Help the ${c.emoji} ${c.label.toLowerCase()} get to the ${l.emoji} ${l.label.toLowerCase()}!`;
}
