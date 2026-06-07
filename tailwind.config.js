/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './templates/**/*.html',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
      },
      fontFamily: {
        body: 'var(--font-body, system-ui)',
        display: '"Plus Jakarta Sans", system-ui',
      },
      borderRadius: {
        card: 'var(--radius-card, 1rem)',
      }
    },
  },
  plugins: [],
}
