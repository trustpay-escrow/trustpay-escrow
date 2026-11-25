import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from 'next-themes';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { NetworkMismatchBanner } from '@/components/NetworkMismatchBanner';
import { CommandPalette } from '@/components/CommandPalette';
import { PerformanceTelemetryButton } from '@/components/PerformanceTelemetryModal';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://trustpay-escrow.vercel.app'),
  title: {
    default: "TrustPay Escrow",
    template: "%s | TrustPay Escrow",
  },
  description: "Secure Escrow for Freelancers and Clients on the Stellar Network",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "TrustPay Escrow",
    description: "Secure Escrow for Freelancers and Clients on the Stellar Network",
    url: "https://trustpay-escrow.vercel.app",
    siteName: "TrustPay Escrow",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TrustPay Escrow",
    description: "Secure Escrow for Freelancers and Clients on the Stellar Network",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
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
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#09090b" />
        {/* FOUC prevention script - runs before theme provider hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                let targetTheme = 'light';
                if (theme === 'oled') {
                  targetTheme = 'oled';
                } else if (theme === 'dark' || (theme === 'system' && prefersDark) || (!theme && prefersDark)) {
                  targetTheme = 'dark';
                }
                document.documentElement.setAttribute('data-theme', targetTheme);
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col pb-16 md:pb-0" suppressHydrationWarning>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="system"
          enableSystem
          themes={['light', 'dark', 'oled', 'system']}
          storageKey="theme"
        >
          <NetworkMismatchBanner />
          {children}
          <MobileBottomNav />
          <Toaster />
          <CommandPalette />
          <PerformanceTelemetryButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
