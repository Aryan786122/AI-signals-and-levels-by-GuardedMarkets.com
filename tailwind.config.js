/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#090B0F',
        surface: {
          DEFAULT: '#101318',
          primary: '#101318',
          secondary: '#151922',
          tertiary: '#1C222E',
          hover: '#1E2430',
        },
        border: {
          DEFAULT: '#252B35',
          subtle: '#1C222D',
          light: '#313845',
        },
        foreground: {
          DEFAULT: '#F2F4F7',
          primary: '#F2F4F7',
          secondary: '#9299A6',
          muted: '#667085',
        },
        accent: {
          DEFAULT: '#10B981',
          hover: '#059669',
          muted: 'rgba(16, 185, 129, 0.12)',
        },
        signal: {
          green: '#10B981',
          red: '#EF4444',
          amber: '#F59E0B',
          blue: '#3B82F6',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          '"SF Mono"',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
};
