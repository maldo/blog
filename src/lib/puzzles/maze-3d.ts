// Play mode for the maze maker: the same maze as the printout, built in 3D with three.js.
// Loaded on demand when someone presses "Play", so the printable page stays light.

import {
	BoxGeometry,
	type BufferGeometry,
	CanvasTexture,
	CircleGeometry,
	Color,
	DirectionalLight,
	DoubleSide,
	HemisphereLight,
	InstancedMesh,
	type Material,
	MathUtils,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	Object3D,
	PerspectiveCamera,
	PlaneGeometry,
	RingGeometry,
	SRGBColorSpace,
	Scene,
	Sprite,
	SpriteMaterial,
	type Texture,
	Vector3,
	WebGLRenderer,
} from "three";
import { E, EMOJI_FONT, type MazePuzzle, N, S, W, solvePath, step } from "./maze";

// ---- Look ----------------------------------------------------------------

interface Palette {
	sky: string;
	ground: string;
	floor: string;
	wall: string;
	post: string;
	trail: string;
	hint: string;
}

/** Each place gets its own colors: the forest maze is a hedge, the beach one is a sandcastle. */
const PALETTES: Record<string, Palette> = {
	forest: {
		sky: "#dcfce7",
		ground: "#65a30d",
		floor: "#ecfccb",
		wall: "#15803d",
		post: "#a16207",
		trail: "#a16207",
		hint: "#f97316",
	},
	beach: {
		sky: "#e0f2fe",
		ground: "#38bdf8",
		floor: "#fef3c7",
		wall: "#fbbf24",
		post: "#fb7185",
		trail: "#0ea5e9",
		hint: "#ec4899",
	},
	castle: {
		sky: "#e0e7ff",
		ground: "#86efac",
		floor: "#f5f5f4",
		wall: "#a8a29e",
		post: "#7c3aed",
		trail: "#7c3aed",
		hint: "#f59e0b",
	},
	space: {
		sky: "#1e1b4b",
		ground: "#312e81",
		floor: "#3b0764",
		wall: "#6366f1",
		post: "#f472b6",
		trail: "#facc15",
		hint: "#22d3ee",
	},
	underwater: {
		sky: "#cffafe",
		ground: "#0e7490",
		floor: "#a5f3fc",
		wall: "#f472b6",
		post: "#fb923c",
		trail: "#0891b2",
		hint: "#facc15",
	},
	garden: {
		sky: "#fef9c3",
		ground: "#86efac",
		floor: "#fefce8",
		wall: "#22c55e",
		post: "#f472b6",
		trail: "#ec4899",
		hint: "#f97316",
	},
	mountains: {
		sky: "#dbeafe",
		ground: "#a8a29e",
		floor: "#f8fafc",
		wall: "#78716c",
		post: "#e0f2fe",
		trail: "#2563eb",
		hint: "#f97316",
	},
	"candy-land": {
		sky: "#fce7f3",
		ground: "#f9a8d4",
		floor: "#fff1f2",
		wall: "#ec4899",
		post: "#8b5cf6",
		trail: "#8b5cf6",
		hint: "#f59e0b",
	},
};

const CONFETTI_COLORS = ["#f472b6", "#facc15", "#34d399", "#60a5fa", "#a78bfa", "#fb923c"];

// One cell is one unit. Walls are a bit shorter than a cell so you can see over them.
const WALL_HEIGHT = 0.55;
const POST_HEIGHT = 0.65;
const STEP_MS = 150;
const BUMP_MS = 180;
const HINT_STEPS = 6;
const HINT_MS = 3000;
const CONFETTI = 150;
/** How far the camera tilts away from straight down, in each view. */
const WHOLE_TILT = MathUtils.degToRad(22);
const CLOSE_TILT = MathUtils.degToRad(32);
/** The close-up view always shows at least this many cells across. */
const CLOSE_CELLS = 7;
/** Finger travel, in pixels, that counts as one step when dragging on the maze. */
const DRAG_PX = 28;

// ---- Game ----------------------------------------------------------------

export type View = "close" | "whole";

export interface MazeGameEvents {
	/** After every step, and with 0 after a restart. */
	onStep?: (steps: number) => void;
	onWin?: (steps: number) => void;
}

export interface MazeGame {
	/** Walk one cell N, E, S or W. Bumps into walls; queues one move while still walking. */
	move(dir: number): void;
	/** Lights up the next few cells on the way to the finish. */
	hint(): void;
	readonly view: View;
	setView(view: View): void;
	restart(): void;
	dispose(): void;
}

