import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-arabic)", "Tahoma", "Arial", "sans-serif"],
      },
      colors: {
        leaf: {
          50: "#f1f8ee",
          100: "#dff0d6",
          500: "#49a35c",
          600: "#328447",
          700: "#26683a",
        },
        citrus: {
          100: "#fff4bc",
          400: "#facc15",
          500: "#eab308",
        },
        market: {
          orange: "#f97316",
          ink: "#17231c",
        },
      },
      boxShadow: {
        glass: "0 16px 50px rgba(23, 35, 28, 0.10)",
        soft: "0 8px 24px rgba(23, 35, 28, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
