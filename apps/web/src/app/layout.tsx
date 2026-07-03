/**
 * Root Layout — Doc 12 §5 (application shell).
 *
 * Provides: HTML structure, global styles, font loading, metadata.
 * SEO: title + meta description per page via metadata API.
 */

import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Verity — Spec-First Verification for AI-Generated Code',
    template: '%s | Verity',
  },
  description:
    'Plan, generate, and verify software specifications against your codebase. Ensure your AI-generated code matches your spec.',
};

import { Providers } from '@/components/providers';
import { ThemeProvider } from '@/components/theme-provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
