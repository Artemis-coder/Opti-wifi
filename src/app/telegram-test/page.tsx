import { TelegramTestPanel } from '@/components/TelegramTestPanel';

export const metadata = {
  title: 'Test Telegram - OptiWifi',
};

export default function TelegramTestPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Test Telegram Bot</h1>
      <p className="text-muted-foreground mb-8">
        Testez les différents types de notifications Telegram. Assurez-vous d'avoir configuré 
        <code className="bg-muted px-1.5 py-0.5 rounded">TELEGRAM_BOT_TOKEN</code> et 
        <code className="bg-muted px-1.5 py-0.5 rounded">TELEGRAM_CHAT_ID</code> dans <code className="bg-muted px-1.5 py-0.5 rounded">.env.local</code>.
      </p>
      <TelegramTestPanel />
    </div>
  );
}