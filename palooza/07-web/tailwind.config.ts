// EN: Tailwind theme: brand colours chosen to keep WCAG AA contrast on the dark panel background.
// ES: Tema Tailwind: colores de marca elegidos para mantener contraste WCAG AA sobre el fondo oscuro.
// EN: Tailwind config (bright arcade theme on dark). / ES: Config de Tailwind (tema arcade brillante sobre oscuro).
import type { Config } from 'tailwindcss';

const config: Config = {
  // EN: Files scanned for class names. / ES: Archivos escaneados en busca de clases.
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // EN: Brand accents and panel tones. / ES: Acentos de marca y tonos de panel.
        pop: '#ff4fd8',
        zap: '#36e2ff',
        good: '#3ddc84',
        bad: '#ff5c6c',
        panel: '#151225',
        edge: '#2a2445',
      },
    },
  },
  plugins: [],
};
export default config;
