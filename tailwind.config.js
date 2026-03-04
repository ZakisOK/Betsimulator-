/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        banker:  { DEFAULT: '#3b82f6', glow: 'rgba(59,130,246,0.4)' },
        player:  { DEFAULT: '#ef4444', glow: 'rgba(239,68,68,0.4)' },
        tie:     { DEFAULT: '#22c55e', glow: 'rgba(34,197,94,0.4)' },
        // Keep surface for component references
        surface: {
          700: 'rgba(255,255,255,0.1)',
          800: 'rgba(255,255,255,0.06)',
          850: 'rgba(255,255,255,0.04)',
          900: 'rgba(255,255,255,0.02)',
          950: '#020817',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        mesh: `
          radial-gradient(ellipse 80% 60% at 20% 10%,  rgba(59,130,246,0.12) 0%, transparent 50%),
          radial-gradient(ellipse 60% 60% at 80% 80%,  rgba(99,102,241,0.10) 0%, transparent 50%),
          radial-gradient(ellipse 50% 40% at 60% 40%,  rgba(16,185,129,0.06) 0%, transparent 40%),
          linear-gradient(180deg, #020817 0%, #030d1a 100%)
        `,
      },
      animation: {
        'slide-in':    'slideIn 0.25s ease-out',
        'pulse-glow':  'pulseGlow 2s ease-in-out infinite',
        'fade-in':     'fadeIn 0.3s ease-out',
      },
      keyframes: {
        slideIn:   { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fadeIn:    { from: { opacity: '0' }, to: { opacity: '1' } },
        pulseGlow: {
          '0%,100%': { boxShadow: '0 0 16px rgba(59,130,246,0.3)' },
          '50%':     { boxShadow: '0 0 32px rgba(59,130,246,0.6)' },
        },
      },
    },
  },
  plugins: [],
}
