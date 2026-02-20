import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'gitbruv OAuth Test',
  description: 'OAuth test client for gitbruv',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0a0a0a', color: '#ededed' }}>
        {children}
      </body>
    </html>
  );
}
