/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './templates/**/*.html',
    './src/**/*.{js,css}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#D13E43',
          light: '#E8686D',
          dark: '#B32A2F',
        },
      },
    },
  },
  plugins: [],
}