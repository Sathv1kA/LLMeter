/** @type {import('tailwindcss').Config} */
//
// Tailwind consumes the CSS variables defined in src/index.css so every
// semantic color (bg-background, text-muted-foreground, border-border)
// resolves to the right oklch() value — and theme tweaks live in one place.
//
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        popover: "var(--popover)",
        "popover-foreground": "var(--popover-foreground)",
        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",
        secondary: "var(--secondary)",
        "secondary-foreground": "var(--secondary-foreground)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        accent: "var(--accent)",
        "accent-foreground": "var(--accent-foreground)",
        destructive: "var(--destructive)",
        "destructive-foreground": "var(--destructive-foreground)",
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",

        // Brand accents
        magenta: "var(--magenta)",
        amber: "var(--amber)",
        cyan: "var(--cyan)",
        success: "var(--success)",
        "success-foreground": "var(--success-foreground)",

        // Provider brand colors
        openai: "var(--openai)",
        anthropic: "var(--anthropic)",
        google: "var(--google)",
        mistral: "var(--mistral)",
        meta: "var(--meta)",
        cohere: "var(--cohere)",
      },
      fontFamily: {
        display: ['"Space Grotesk"', "Inter", "system-ui", "sans-serif"],
        mono: [
          '"JetBrains Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
        serif: ['"Instrument Serif"', '"Playfair Display"', "Georgia", "serif"],
      },
      borderRadius: {
        sm: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 2px)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      keyframes: {
        fadeInRow: {
          from: { opacity: "0", transform: "translateY(-4px)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        "fade-in-row": "fadeInRow 240ms ease-out",
      },
    },
  },
  plugins: [],
};
