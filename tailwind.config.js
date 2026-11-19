/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta inspirada en VS Code Dark+
        bg: {
          primary: "#1e1e1e",
          secondary: "#252526",
          tertiary: "#2d2d30",
          hover: "#37373d",
        },
        accent: {
          DEFAULT: "#0098ff",
          hover: "#1a9fff",
          muted: "#264f78",
        },
        border: {
          DEFAULT: "#3e3e42",
          subtle: "#2d2d30",
        },
        text: {
          primary: "#cccccc",
          secondary: "#858585",
          bright: "#ffffff",
        },
        status: {
          success: "#4ec9b0",
          error: "#f48771",
          warning: "#dcdcaa",
          info: "#569cd6",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "Consolas", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
