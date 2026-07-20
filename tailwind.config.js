/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0A0F1D",
          900: "#0F1729",
          800: "#141F38",
          700: "#1C2A4A",
        },
        gold: {
          400: "#F0C877",
          500: "#E8B34C",
          600: "#C89339",
        },
        teal: {
          300: "#7EE8DA",
          400: "#3FD6C4",
          500: "#2CBBAA",
        },
        paper: "#F6F3EC",
        mute: "#8FA0BE",
      },
      fontFamily: {
        display: ["'Sora'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(232, 179, 76, 0.35)",
      },
    },
  },
  plugins: [],
};
