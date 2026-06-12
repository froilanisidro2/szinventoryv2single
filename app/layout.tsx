import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { PortalLayout } from './portal-layout.tsx';
import { Toaster } from 'sonner';

// Inline script runs synchronously before React hydrates — prevents flash of wrong theme
const themeScript = `
  try {
    var t = localStorage.getItem('theme');
    if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch(e) {}
`;

export const metadata: Metadata = {
  title: 'SprintZeroPH Inventory Management System',
  description: 'SprintZeroPH Inventory Management System — professional stock, invoicing, and order management for SMEs',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.jpg',
    apple: '/favicon.jpg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SprintZeroPH IMS',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#0ea5e9',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SprintZeroPH IMS" />
        <meta name="msapplication-TileColor" content="#0ea5e9" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        {/* Blocking script prevents flash of wrong theme before React hydrates */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-gray-50 dark:bg-gray-950">
        <Providers>
          <PortalLayout>{children}</PortalLayout>
          <Toaster position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
