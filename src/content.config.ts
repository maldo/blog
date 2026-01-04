import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

export const BLOG_PATH = "src/data/blog";

const postCollection = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: `./${BLOG_PATH}` }),
  schema: z.object({
    slug: z.string().optional(),
    title: z.string(),
    authors: z.string().optional(),
    pubDatetime: z.union([z.string(), z.date()]),
    description: z.string(),
    tags: z.array(z.string()).optional(),
  }),
});

export const collections = {
  blog: postCollection,
};
