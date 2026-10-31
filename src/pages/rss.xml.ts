import { getSortedPosts, postDate, postUrl } from "@/lib/posts";
import rss from "@astrojs/rss";
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
	const posts = await getSortedPosts();

	return rss({
		title: "Maldo Blog",
		description: "My writings about life and technology",
		site: context.site ?? "https://example.com",
		items: posts.map((post) => ({
			title: post.data.title,
			pubDate: postDate(post),
			description: post.data.description,
			link: `${postUrl(post)}/`,
		})),
		customData: "<language>en-us</language>",
	});
}
