/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        pm: {
          // backgrounds
          bg:       "#1A1A1A",
          surface:  "#222222",
          panel:    "#2A2A2A",
          elevated: "#323232",
          input:    "#1E1E1E",
          // borders
          border:   "#383838",
          divider:  "#2E2E2E",
          // text
          text:     "#D4D4D4",
          muted:    "#888888",
          dim:      "#555555",
          // accent
          orange:   "#FF6C37",
          "orange-h": "#FF8558",
          "orange-d": "#CC5629",
          // status
          green:    "#4CAF7D",
          red:      "#E05252",
          yellow:   "#E8A838",
          blue:     "#5B9BD5",
          purple:   "#9B72CF",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Consolas", "monospace"],
      },
      fontSize: {
        "2xs": ["10px", "14px"],
        "xs":  ["11px", "16px"],
        "sm":  ["12px", "18px"],
        "base":["13px", "20px"],
      },
      animation: {
        "fade-in": "fadeIn 0.15s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0", transform: "translateY(3px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