function emojiTexture(glyph: string): CanvasTexture {
	const canvas = document.createElement("canvas");
	canvas.width = 256;
	canvas.height = 256;
	const ctx = canvas.getContext("2d")!;
	ctx.font = `200px ${EMOJI_FONT}`;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(glyph, 128, 140);
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	return texture;
}

/** Builds the maze inside `host` and starts drawing. Throws if WebGL isn't available. */
export function createMazeGame(
	host: HTMLElement,
	puzzle: MazePuzzle,
	events: MazeGameEvents = {}
): MazeGame {
	const { maze, start, finish } = puzzle;
	const colors = PALETTES[puzzle.landscape.id] ?? PALETTES["candy-land"];
	const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
	const size = Math.max(maze.cols, maze.rows);
	const thickness = puzzle.wide ? 0.2 : 0.12;

	const disposables: { dispose(): void }[] = [];
	const own = <T extends BufferGeometry | Material | Texture | InstancedMesh>(thing: T): T => {
		disposables.push(thing);
		return thing;
	};

	const renderer = new WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
	renderer.shadowMap.enabled = true;
	const canvas = renderer.domElement;
	host.prepend(canvas);

	const scene = new Scene();
	scene.background = new Color(colors.sky);
	const camera = new PerspectiveCamera(45, 1, 1, size * 6 + 20);

	/** Centre of a cell on the floor. North is -z, so the screen matches the paper maze. */
	const cellCenter = (i: number, y = 0) =>
		new Vector3(
			(i % maze.cols) - maze.cols / 2 + 0.5,
			y,
			Math.floor(i / maze.cols) - maze.rows / 2 + 0.5
		);

	// Light: soft sky light bouncing off the floor, plus a sun for wall shadows.
	scene.add(new HemisphereLight("#ffffff", colors.floor, 1.8));
	const sun = new DirectionalLight("#ffffff", 1.6);
	sun.position.set(-size * 0.4, size, -size * 0.25);
	sun.castShadow = true;
	const reach = size * 0.75 + 1;
	Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach });
	sun.shadow.camera.far = size * 3;
	sun.shadow.camera.updateProjectionMatrix();
	sun.shadow.mapSize.setScalar(size > 14 ? 2048 : 1024);
	sun.shadow.bias = -0.0005;
	sun.shadow.normalBias = 0.02;
	scene.add(sun);

	// Ground and floor.
	const ground = new Mesh(
		own(new CircleGeometry(size * 3 + 10, 48).rotateX(-Math.PI / 2)),
		own(new MeshStandardMaterial({ color: colors.ground, roughness: 1 }))
	);
	ground.position.y = -0.2;
	scene.add(ground);
	const floor = new Mesh(
		own(new BoxGeometry(maze.cols + thickness, 0.2, maze.rows + thickness)),
		own(new MeshStandardMaterial({ color: colors.floor, roughness: 0.9 }))
	);
	floor.position.y = -0.1;
	floor.receiveShadow = true;
	scene.add(floor);

	// Walls sit between posts, which stand on every grid corner. Same edges as the SVG.
	const walls: [number, number, boolean][] = [];
	for (let i = 0; i < maze.passages.length; i++) {
		const x = i % maze.cols;
		const y = (i - x) / maze.cols;
		const open = maze.passages[i];
		if (y === 0) walls.push([x + 0.5, y, true]);
		if (x === 0) walls.push([x, y + 0.5, false]);
		if (!(open & E)) walls.push([x + 1, y + 0.5, false]);
		if (!(open & S)) walls.push([x + 0.5, y + 1, true]);
	}
	const box = own(new BoxGeometry(1, 1, 1));
	const dummy = new Object3D();
	const wallMesh = own(
		new InstancedMesh(
			box,
			own(new MeshStandardMaterial({ color: colors.wall, roughness: 0.7 })),
			walls.length
		)
	);
	walls.forEach(([x, z, alongX], k) => {
		dummy.position.set(x - maze.cols / 2, WALL_HEIGHT / 2, z - maze.rows / 2);
		const length = 1 - thickness;
		dummy.scale.set(alongX ? length : thickness, WALL_HEIGHT, alongX ? thickness : length);
		dummy.updateMatrix();
		wallMesh.setMatrixAt(k, dummy.matrix);
	});
	const posts = (maze.cols + 1) * (maze.rows + 1);
	const postMesh = own(
		new InstancedMesh(
			box,
			own(new MeshStandardMaterial({ color: colors.post, roughness: 0.6 })),
			posts
		)
	);
	dummy.scale.set(thickness * 1.15, POST_HEIGHT, thickness * 1.15);
	for (let k = 0; k < posts; k++) {
		const x = k % (maze.cols + 1);
		const z = (k - x) / (maze.cols + 1);
		dummy.position.set(x - maze.cols / 2, POST_HEIGHT / 2, z - maze.rows / 2);
		dummy.updateMatrix();
		postMesh.setMatrixAt(k, dummy.matrix);
	}
	for (const mesh of [wallMesh, postMesh]) {
		mesh.castShadow = true;
		scene.add(mesh);
	}

	// Breadcrumbs on every cell you've visited, and the glowing hint dots.
	const dot = own(new CircleGeometry(0.1, 20).rotateX(-Math.PI / 2));
	const trail = own(
		new InstancedMesh(
			dot,
			own(
				new MeshBasicMaterial({
					color: colors.trail,
					transparent: true,
					opacity: 0.7,
					depthWrite: false,
				})
			),
			maze.passages.length
		)
	);
	trail.frustumCulled = false;
	scene.add(trail);
	const hintMaterial = own(
		new MeshBasicMaterial({ color: colors.hint, transparent: true, depthWrite: false })
	);
	const hints = own(new InstancedMesh(dot, hintMaterial, HINT_STEPS));
	hints.frustumCulled = false;
	hints.visible = false;
	scene.add(hints);

	// The finish: the place emoji, bobbing above a pulsing ring.
	const finishAt = cellCenter(finish);
	const ringMaterial = own(
		new MeshBasicMaterial({ color: colors.post, transparent: true, depthWrite: false })
	);
	const ring = new Mesh(own(new RingGeometry(0.3, 0.42, 40).rotateX(-Math.PI / 2)), ringMaterial);
	ring.position.copy(finishAt).setY(0.015);
	scene.add(ring);
	const goal = new Sprite(
		own(new SpriteMaterial({ map: own(emojiTexture(puzzle.landscape.emoji)) }))
	);
	goal.scale.setScalar(0.85);
	scene.add(goal);

	// The character, with a blob shadow so it looks like it stands on the floor.
	const hero = new Sprite(
		own(new SpriteMaterial({ map: own(emojiTexture(puzzle.character.emoji)) }))
	);
	hero.scale.setScalar(0.8);
	hero.renderOrder = 1;
	scene.add(hero);
	const blob = new Mesh(
		own(new CircleGeometry(0.26, 24).rotateX(-Math.PI / 2)),
		own(
			new MeshBasicMaterial({
				color: "#000000",
				transparent: true,
				opacity: 0.18,
				depthWrite: false,
			})
		)
	);
	scene.add(blob);

	// Confetti for the win: little paper squares that burst from the finish and settle on the floor.
	const confetti = own(
		new InstancedMesh(
			own(new PlaneGeometry(0.09, 0.15)),
			own(new MeshBasicMaterial({ side: DoubleSide })),
			CONFETTI
		)
	);
	confetti.frustumCulled = false;
	confetti.visible = false;
	for (let k = 0; k < CONFETTI; k++)
		confetti.setColorAt(k, new Color(CONFETTI_COLORS[k % CONFETTI_COLORS.length]));
	scene.add(confetti);
	const pieces = Array.from({ length: CONFETTI }, () => ({
		position: new Vector3(),
		velocity: new Vector3(),
		spin: new Vector3(),
	}));

	// ---- State ----

	let pos = start;
	let steps = 0;
	let won = false;
	let queued = 0;
	let view: View = size <= 10 ? "whole" : "close";
	const walkFrom = cellCenter(start);
	const walkTo = cellCenter(start);
	let walkStart = Number.NEGATIVE_INFINITY;
	let bumpDir = 0;
	let bumpStart = Number.NEGATIVE_INFINITY;
	let hintStart = Number.NEGATIVE_INFINITY;
	let wonAt = Number.NEGATIVE_INFINITY;
	const visited = new Uint8Array(maze.passages.length);
	const stepMs = calm ? 60 : STEP_MS;

	const offsets: Record<number, [number, number]> = {
		[N]: [0, -1],
		[E]: [1, 0],
		[S]: [0, 1],
		[W]: [-1, 0],
	};

	/** A flat marker lying on the floor of a cell, `y` above it so it doesn't flicker into the floor. */
	function floorMatrix(i: number, scale: number, y: number) {
		dummy.position.copy(cellCenter(i, y));
		dummy.rotation.set(0, 0, 0);
		dummy.scale.setScalar(scale);
		dummy.updateMatrix();
		return dummy.matrix;
	}

	function dropCrumb(i: number) {
		if (visited[i]) return;
		visited[i] = 1;
		trail.setMatrixAt(trail.count++, floorMatrix(i, 1, 0.01));
		trail.instanceMatrix.needsUpdate = true;
	}

	function reset() {
		pos = start;
		steps = 0;
		won = false;
		queued = 0;
		walkFrom.copy(cellCenter(start));
		walkTo.copy(walkFrom);
		walkStart = bumpStart = hintStart = wonAt = Number.NEGATIVE_INFINITY;
		visited.fill(0);
		trail.count = 0;
		dropCrumb(start);
		hints.visible = false;
		confetti.visible = false;
	}

	function move(dir: number) {
		// Once you reach the finish you stay there; the frame loop calls the win.
		if (won || pos === finish || !offsets[dir]) return;
		const now = performance.now();
		if (now - walkStart < stepMs) {
			queued = dir;
			return;
		}
		const next = step(maze, pos, dir);
		if (next === -1) {
			bumpDir = dir;
			bumpStart = now;
			return;
		}
		walkFrom.copy(cellCenter(pos));
		walkTo.copy(cellCenter(next));
		walkStart = now;
		pos = next;
		steps++;
		dropCrumb(next);
		events.onStep?.(steps);
	}

	function hint() {
		if (won) return;
		const path = solvePath(maze, pos, finish).slice(1, HINT_STEPS + 1);
		path.forEach((cell, k) => hints.setMatrixAt(k, floorMatrix(cell, 1.6, 0.025)));
		hints.count = path.length;
		hints.instanceMatrix.needsUpdate = true;
		hints.visible = path.length > 0;
		hintStart = performance.now();
	}

	function win(now: number) {
		won = true;
		wonAt = now;
		events.onWin?.(steps);
		if (calm) return;
		confetti.visible = true;
		for (const p of pieces) {
			p.position.copy(finishAt).setY(0.5);
			const angle = Math.random() * Math.PI * 2;
			const speed = 0.6 + Math.random() * 1.6;
			p.velocity.set(Math.cos(angle) * speed, 3 + Math.random() * 3, Math.sin(angle) * speed);
			p.spin.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
		}
	}

	// ---- Camera ----

	const camPos = new Vector3();
	const camLook = new Vector3();
	const wantPos = new Vector3();
	const wantLook = new Vector3();
	let snapCamera = true;

	function aimCamera(focus: Vector3) {
		const tan = Math.tan(MathUtils.degToRad(camera.fov / 2));
		// Far enough back to fit the whole maze on screen. The tilt brings the near edge closer,
		// so it needs the most room: up/down it must fit within the field of view, and so must
		// its corners left/right.
		const half = size / 2 + 0.3;
		const near = half * Math.sin(WHOLE_TILT);
		const whole =
			(Math.max((half * Math.cos(WHOLE_TILT)) / tan, half / (tan * camera.aspect)) + near) * 1.04;
		if (view === "whole") {
			wantLook.set(0, 0, 0);
			wantPos.set(0, whole * Math.cos(WHOLE_TILT), whole * Math.sin(WHOLE_TILT));
			return;
		}
		const close = Math.min(whole, CLOSE_CELLS / 2 / tan / Math.min(1, camera.aspect));
		wantLook.copy(focus);
		wantPos.set(focus.x, close * Math.cos(CLOSE_TILT), focus.z + close * Math.sin(CLOSE_TILT));
	}

	function resize() {
		const { clientWidth: w, clientHeight: h } = host;
		if (!w || !h) return;
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
	}
	const observer = new ResizeObserver(resize);
	observer.observe(host);
	resize();

	// ---- Drag or swipe on the maze to walk ----

	let drag: { id: number; x: number; y: number } | null = null;
	const onDown = (e: PointerEvent) => {
		drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
		canvas.setPointerCapture(e.pointerId);
	};
	const onMove = (e: PointerEvent) => {
		if (!drag || drag.id !== e.pointerId) return;
		const dx = e.clientX - drag.x;
		const dy = e.clientY - drag.y;
		if (Math.max(Math.abs(dx), Math.abs(dy)) < DRAG_PX) return;
		move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? E : W) : dy > 0 ? S : N);
		drag.x = e.clientX;
		drag.y = e.clientY;
	};
	const onUp = (e: PointerEvent) => {
		if (drag?.id === e.pointerId) drag = null;
	};
	canvas.style.touchAction = "none";
	canvas.addEventListener("pointerdown", onDown);
	canvas.addEventListener("pointermove", onMove);
	canvas.addEventListener("pointerup", onUp);
	canvas.addEventListener("pointercancel", onUp);

	// ---- Frame loop ----

	let last = performance.now();
	const here = new Vector3();
	renderer.setAnimationLoop(() => {
		const now = performance.now();
		const elapsed = (now - last) / 1000;
		// Physics takes small steps even if a frame was slow; the camera eases in real time.
		const dt = Math.min(0.05, elapsed);
		last = now;

		// Walk with a little hop, then take the queued move or check for the finish.
		const t = Math.min(1, (now - walkStart) / stepMs);
		here.lerpVectors(walkFrom, walkTo, t);
		let hop = calm ? 0 : Math.sin(Math.PI * t) * 0.12;
		if (t >= 1 && walkStart > Number.NEGATIVE_INFINITY) {
			walkStart = Number.NEGATIVE_INFINITY;
			if (pos === finish) win(now);
			else if (queued) {
				const dir = queued;
				queued = 0;
				move(dir);
			}
		}
		const b = (now - bumpStart) / BUMP_MS;
		if (b < 1) {
			const [ox, oz] = offsets[bumpDir];
			const push = Math.sin(Math.PI * b) * 0.16;
			here.x += ox * push;
			here.z += oz * push;
		}
		if (won && !calm) hop = Math.abs(Math.sin(now / 160)) * 0.25;
		hero.position.set(here.x, 0.38 + hop, here.z);
		blob.position.set(here.x, 0.02, here.z);

		// The place bobs over its ring, then floats up like a trophy once you get there.
		const bob = calm ? 0 : Math.sin(now / 400) * 0.06;
		const lift = calm ? 0 : MathUtils.clamp((now - wonAt) / 600, 0, 1);
		goal.position.set(finishAt.x, 0.45 + bob + lift * 0.6, finishAt.z);
		goal.scale.setScalar(0.85 + lift * 0.35);
		ringMaterial.opacity = calm ? 0.8 : 0.55 + Math.sin(now / 300) * 0.3;

		if (hints.visible) {
			const h = (now - hintStart) / HINT_MS;
			if (h >= 1) hints.visible = false;
			else hintMaterial.opacity = Math.min(1, (1 - h) * 3) * (0.75 + Math.sin(now / 120) * 0.25);
		}

		if (confetti.visible) {
			for (let k = 0; k < CONFETTI; k++) {
				const p = pieces[k];
				if (p.position.y > 0.02) {
					p.velocity.y -= 9 * dt;
					p.position.addScaledVector(p.velocity, dt);
					p.position.y = Math.max(0.02, p.position.y);
					dummy.rotation.set(
						p.spin.x * now * 0.001,
						p.spin.y * now * 0.001,
						p.spin.z * now * 0.001
					);
				} else {
					dummy.rotation.set(-Math.PI / 2, 0, p.spin.z);
				}
				dummy.position.copy(p.position);
				dummy.scale.setScalar(1);
				dummy.updateMatrix();
				confetti.setMatrixAt(k, dummy.matrix);
			}
			confetti.instanceMatrix.needsUpdate = true;
			if (now - wonAt > 8000) confetti.visible = false;
		}

		aimCamera(here);
		const k = snapCamera || calm ? 1 : 1 - Math.exp(-elapsed * 5);
		snapCamera = false;
		camPos.lerp(wantPos, k);
		camLook.lerp(wantLook, k);
		camera.position.copy(camPos);
		camera.lookAt(camLook);

		renderer.render(scene, camera);
	});

	reset();

	return {
		move,
		hint,
		get view() {
			return view;
		},
		setView(next: View) {
			view = next;
		},
		restart() {
			reset();
			snapCamera = true;
			events.onStep?.(0);
		},
		dispose() {
			renderer.setAnimationLoop(null);
			observer.disconnect();
			canvas.removeEventListener("pointerdown", onDown);
			canvas.removeEventListener("pointermove", onMove);
			canvas.removeEventListener("pointerup", onUp);
			canvas.removeEventListener("pointercancel", onUp);
			for (const thing of disposables) thing.dispose();
			renderer.dispose();
			renderer.forceContextLoss();
			canvas.remove();
		},
	};
}
