import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

/**
 * Kokolett Beauty UK — Tailwind configuration.
 *
 * Values live in src/index.css as CSS custom properties; this file only maps
 * them to utilities. Rules are documented in docs/DESIGN.md.
 *
 * DESIGN INTENT — read before editing:
 *
 * `colors`, `screens`, `fontSize`, `borderRadius`, `boxShadow` and `zIndex` are
 * declared at THEME level, not inside `extend`. That is deliberate: `extend`
 * leaves Tailwind's defaults in place, so `bg-red-500`, `z-50`, `shadow-lg` and
 * `rounded-3xl` all keep working and the system's constraints become advisory.
 * Replacing them makes the documented scale the only scale. Adding a value here
 * is a design-system change and needs the review in DESIGN.md §11.
 *
 * Everything else (spacing, opacity, sizing, etc.) stays on Tailwind's defaults
 * via `extend`, because those scales already match what we documented.
 */

/** Colour tokens carry an alpha slot so `bg-primary/50` works. See DESIGN.md §2. */
const rgb = (token: string) => `rgb(var(${token}) / <alpha-value>)`;

/** Tints are pre-mixed color-mix() values and cannot take an alpha modifier. */
const raw = (token: string) => `var(${token})`;

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',

  theme: {
    /* ---- Colour --------------------------------------------------------
     * Closed set. There is no `white`, `black` or default palette: use
     * `text-primary-foreground`, not `text-white`. */
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',

      background: rgb('--background'),
      foreground: rgb('--foreground'),

      card: {
        DEFAULT: rgb('--card'),
        foreground: rgb('--card-foreground'),
      },
      popover: {
        DEFAULT: rgb('--popover'),
        foreground: rgb('--popover-foreground'),
      },

      /* Identity. Display type ≥24px, marketing, focus ring. Never a label fill. */
      brand: rgb('--brand'),
      /* Interactive. Any fill that carries a text label. */
      primary: {
        DEFAULT: rgb('--primary'),
        foreground: rgb('--primary-foreground'),
      },
      secondary: {
        DEFAULT: rgb('--secondary'),
        foreground: rgb('--secondary-foreground'),
      },
      muted: {
        DEFAULT: rgb('--muted'),
        foreground: rgb('--muted-foreground'),
      },
      accent: {
        DEFAULT: rgb('--accent'),
        foreground: rgb('--accent-foreground'),
      },
      destructive: {
        DEFAULT: rgb('--destructive'),
        foreground: rgb('--destructive-foreground'),
      },

      border: rgb('--border'),
      input: rgb('--input'),
      ring: rgb('--ring'),

      chart: {
        1: rgb('--chart-1'),
        2: rgb('--chart-2'),
        3: rgb('--chart-3'),
        4: rgb('--chart-4'),
        5: rgb('--chart-5'),
      },

      sidebar: {
        DEFAULT: rgb('--sidebar'),
        foreground: rgb('--sidebar-foreground'),
        primary: rgb('--sidebar-primary'),
        'primary-foreground': rgb('--sidebar-primary-foreground'),
        accent: rgb('--sidebar-accent'),
        'accent-foreground': rgb('--sidebar-accent-foreground'),
        border: rgb('--sidebar-border'),
        ring: rgb('--sidebar-ring'),
      },

      /* Text and icons only. Every one clears 4.5:1 on card and on its tint.
         Never use a status token as a fill behind light text. */
      status: {
        pending: rgb('--status-pending'),
        confirmed: rgb('--status-confirmed'),
        'in-service': rgb('--status-in-service'),
        completed: rgb('--status-completed'),
        cancelled: rgb('--status-cancelled'),
        'no-show': rgb('--status-no-show'),
      },

      /* Backgrounds only, always paired with the matching status text token. */
      tint: {
        pending: raw('--tint-pending'),
        confirmed: raw('--tint-confirmed'),
        'in-service': raw('--tint-in-service'),
        completed: raw('--tint-completed'),
        cancelled: raw('--tint-cancelled'),
        'no-show': raw('--tint-no-show'),
        brand: raw('--tint-brand'),
        chart: {
          1: raw('--tint-chart-1'),
          2: raw('--tint-chart-2'),
          3: raw('--tint-chart-3'),
          4: raw('--tint-chart-4'),
          5: raw('--tint-chart-5'),
        },
      },
    },

    /* ---- Breakpoints ---------------------------------------------------
     * Exactly the four ranges in DESIGN.md §5: mobile 0–767, tablet 768–1023,
     * desktop 1024–1439, wide 1440+. `md`/`lg` keep their existing meanings so
     * current markup is unaffected; `sm`, `xl` and `2xl` are removed so nobody
     * invents a range the system doesn't define.
     *
     * MIGRATION: sweep for `sm:`, `xl:` and `2xl:` before shipping this. */
    screens: {
      md: '768px',
      lg: '1024px',
      wide: '1440px',
    },

    /* ---- Type ----------------------------------------------------------
     * Line-height is baked into every step so §4's "body 1.6, headings 1.2"
     * is enforced rather than hoped for. Nothing below 14px is legal for
     * customer-facing booking copy; `text-xs` is metadata only. */
    fontSize: {
      xs: ['0.75rem', { lineHeight: '1rem' }],
      sm: ['0.875rem', { lineHeight: '1.25rem' }],
      base: ['1rem', { lineHeight: '1.6' }],
      lg: ['1.125rem', { lineHeight: '1.6' }],
      xl: ['1.25rem', { lineHeight: '1.3' }],
      '2xl': ['1.5rem', { lineHeight: '1.2' }],
      '3xl': ['1.875rem', { lineHeight: '1.2' }],
      '4xl': ['2.25rem', { lineHeight: '1.2' }],
    },

    /* ---- Shape ---------------------------------------------------------
     * Four visible steps. `rounded` defaults to md rather than Tailwind's 4px,
     * and there is no step above xl — `rounded-3xl` no longer resolves. */
    borderRadius: {
      none: '0',
      sm: 'var(--radius-sm)',
      DEFAULT: 'var(--radius-md)',
      md: 'var(--radius-md)',
      lg: 'var(--radius-lg)',
      xl: 'var(--radius-xl)',
      '2xl': 'var(--radius-xl)',
      full: '9999px',
    },

    /* ---- Elevation -----------------------------------------------------
     * Three tiers, keyed to how far a surface floats above the page. Alpha is
     * a token so dark mode can deepen — 10% black is invisible on #1c2433. */
    boxShadow: {
      none: 'none',
      card: '0 1px 3px rgb(var(--shadow) / var(--shadow-a1))',
      popover: '0 4px 10px rgb(var(--shadow) / var(--shadow-a2))',
      modal: '0 10px 30px rgb(var(--shadow) / var(--shadow-a3))',
    },

    /* ---- Stacking ------------------------------------------------------
     * One scale. `z-10`, `z-50` and arbitrary values no longer resolve.
     * `z-layer-popover` sits above `z-modal` because ConfirmDialog must paint
     * over the Modal that opened it. See DESIGN.md §6. */
    zIndex: {
      auto: 'auto',
      base: '0',
      sticky: '20',
      dropdown: '40',
      sidebar: '50',
      overlay: '60',
      drawer: '70',
      modal: '80',
      'layer-popover': '90',
      toast: '100',
    },

    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        /* One name per role. `font-display` was an alias for `font-serif`;
           the duplicate is removed so usage can't drift. */
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },

      /* Layout containers — DESIGN.md §5. 12 columns, 1440px cap, 24px gutter. */
      maxWidth: {
        content: '1440px',
        'modal-sm': '400px',
        'modal-md': '520px',
        'modal-lg': '720px',
        'drawer-sm': '360px',
        'drawer-md': '400px',
        'drawer-lg': '480px',
        popover: '360px',
      },

      /* Touch target floor — DESIGN.md §10. Sets the minimum time-slot button. */
      minWidth: { touch: '44px' },
      minHeight: { touch: '44px' },

      /* Motion — DESIGN.md §7. Named so 150/200/300 stops being retyped. */
      transitionDuration: {
        fast: '150ms',
        DEFAULT: '200ms',
        slow: '300ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0, 0, 0.2, 1)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 300ms cubic-bezier(0, 0, 0.2, 1) both',
      },
    },
  },

  future: {
    /* Don't leave hover styles stuck on after a tap. The owner's calendar is
       used on a tablet all day. */
    hoverOnlyWhenSupported: true,
  },

  plugins: [
    plugin(({ addUtilities, addComponents }) => {
      addUtilities({
        /* The last row of a scroll region never sits flush to the viewport.
           Applied once at DashboardLayout's <main>. */
        '.scroll-bottom-gap': { paddingBottom: '1.5rem' },
        '@media (min-width: 1024px)': {
          '.scroll-bottom-gap': { paddingBottom: '2rem' },
        },
        /* One backdrop for every overlay, rather than each surface choosing
           its own darkness. */
        '.overlay-backdrop': {
          backgroundColor: 'rgb(var(--overlay) / var(--overlay-alpha))',
        },
      });

      addComponents({
        /* The documented grid, as one class instead of a re-derived wrapper. */
        '.layout-grid': {
          display: 'grid',
          gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
          gap: '1.5rem',
          maxWidth: '1440px',
          marginInline: 'auto',
          paddingInline: '1.5rem',
        },
      });
    }),
  ],
};

export default config;
