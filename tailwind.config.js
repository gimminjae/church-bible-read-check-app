import daisyui from 'daisyui'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        float: '0 26px 70px rgba(112, 89, 255, 0.18)',
        sticker: '0 12px 30px rgba(255, 118, 166, 0.18)',
        candy: '0 18px 40px rgba(79, 197, 255, 0.18)',
      },
      fontFamily: {
        display: ['Jua', 'sans-serif'],
        sans: ['Noto Sans KR', 'sans-serif'],
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        church: {
          primary: '#ff5fa2',
          'primary-content': '#fff8fc',
          secondary: '#4cc9ff',
          'secondary-content': '#10253c',
          accent: '#ffd84f',
          'accent-content': '#473400',
          neutral: '#7666ff',
          'neutral-content': '#f9f8ff',
          'base-100': '#fffaff',
          'base-200': '#f5f6ff',
          'base-300': '#ebe8ff',
          'base-content': '#3e3269',
          info: '#72a8ff',
          success: '#36d98d',
          warning: '#ffb84e',
          error: '#ff6a7e',
        },
      },
    ],
    logs: false,
  },
}
