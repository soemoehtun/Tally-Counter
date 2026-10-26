/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        zinc: {
          850: '#202023',
        },
        emerald: {
          50: '#f0f4ef',
          100: '#e0e9e1',
          200: '#c6d7c9',
          300: '#a4bea9',
          400: '#7c9e85',
          500: '#5c7c65',
          600: '#496650',
          700: '#3a5341',
          800: '#304438',
          900: '#293a30',
        },
      },
    fontFamily: {
        sans: ['"Noto Sans Myanmar"', 'Pyidaungsu', 'Padauk', '"Myanmar Text"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Noto Sans Myanmar"', 'Pyidaungsu', 'Padauk', '"Myanmar Text"', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
