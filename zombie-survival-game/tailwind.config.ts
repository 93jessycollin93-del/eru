import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Big Shoulders Stencil Display"', "Impact", "sans-serif"],
        ui: ['"Barlow Condensed"', '"Arial Narrow"', "sans-serif"],
        note: ['"Special Elite"', '"Courier New"', "monospace"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
