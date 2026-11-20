import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from 'next-themes';
import { MobileBottomNav } from '@/components/MobileBottomNav';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'TrustPay Escrow',
  description: 'Secure Escrow for Freelancers and Clients on the Stellar Network',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* FOUC prevention script - runs before theme provider hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const shouldUseDark = theme === 'dark' || (theme === 'system' && prefersDark) || (!theme && prefersDark);
                document.documentElement.setAttribute('data-theme', shouldUseDark ? 'dark' : 'light');
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col pb-16 md:pb-0" suppressHydrationWarning>
        <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem storageKey="theme">
          {children}
          <MobileBottomNav />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
