import type { Metadata } from 'next';
import './globals.css';
import { WalletContextProvider } from '@/components/WalletContextProvider';

export const metadata: Metadata = {
  title: 'Sentinel Finance — On-Chain Risk Controls & Emergency Containment',
  description: 'On-chain risk controls and emergency containment for autonomous financial strategies on Solana.',
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
