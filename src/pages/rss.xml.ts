import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
    const posts = await getCollection("blog");

    // Sort posts by date (newest first)
    const sortedPosts = posts.sort((a, b) => {
        const dateA = a.data.pubDatetime
            ? new Date(a.data.pubDatetime)
            : new Date();
        const dateB = b.data.pubDatetime
            ? new Date(b.data.pubDatetime)
            : new Date();
        return dateB.getTime() - dateA.getTime();
    });

    return rss({
        title: "Maldo Blog",
        description: "My writings about life and technology",
        site: context.site ?? "https://example.com",
        items: sortedPosts.map((post) => ({
            title: post.data.title,
            pubDate: post.data.pubDatetime
                ? new Date(post.data.pubDatetime)
                : new Date(),
            description: post.data.description,
            link: `/post/${post.id}/`,
        })),
        customData: `<language>en-us</language>`,
    });
}
