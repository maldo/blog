export type Rng = () => number;

/** Small, fast seeded generator. Same seed -> same sequence, in every browser and in Node. */
export function mulberry32(seed: number): Rng {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** FNV-1a: turns a seed string like "k3f9" into a 32-bit number. */
export function hashSeed(seed: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

export function rngFromSeed(seed: string): Rng {
	return mulberry32(hashSeed(seed));
}

const SEED_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** A short, URL-friendly seed such as "k3f9x". Pass an rng for a reproducible result. */
export function newSeed(rng: Rng = Math.random, length = 5): string {
	let out = "";
	for (let i = 0; i < length; i++) out += SEED_ALPHABET[Math.floor(rng() * SEED_ALPHABET.length)];
	return out;
}

/** Accepts only short alphanumeric seeds (lowercased); anything else returns null. */
export function sanitizeSeed(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const seed = raw.toLowerCase();
	return /^[a-z0-9]{1,16}$/.test(seed) ? seed : null;
}

/** Integer in [0, n). */
export function randInt(rng: Rng, n: number): number {
	return Math.floor(rng() * n);
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
	return items[randInt(rng, items.length)];
}

/** Fisher-Yates, in place. */
export function shuffle<T>(rng: Rng, items: T[]): T[] {
	for (let i = items.length - 1; i > 0; i--) {
		const j = randInt(rng, i + 1);
		[items[i], items[j]] = [items[j], items[i]];
	}
	return items;
}
