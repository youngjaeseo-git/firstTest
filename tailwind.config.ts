import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Gray scale wired to CSS variables so the whole app can flip
        // between dark (default) and light themes without touching
        // component classes. See src/styles/globals.css for the values.
        gray: {
          50: "rgb(var(--gray-50) / <alpha-value>)",
          100: "rgb(var(--gray-100) / <alpha-value>)",
          200: "rgb(var(--gray-200) / <alpha-value>)",
          300: "rgb(var(--gray-300) / <alpha-value>)",
          400: "rgb(var(--gray-400) / <alpha-value>)",
          500: "rgb(var(--gray-500) / <alpha-value>)",
          600: "rgb(var(--gray-600) / <alpha-value>)",
          700: "rgb(var(--gray-700) / <alpha-value>)",
          800: "rgb(var(--gray-800) / <alpha-value>)",
          900: "rgb(var(--gray-900) / <alpha-value>)",
          950: "rgb(var(--gray-950) / <alpha-value>)",
        },
        // DCIM specific semantic colors
        severity: {
          critical: "#ef4444",
          warning: "#f59e0b",
          info: "#3b82f6",
          ok: "#22c55e",
        },
        rack: {
          empty: "#374151",
          occupied: "#1e40af",
          hot: "#dc2626",
          warm: "#f59e0b",
          cool: "#22c55e",
        },
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(10px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out forwards",
        "slide-in-right": "slide-in-right 0.3s ease-out forwards",
        shimmer: "shimmer 2s linear infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
