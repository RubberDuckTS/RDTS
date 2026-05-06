/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // Background tones
        ink: {
          DEFAULT: '#0E1116',  // dark hero background
          deep:    '#070A0E',  // even darker accent
          card:    '#161B22',  // dark card on dark section
          border:  '#1F262F',  // subtle border on dark
        },
        cream: {
          DEFAULT: '#F5EFE0',  // warm off-white section
          light:   '#FAF6EB',  // even lighter
          deep:    '#ECE3CE',  // slightly more saturated
          border:  '#E2D8BE',  // border on cream
        },

        // Accent
        saffron: {
          DEFAULT: '#FFC83D',  // primary saffron
          light:   '#FFD970',  // lighter, for hover-highlight
          deep:    '#E5A700',  // hover state
          shadow:  '#7A5A00',  // text/icon on light bg
        },

        // Text colors
        bone: {
          DEFAULT: '#F5EFE0',  // light text on dark
          dim:     '#C5BFAE',  // muted text on dark
          mute:    '#9DA0A6',  // very muted text on dark
        },
        coal: {
          DEFAULT: '#1A1410',  // dark text on cream
          dim:     '#5A4F42',  // muted text on cream
          mute:    '#7A6E5E',  // very muted text on cream
        },
      },
      fontFamily: {
        sans: ['"Geist"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        spec: '0.16em',
        tight2: '-0.025em',
        tight3: '-0.035em',
      },
      borderRadius: {
        'pill': '9999px',
        'card': '14px',
        'soft': '10px',
      },
      boxShadow: {
        'pill-dark': '0 8px 24px -8px rgba(0,0,0,0.30), 0 2px 4px -2px rgba(0,0,0,0.40)',
        'card-dark': '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 32px -16px rgba(0,0,0,0.6)',
        'card-cream': '0 1px 0 0 rgba(255,255,255,0.6) inset, 0 8px 32px -20px rgba(26,20,16,0.18)',
        'glow-saffron': '0 0 0 4px rgba(255,200,61,0.18)',
      },
      animation: {
        'cursor-blink': 'cursor-blink 1.05s steps(2, jump-none) infinite',
        'fade-up': 'fade-up 0.7s cubic-bezier(.2,.8,.2,1) both',
      },
      keyframes: {
        'cursor-blink': {
          '0%, 50%':   { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
