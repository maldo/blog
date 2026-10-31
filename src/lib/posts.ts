import { type CollectionEntry, getCollection } from "astro:content";

export type Post = CollectionEntry<"blog">;

export function postDate(post: Post): Date {
	const { pubDatetime } = post.data;
	return pubDatetime instanceof Date ? pubDatetime : new Date(pubDatetime);
}

/** Posts are served at /post/<year>/<id> */
export function postUrl(post: Post): string {
	return `/post/${postDate(post).getFullYear()}/${post.id}`;
}

/** Terminal-style ISO date, e.g. 2023-01-06 */
export function formatDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/** Minutes to read at ~200 words per minute, never less than 1 */
export function readingTime(post: Post): number {
	const words = (post.body ?? "").trim().split(/\s+/).length;
	return Math.max(1, Math.round(words / 200));
}

/** All posts, newest first */
export async function getSortedPosts(): Promise<Post[]> {
	const posts = await getCollection("blog");
	return posts.sort((a, b) => postDate(b).getTime() - postDate(a).getTime());
}
