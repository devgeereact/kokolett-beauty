import type { Config } from 'tailwindcss';

/**
 * Design tokens mirror docs/DESIGN.md and resolve to the CSS custom properties
 * declared in src/index.css, so light/dark switching is a single class on <html>
 * rather than a duplicated palette.
 *
 * Class names stay NativeWind-compatible (no web-only arbitrary selectors) so the
 * tree can be ported to Expo later.
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        chart: {
          1: 'var(--chart-1)',
          2: 'var(--chart-2)',
          3: 'var(--chart-3)',
          4: 'var(--chart-4)',
          5: 'var(--chart-5)',
        },
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },
        status: {
          pending: 'var(--status-pending)',
          confirmed: 'var(--status-confirmed)',
          'in-service': 'var(--status-in-service)',
          completed: 'var(--status-completed)',
          cancelled: 'var(--status-cancelled)',
          'no-show': 'var(--status-no-show)',
        },
        tint: {
          pending: 'var(--tint-pending)',
          confirmed: 'var(--tint-confirmed)',
          'in-service': 'var(--tint-in-service)',
          completed: 'var(--tint-completed)',
          cancelled: 'var(--tint-cancelled)',
          'no-show': 'var(--tint-no-show)',
          primary: 'var(--tint-primary)',
          chart: {
            1: 'var(--tint-chart-1)',
            2: 'var(--tint-chart-2)',
            3: 'var(--tint-chart-3)',
            4: 'var(--tint-chart-4)',
            5: 'var(--tint-chart-5)',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        display: ['"Source Serif 4"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 12px)',
      },
      boxShadow: {
        card: '0 2px 8px rgb(17 24 39 / 0.06), 0 1px 2px rgb(17 24 39 / 0.04)',
        popover: '0 6px 24px rgb(17 24 39 / 0.08), 0 2px 6px rgb(17 24 39 / 0.08)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 300ms ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
