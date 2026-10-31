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
- Posts are routed via `src/pages/post/[...slug].astro` at `/post/<year>/<id>`
- `src/lib/posts.ts` holds the shared post helpers (`getSortedPosts`, `postUrl`, `postDate`,
  `formatDate`, `readingTime`); use them instead of re-deriving dates or URLs
- Blog listing page at `src/pages/posts.astro` uses the `PostsLoop` component

**Adding new blog posts**: Create markdown files in `src/data/blog/` with the required frontmatter fields.

## Routing Structure

- `src/pages/index.astro` - Homepage
- `src/pages/about.astro` - About page
- `src/pages/posts.astro` - Blog listing
- `src/pages/projects.astro` - Projects showcase
- `src/pages/post/[...slug].astro` - Dynamic blog post pages (pulls from `blog` collection)

## Layout System

- `src/layouts/main.astro` - Base layout with header, footer, dark mode script
- `src/layouts/post.astro` - Blog post layout extending main layout: title, meta line (date ·
  reading time · tags) and a table of contents built from the post's h2/h3 headings

The main layout includes:
- Dark mode follows the system setting until the visitor uses the toggle, which saves
  `dark_mode` = `"true"`/`"false"` in localStorage
- Inline script to prevent flash of unstyled content (applies `.dark` before first paint)
- Environment variable injection points: `HEADER_INJECT` and `FOOTER_INJECT`

## Path Aliases

TypeScript is configured with path aliases:
- `@/*` maps to `./src/*`
- `@styles/*` maps to `./src/styles/*`

Use these in imports: `import Layout from "@/layouts/post.astro"`

## Styling

- Uses Tailwind CSS v4 with Typography plugin, wired up via the `@tailwindcss/vite`
  plugin in `astro.config.mjs` (there is no `@astrojs/tailwind` integration)
- Tailwind is configured CSS-first in `src/assets/css/main.css` — there is no
  `tailwind.config.mjs`. Source globs go in `@source`, plugins in `@plugin`, and
  theme overrides in `@theme`
- `src/assets/css/main.css` is imported from `src/layouts/main.astro`
- Dark mode: class-based with `dark:` prefix, declared as a `@custom-variant` in
  `main.css` that matches `.dark` on `<html>`
- Theme tokens live in `main.css`: an `accent` color (teal, deeper in light mode and brighter in
  dark mode, so use `text-accent` / `bg-accent` / `text-accent-contrast` rather than raw teal
  shades) and the fonts, Geist (`font-sans`) and Geist Mono (`font-mono`), self-hosted via
  `@fontsource-variable/*` and imported in `src/layouts/main.astro`
- The look is "terminal": monospace for nav, dates, tags and small labels, and a
  `src/components/prompt.astro` line (e.g. `$ ls posts/`) above section headings
- Code blocks use Shiki's `github-light` / `github-dark` themes (`astro.config.mjs`); `main.css`
  switches to the dark one under `.dark`
- Biome handles code formatting and linting (not Prettier/ESLint)

## Package Manager

**Must use pnpm** - specified as `pnpm@9.12.2` in package.json

Astro 7 requires Node.js >= 22.12.0 (see `.node-version`).
