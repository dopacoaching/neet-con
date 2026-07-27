/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // CareerX brand palette (sampled from the official logo).
        // Primary — CareerX Navy (#050b95).
        brand: {
          DEFAULT: '#050b95',
          50: '#eaecff',
          100: '#d2d7ff',
          200: '#a6afff',
          300: '#7986ff',
          400: '#3d47e0',
          500: '#050b95',
          600: '#040978',
          700: '#03075c',
          800: '#020440',
          900: '#010226',
        },
        // Secondary / dark surfaces — deep navy, close to the card background
        // used on the printed/QR entry pass.
        navy: {
          DEFAULT: '#0a0f3d',
          light: '#12185a',
          lighter: '#1c2570',
        },
        // CareerX "Rx" cyan — used for text/icons ON dark navy surfaces where
        // the navy brand color would be too low-contrast.
        accent: {
          DEFAULT: '#00c2ff',
          soft: '#5bd6ff',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-out',
        'pulse-soft': 'pulse-soft 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
