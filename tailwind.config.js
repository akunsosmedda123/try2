/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sage: { DEFAULT: '#7A9278', dark: '#5E7660', light: '#DDE6DB' },
        cream: '#F8F4EC',
        warm: '#FFFCF7',
        beige: '#EDE4D7',
        terra: { DEFAULT: '#C88469', dark: '#A9684F', light: '#F3DED5' },
        charcoal: '#343A34',
      },
      boxShadow: { soft: '0 2px 14px rgba(52,58,52,0.08)' },
      fontFamily: { sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'] },
    },
  },
  plugins: [],
};
