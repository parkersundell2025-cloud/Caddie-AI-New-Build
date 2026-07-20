/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        fraunces: ['Fraunces', 'serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'ui-monospace', 'monospace'],
      },
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
        sage: 'hsl(var(--sage))',
        'sage-dark': 'hsl(var(--sage-dark))',
        'session-dark': '#1a2e1a',
        'sage-light': 'hsl(var(--sage-light))',
        // "The Cut" design-system palette (Phase 0) — exact values from the
        // locked export, incl. glass alphas that can't live in HSL variables
        cut: {
          bg: '#0B0F0C',
          bg2: '#0F1714',
          card: 'rgba(244,239,227,.04)',
          'card-solid': '#141A17',
          'card-high': '#0B100D',
          'card-border': 'rgba(244,239,227,.10)',
          line: 'rgba(244,239,227,.08)',
          'line-soft': 'rgba(244,239,227,.04)',
          ink: '#F4EFE3',
          'ink-soft': 'rgba(244,239,227,.72)',
          'ink-mute': 'rgba(244,239,227,.45)',
          green: '#5FBE7E',
          'green-deep': '#0E4D2B',
          'green-glow': 'rgba(95,190,126,.30)',
          gold: '#D9B14A',
          'gold-soft': 'rgba(217,177,74,.18)',
          cream: '#F4EFE3',
        },
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: { height: '0' },
  				to: { height: 'var(--radix-accordion-content-height)' }
  			},
  			'accordion-up': {
  				from: { height: 'var(--radix-accordion-content-height)' },
  				to: { height: '0' }
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		},
    	}
  },
  safelist: [
    'bg-sage', 'bg-sage-light', 'bg-sage-dark',
    'text-sage', 'text-sage-dark',
    'border-sage',
    'bg-session-dark',
  ],
  plugins: [require("tailwindcss-animate")],
}
