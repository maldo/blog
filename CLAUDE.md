# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Astro-based personal blog/portfolio template called "Aria". It's a static site with Tailwind CSS for styling and supports dark mode.

## Development Commands

```bash
# Start development server
pnpm dev
# or
pnpm start

# Build for production (runs type checking first)
pnpm build

# Preview production build
pnpm preview

# Lint and format code with Biome
pnpm check

# Type checking only
pnpm astro check
```

## Content Architecture

The project uses Astro's Content Layer with file-based loader for blog posts:

- Collection defined in `src/content.config.ts` as "blog"
- Blog posts stored in `src/data/blog/` (can be organized in subdirectories like `src/data/blog/2023/`)
- Frontmatter schema supports:
  - Required: `title`, `description`
  - Optional: `slug`, `authors`, `pubDatetime` (string or Date), `dateFormatted`, `tags` (array)
- Posts are routed via `src/pages/post/[...slug]/index.astro`
- Blog listing page at `src/pages/posts.astro` uses the `PostsLoop` component

**Adding new blog posts**: Create markdown files in `src/data/blog/` with the required frontmatter fields.

## Routing Structure

- `src/pages/index.astro` - Homepage
- `src/pages/about.astro` - About page
- `src/pages/posts.astro` - Blog listing
- `src/pages/projects.astro` - Projects showcase
- `src/pages/post/[...slug]/index.astro` - Dynamic blog post pages (pulls from `blog` collection)

## Layout System

- `src/layouts/main.astro` - Base layout with header, footer, dark mode script
- `src/layouts/post.astro` - Blog post layout extending main layout

The main layout includes:
- Dark mode support via localStorage (`dark_mode` key)
- Inline script to prevent flash of unstyled content
- Environment variable injection points: `HEADER_INJECT` and `FOOTER_INJECT`

## Path Aliases

TypeScript is configured with path aliases:
- `@/*` maps to `./src/*`
- `@styles/*` maps to `./src/styles/*`

Use these in imports: `import Layout from "@/layouts/post.astro"`

## Styling

- Uses Tailwind CSS with Typography plugin
- Dark mode: class-based with `dark:` prefix
- Biome handles code formatting and linting (not Prettier/ESLint)

## Package Manager

**Must use pnpm** - specified as `pnpm@9.12.2` in package.json
