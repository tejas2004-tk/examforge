/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7f4',
          100: '#dceee7',
          200: '#b9ddcf',
          300: '#88c5ae',
          400: '#53a887',
          500: '#2f8a6a',
          600: '#237255',
          700: '#1d5b46',
          800: '#194a3b',
          900: '#153d32',
        },
      },
    },
  },
  plugins: [],
};
