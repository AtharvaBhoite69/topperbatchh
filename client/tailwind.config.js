/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: '#F5E9D1',
        olive: '#666052',
        'vintage-olive': '#666052',
        'olive-dark': '#4D473C',
        ink: '#171510',
        'comic-yellow': '#F5B900',
        'punch-red': '#F0442E',
        'victory-green': '#258C48',
        'secondary-grey': '#B8B0A0',
      },
      fontFamily: {
        heading: ['Anton', 'sans-serif'],
        comic: ['Bangers', 'cursive'],
        body: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        comic: '6px 6px 0 #171510',
        'comic-sm': '3px 3px 0 #171510',
        'comic-lg': '8px 8px 0 #171510',
        'comic-yellow': '6px 6px 0 #F5B900',
        'comic-red': '6px 6px 0 #F0442E',
      },
      borderWidth: {
        3: '3px',
      },
    },
  },
  plugins: [],
};
