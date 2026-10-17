/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Geist", "Plus Jakarta Sans", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        base: {
          0: "var(--bg-0)",
          1: "var(--bg-1)",
          sidebar: "var(--bg-sidebar)",
          elev: "var(--bg-elev)",
          hover: "var(--bg-hover)",
          active: "var(--bg-active)",
        },
        brand: {
          DEFAULT: "var(--violet)",
          lav: "var(--lavender)",
          accent: "var(--accent)",
          pink: "var(--pink)",
          deep: "var(--violet-deep)",
        },
        ink: {
          1: "var(--text-1)",
          2: "var(--text-2)",
          3: "var(--text-3)",
        },
        line: "var(--border)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--error)",
      },
      borderRadius: { sm2: "8px", md2: "12px", lg2: "16px" },
      boxShadow: {
        soft: "var(--shadow-soft)",
        lift: "var(--shadow-lift)",
        glow: "var(--shadow-glow)",
      },
    },
  },
  plugins: [],
};
