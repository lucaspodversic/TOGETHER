/**
 * EN: Root layout: providers, nav and skip-link for keyboard users.
 * ES: Layout raíz: providers, navegación y skip-link para teclado.
 * EN: Locale defaults from the browser and can be switched in the nav.
 * ES: El idioma se toma del navegador y puede cambiarse en la navegación.
 */
/**
 * EN: Root layout: app context (session + locale) and navigation. Skip link for keyboard users.
 * ES: Layout raíz: contexto (sesión + idioma) y navegación. Enlace de salto para teclado.
 */
import './globals.css';
import type { ReactNode } from 'react';
import { AppProvider } from '@/lib/session';
import { Nav } from '@/components/Nav';

export const metadata = { title: 'Palooza (dev build)', description: 'Palooza casual games reference build' };

// EN: `RootLayout` — see file header for its role in the flow.
// ES: `RootLayout` — ver encabezado del archivo para su papel en el flujo.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only">Skip to content / Ir al contenido</a>
        <AppProvider>
          <Nav />
          <main id="main" className="p-4 max-w-5xl mx-auto">{children}</main>
        </AppProvider>
      </body>
    </html>
  );
}
