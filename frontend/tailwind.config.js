/**
 * Sistema de diseño de Disprova GyG.
 *
 * Los colores salen del póster de marca (public/brand/logo-reveal-poster.jpg):
 * "DISPROVA" en tinta casi negra y "GyG" en rojo sangre. Esa misma paleta ya
 * estaba escrita en features/store/theme.ts; aquí se expone a Tailwind para que
 * el panel deje de usar los grises genéricos de slate.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'serif'],
        body: ['"IBM Plex Sans"', 'sans-serif'],
      },
      colors: {
        // Rojo del "GyG" del logo.
        brand: {
          DEFAULT: '#A3221C',
          deep: '#7A1712',
          soft: '#F6E7E5',
        },
        // Dorado de acento, para cifras y separadores.
        gold: {
          DEFAULT: '#B8873A',
          soft: '#F3E9D8',
        },
        // Tinta del "DISPROVA" y sus derivados.
        ink: {
          DEFAULT: '#1C1512',
          soft: '#3A2E27',
        },
        muted: '#8A7F73',
        // Fondo de papel y bordes, igual que la tienda.
        parchment: '#FAF8F4',
        surface: '#FFFFFF',
        line: '#E8E1D6',
      },
      boxShadow: {
        card: '0 1px 2px rgba(28, 21, 18, 0.04), 0 8px 24px -12px rgba(28, 21, 18, 0.12)',
        lift: '0 2px 4px rgba(28, 21, 18, 0.06), 0 18px 40px -18px rgba(163, 34, 28, 0.28)',
        inset: 'inset 0 0 0 1px rgba(232, 225, 214, 1)',
      },
      borderRadius: {
        card: '0.875rem',
      },
      keyframes: {
        // Entrada de la intro de marca: el logo se revela desde el centro.
        brandReveal: {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
        // Barra lateral: el item activo crece desde arriba.
        navIn: {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'brand-reveal': 'brandReveal 620ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-up': 'fadeUp 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.2s ease-in-out infinite',
        'nav-in': 'navIn 260ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
}
