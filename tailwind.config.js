import daisyui from 'daisyui'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        float: '0 24px 80px rgba(76, 56, 33, 0.16)',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        sans: ['Noto Sans KR', 'sans-serif'],
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        church: {
          primary: '#b45d37',
          'primary-content': '#fff9f2',
          secondary: '#476b5e',
          'secondary-content': '#f6f3ee',
          accent: '#df9e48',
          'accent-content': '#2d2117',
          neutral: '#2f2924',
          'neutral-content': '#f8f3ea',
          'base-100': '#fffdf8',
          'base-200': '#f5eee1',
          'base-300': '#e4d6be',
          'base-content': '#231a15',
          info: '#57809a',
          success: '#4d8b62',
          warning: '#d49d37',
          error: '#b95b4c',
        },
      },
    ],
    logs: false,
  },
}
