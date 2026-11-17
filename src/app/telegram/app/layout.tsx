import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'OptiSpace · Telegram',
  robots: { index: false, follow: false },
};

export default function TelegramMiniAppLayout({ children }: { children: React.ReactNode }) {
  return children;
}
