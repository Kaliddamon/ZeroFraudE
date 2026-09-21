/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        // ── Deep Navy Banking Palette ─────────────────────────────────────────
        navy: {
          950: '#020814',
          900: '#050A14',
          800: '#0B1426',
          700: '#112039',
          600: '#162B4A',
          500: '#1E3A5F',
        },
        // ── Institutional Blue ────────────────────────────────────────────────
        brand: {
          DEFAULT: '#1A56DB',
          50:  '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1A56DB',
          900: '#1E40AF',
        },
        // ── Gold / Premium ────────────────────────────────────────────────────
        gold: {
          DEFAULT: '#C9A227',
          light: '#F5D87E',
          dark: '#8B6914',
        },
        // ── Risk Semantic Colors ──────────────────────────────────────────────
        risk: {
          low:      '#10B981',
          medium:   '#F59E0B',
          high:     '#EF4444',
          critical: '#DC2626',
        },
        // ── Neutral / Surface ─────────────────────────────────────────────────
        surface: {
          DEFAULT: '#0B1426',
          elevated: '#112039',
          border:   'rgba(99,179,237,0.10)',
        },
      },
      boxShadow: {
        'glow-brand':    '0 0 20px rgba(26,86,219,0.35)',
        'glow-gold':     '0 0 20px rgba(201,162,39,0.35)',
        'glow-critical': '0 0 20px rgba(220,38,38,0.4)',
        'inner-bright':  'inset 0 1px 0 rgba(255,255,255,0.08)',
        'card':          '0 4px 24px rgba(0,0,0,0.4)',
        'card-hover':    '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,179,237,0.12)',
      },
      backgroundImage: {
        'aurora':         'linear-gradient(135deg, #050A14 0%, #0B1426 40%, #112039 70%, #0B1426 100%)',
        'aurora-shine':   'linear-gradient(90deg, transparent 0%, rgba(26,86,219,0.06) 50%, transparent 100%)',
        'card-glass':     'linear-gradient(135deg, rgba(17,32,57,0.8) 0%, rgba(11,20,38,0.9) 100%)',
        'brand-gradient': 'linear-gradient(135deg, #1A56DB 0%, #2563EB 100%)',
        'gold-gradient':  'linear-gradient(135deg, #C9A227 0%, #F5D87E 50%, #C9A227 100%)',
        'critical-gradient': 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)',
      },
      animation: {
        'pulse-slow':       'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer':          'shimmer 2.5s linear infinite',
        'aurora-shift':     'aurora-shift 8s ease-in-out infinite alternate',
        'slide-in-right':   'slide-in-right 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-up':      'slide-in-up 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in':          'fade-in 0.25s ease-out',
        'ripple':           'ripple 0.6s linear',
        'indicator-move':   'indicator-move 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'count-up':         'count-up 1s cubic-bezier(0.16, 1, 0.3, 1)',
        'border-glow':      'border-glow 2s linear infinite',
        'float':            'float 3s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        'aurora-shift': {
          '0%':   { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '100% 50%' },
        },
        'slide-in-right': {
          '0%':   { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-up': {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        ripple: {
          '0%':   { transform: 'scale(0)', opacity: '0.5' },
          '100%': { transform: 'scale(4)', opacity: '0' },
        },
        'border-glow': {
          '0%, 100%': { borderColor: 'rgba(26,86,219,0.3)' },
          '50%':      { borderColor: 'rgba(59,130,246,0.6)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
