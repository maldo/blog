# Maldo Blog

A personal blog and portfolio site built with [Astro](https://astro.build) and styled with Tailwind CSS. Features dark mode support, blog posts, and a clean, modern design.

![Astro](https://img.shields.io/badge/Astro-5.x-orange?style=flat-square&logo=astro)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38bdf8?style=flat-square&logo=tailwindcss)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat-square&logo=typescript)
![pnpm](https://img.shields.io/badge/pnpm-9.x-f69220?style=flat-square&logo=pnpm)

## ✨ Features

- **⚡ Astro-powered** — Fast, content-focused static site generation
- **🌙 Dark Mode** — Automatic dark mode with localStorage persistence
- **📝 Blog Support** — Markdown-based blog posts with frontmatter
- **🎨 Tailwind CSS** — Utility-first styling with Typography plugin
- **📱 Responsive** — Mobile-first responsive design
- **🔍 SEO Ready** — Proper meta tags and RSS feed support
- **🧹 Biome** — Fast, modern linting and formatting

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [pnpm](https://pnpm.io/) (v9.12.2 required)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd maldo-blog-2

# Install dependencies
pnpm install
```

### Development

```bash
# Start the dev server
pnpm dev

# The site will be available at http://localhost:4321
```

### Build & Preview

```bash
# Build for production (includes type checking)
pnpm build

# Preview the production build
pnpm preview
```

### Linting & Formatting

```bash
# Run Biome for linting and formatting
pnpm check
```

## 📁 Project Structure

```
├── public/                  # Static assets (images, favicon, etc.)
├── src/
│   ├── assets/             # Source assets
│   ├── collections/        # JSON data (menu, experiences, projects)
│   ├── components/         # Astro components
│   ├── data/
│   │   └── blog/           # Blog posts (Markdown files)
│   ├── layouts/            # Page layouts
│   │   ├── main.astro      # Base layout
│   │   └── post.astro      # Blog post layout
│   ├── pages/              # Astro pages (file-based routing)
│   │   ├── index.astro     # Homepage
│   │   ├── about.astro     # About page
│   │   ├── posts.astro     # Blog listing
│   │   ├── projects.astro  # Projects page
│   │   └── post/           # Dynamic blog post routes
│   └── content.config.ts   # Content collection config
├── astro.config.mjs        # Astro configuration
├── tailwind.config.mjs     # Tailwind CSS configuration
└── tsconfig.json           # TypeScript configuration
```

## ✍️ Writing Blog Posts

Create a new `.md` file in `src/data/blog/`:

```markdown
---
title: "Your Post Title"
description: "A brief description of your post"
pubDatetime: 2024-01-01
tags: ["tag1", "tag2"]
---

Your content here...
```

### Frontmatter Options

| Field           | Type            | Required | Description                    |
| --------------- | --------------- | -------- | ------------------------------ |
| `title`         | string          | ✅       | Post title                     |
| `description`   | string          | ✅       | Short description              |
| `slug`          | string          | ❌       | Custom URL slug                |
| `pubDatetime`   | string \| Date  | ❌       | Publication date               |
| `dateFormatted` | string          | ❌       | Custom formatted date          |
| `authors`       | string[]        | ❌       | List of authors                |
| `tags`          | string[]        | ❌       | Post tags                      |

## 🛠️ Path Aliases

TypeScript path aliases are configured for clean imports:

```typescript
import Layout from "@/layouts/main.astro";
import styles from "@styles/custom.css";
```

- `@/*` → `./src/*`
- `@styles/*` → `./src/styles/*`

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

Built with ❤️ by [Maldo](https://x.com/MaldoDev)
