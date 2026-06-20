/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // DOPA brand palette.
        // Primary accent — Sky Blue (#002ef4).
        brand: {
          DEFAULT: '#002ef4',
          50: '#eaefff',
          100: '#d5deff',
          200: '#abbcff',
          300: '#8099ff',
          400: '#4063fa',
          500: '#002ef4',
          600: '#0025c4',
          700: '#001d99',
          800: '#001466',
          900: '#000a33',
        },
        // Secondary / dark surfaces — Navy Blue (#001e5f).
        navy: {
          DEFAULT: '#001e5f',
          light: '#08296f',
          lighter: '#123a8a',
        },
        // Brighter sky-blue accent — used for text/icons ON the dark navy
        // surfaces where #002ef4 would be too low-contrast.
        accent: {
          DEFAULT: '#5b93ff',
          soft: '#8fb4ff',
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
