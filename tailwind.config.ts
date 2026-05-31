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
          200: "#c5e5b8",
          300: "#9bd28a",
          400: "#6ebb68",
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
      opacity: {
        6: "0.06",
        7: "0.07",
        8: "0.08",
        12: "0.12",
        15: "0.15",
        18: "0.18",
        35: "0.35",
        38: "0.38",
        45: "0.45",
        55: "0.55",
        58: "0.58",
        62: "0.62",
        64: "0.64",
        65: "0.65",
        66: "0.66",
        68: "0.68",
        72: "0.72",
        74: "0.74",
        78: "0.78",
        82: "0.82",
        92: "0.92",
      },
    },
  },
  plugins: [],
};

export default config;
