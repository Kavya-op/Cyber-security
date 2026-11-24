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
        palette: {
          espresso: '#171615',
          mocha: '#38312B',
          taupe: '#655447',
          khaki: '#9A8068',
          sand: '#CDB69A',
          cream: '#F1E6D5',
        },
        neu: {
          base: '#F1E6D5',
          light: '#FAF5EE',
          dark: '#CDB69A',
          shadow: '#DECDBA',
          text: '#171615',
        },
        navy: {
          900: '#0b192c',
          800: '#102a43',
          700: '#1e3a5f',
          600: '#243b53',
          500: '#334e68',
          400: '#486581',
          300: '#627d98',
        }
      },
      boxShadow: {
        'neu-extruded': '8px 8px 18px #b8bec7, -8px -8px 18px #ffffff',
        'neu-extruded-sm': '4px 4px 10px #b8bec7, -4px -4px 10px #ffffff',
        'neu-extruded-lg': '12px 12px 26px #b2b8c2, -12px -12px 26px #ffffff',
        'neu-recessed': 'inset 5px 5px 10px #b8bec7, inset -5px -5px 10px #ffffff',
        'neu-recessed-deep': 'inset 8px 8px 16px #abb3bf, inset -8px -8px 16px #ffffff',
        'neu-pressed': 'inset 3px 3px 6px #b8bec7, inset -3px -3px 6px #ffffff',
        'neu-button-active': 'inset 4px 4px 8px #b8bec7, inset -4px -4px 8px #ffffff',
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
      }
    },
  },
  plugins: [],
}
