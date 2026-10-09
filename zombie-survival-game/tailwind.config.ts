import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Big Shoulders Stencil Display"', "Impact", "sans-serif"],
        ui: ['"Barlow Condensed"', '"Arial Narrow"', "sans-serif"],
        note: ['"Special Elite"', '"Courier New"', "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
