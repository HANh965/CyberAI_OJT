/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: "#070a0f",
          panel: "#0c111a",
          panel2: "#111824",
          border: "#1d283a",
          text: "#d7dee8",
          muted: "#627285",
          neon: "#3ddc84",
          cyan: "#00f0ff",
          red: "#ff3366",
          amber: "#fcee0a",
          purple: "#b026ff",
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'monospace'],
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        neon: "0 0 15px rgba(61, 220, 132, 0.35)",
        cyan: "0 0 15px rgba(0, 240, 255, 0.35)",
        red: "0 0 15px rgba(255, 51, 102, 0.35)",
      },
      animation: {
        pulseFast: "pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        scanline: "scanline 8s linear infinite",
      },
      keyframes: {
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(1000%)" },
        },
      },
    },
  },
  plugins: [],
};

