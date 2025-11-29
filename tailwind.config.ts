import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "#ff6b35", // Orange accent
          hover: "#ff8555",
          light: "#ff9d75",
          dark: "#e55a2b",
        },
        secondary: {
          DEFAULT: "#1a1a1a", // Dark background
          light: "#2a2a2a",
          lighter: "#3a3a3a",
        },
      },
    },
  },
  plugins: [],
};
export default config;

