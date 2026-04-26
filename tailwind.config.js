/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/client/index.html', './src/client/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0a0a0b',
          secondary: '#141416',
          tertiary: '#1c1c20',
        },
        border: { DEFAULT: '#2a2a2e' },
        accent: { DEFAULT: '#6366f1', hover: '#818cf8' },
        agent: {
          engineer: '#6366f1',
          research: '#06b6d4',
          content: '#f59e0b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
