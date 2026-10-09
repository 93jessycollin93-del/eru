import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Creepster", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
