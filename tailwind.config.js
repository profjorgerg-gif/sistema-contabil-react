/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#EEF0EA",
        paperRaised: "#F7F8F3",
        ink: "#1B4B3A",
        inkSoft: "#3E6A58",
        line: "#C9CFC3",
        lineSoft: "#DEE2D8",
        gold: "#B8862B",
        green: "#2F6F5E",
        red: "#A23B2E",
        credit: "#7A4FA0",
      },
      fontFamily: {
        serif: ["Lora", "serif"],
        sans: ["Public Sans", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(27,75,58,.06), 0 4px 14px rgba(27,75,58,.06)",
      },
    },
  },
  plugins: [],
};
