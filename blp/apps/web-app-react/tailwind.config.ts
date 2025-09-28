import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem"
    },
    extend: {
      colors: {
        hz: {
          primary: "var(--hz-color-primary)",
          primaryHover: "var(--hz-color-primary-hover)",
          secondary: "var(--hz-color-secondary)",
          accent: "var(--hz-color-accent)",
          danger: "var(--hz-color-danger)",
          success: "var(--hz-color-success)",
          warning: "var(--hz-color-warning)",
          info: "var(--hz-color-info)",
          "surface-card": "var(--hz-surface-card)",
          "surface-muted": "var(--hz-surface-muted)",
          "surface-raised": "var(--hz-surface-raised)",
          text: "var(--hz-text)",
          "text-sub": "var(--hz-text-sub)",
          border: "var(--hz-border)",
          neutral: {
            50: "var(--hz-neutral-50)",
            100: "var(--hz-neutral-100)",
            200: "var(--hz-neutral-200)",
            300: "var(--hz-neutral-300)",
            400: "var(--hz-neutral-400)",
            500: "var(--hz-neutral-500)",
            600: "var(--hz-neutral-600)",
            700: "var(--hz-neutral-700)",
            800: "var(--hz-neutral-800)",
            900: "var(--hz-neutral-900)"
          }
        }
      },
      borderRadius: {
        "hz-xs": "var(--hz-radius-xs)",
        "hz-md": "var(--hz-radius-md)",
        "hz-xl": "var(--hz-radius-xl)"
      },
      boxShadow: {
        "hz-sm": "var(--hz-shadow-sm)",
        "hz-md": "var(--hz-shadow-md)",
        "hz-lg": "var(--hz-shadow-lg)"
      },
      fontFamily: {
        sans: ["var(--hz-font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--hz-font-mono)", "monospace"]
      }
    }
  },
  plugins: [animate]
};

export default config;
