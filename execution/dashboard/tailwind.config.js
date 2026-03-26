/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Space Grotesk'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
      colors: {
        glass: {
          fill: "rgba(255,255,255,0.04)",
          border: "rgba(255,255,255,0.08)",
          "border-hover": "rgba(255,255,255,0.12)",
          "fill-hover": "rgba(255,255,255,0.06)",
        },
        surface: "#18181b",
        base: "#09090b",
      },
    },
  },
  plugins: [],
};
