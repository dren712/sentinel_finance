import type { Metadata } from 'next';
import './globals.css';
import { WalletContextProvider } from '@/components/WalletContextProvider';

export const metadata: Metadata = {
  title: 'Sentinel Finance — Autonomous Robo-Portfolio with Postcondition Guarantees',
  description: 'Robo-portfolio for tokenized stocks on Solana enforcing user-defined financial guarantees at the transaction layer.',
  icons: {
    icon: '/Sentinel_Logo.png',
    shortcut: '/Sentinel_Logo.png',
    apple: '/Sentinel_Logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-sentinel-bg text-slate-100 min-h-screen">
        <WalletContextProvider>{children}</WalletContextProvider>
      </body>
    </html>
  );
}
