import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
	site: "https://maldo.dev",
	markdown: {
		shikiConfig: {
			themes: { light: "github-light", dark: "github-dark" },
		},
	},
	vite: {
		plugins: [tailwindcss()],
		build: {
			// three.js for the maze maker's play mode is one ~550 kB chunk, loaded only on demand.
			chunkSizeWarningLimit: 600,
		},
	},
});
