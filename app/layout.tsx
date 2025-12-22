import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'M.R. B.A.L.L.S. 2.0 - Smart Parlay Generator',
  description: 'Machine-Randomized Bet-Assisted Leg-Lock System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
