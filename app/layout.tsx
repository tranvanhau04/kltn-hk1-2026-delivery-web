import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/context/AppContext';

export const metadata: Metadata = {
  title: 'IUH Logistics – SmartExpress Platform',
  description: 'Hệ thống quản lý giao vận thông minh SmartExpress dành cho IUH Logistics',
  keywords: ['logistics', 'delivery', 'VRP', 'route optimization', 'IUH'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="h-full" data-scroll-behavior="smooth">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body className="h-full antialiased" suppressHydrationWarning>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
