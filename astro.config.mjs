import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
	site: "https://maldo.dev",
	vite: {
		plugins: [tailwindcss()],
	},
});
