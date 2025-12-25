import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(0, 0%, 0%)",
        foreground: "hsl(0, 0%, 100%)",
        card: {
          DEFAULT: "hsl(0, 0%, 5%)",
          foreground: "hsl(0, 0%, 95%)",
        },
        popover: {
          DEFAULT: "hsl(0, 0%, 5%)",
          foreground: "hsl(0, 0%, 95%)",
        },
        primary: {
          DEFAULT: "hsl(0, 100%, 50%)",
          foreground: "hsl(0, 0%, 100%)",
        },
        secondary: {
          DEFAULT: "hsl(0, 0%, 15%)",
          foreground: "hsl(0, 0%, 90%)",
        },
        muted: {
          DEFAULT: "hsl(0, 0%, 10%)",
          foreground: "hsl(0, 0%, 70%)",
        },
        accent: {
          DEFAULT: "hsl(0, 100%, 50%)",
          foreground: "hsl(0, 0%, 100%)",
        },
        destructive: {
          DEFAULT: "hsl(0, 100%, 50%)",
          foreground: "hsl(0, 0%, 100%)",
        },
        border: "hsl(0, 0%, 20%)",
        input: "hsl(0, 0%, 20%)",
        ring: "hsl(0, 100%, 50%)",
      },
      borderRadius: {
        lg: "0.5rem",
        md: "calc(0.5rem - 2px)",
        sm: "calc(0.5rem - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;

