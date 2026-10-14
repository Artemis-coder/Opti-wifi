'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

export function TelegramTestPanel() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [testType, setTestType] = useState<string>('build');

  const testNotification = async () => {
    setLoading(true);
    setResult('Envoi en cours...');
    
    try {
      const response = await fetch('/api/telegram/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getTestPayload(testType)),
      });
      
      const data = await response.json();
      setResult(data.ok ? '✅ Succès !' : `❌ Erreur: ${data.error}`);
    } catch (error) {
      setResult(`❌ Erreur: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const getTestPayload = (type: string) => {
    switch (type) {
      case 'build':
        return {
          type: 'build',
          project: 'OptiWifi',
          status: 'success',
          url: 'https://vercel.com/optiwifi',
          commit: 'abc1234',
          branch: 'main',
        };
      case 'database':
        return {
          type: 'database',
          alertType: 'connection',
          database: 'neondb',
          message: 'Test de connexion réussi',
          details: { test: true },
        };
      case 'error':
        return {
          type: 'error',
          source: 'Test Manual',
          error: 'Erreur de test volontaire',
          severity: 'medium',
          context: { test: true },
        };
      case 'custom':
        return {
          type: 'custom',
          title: 'Notification Personnalisée',
          message: 'Ceci est un test de notification personnalisée',
          emoji: '🎉',
          fields: { 'Clé 1': 'Valeur 1', 'Clé 2': 'Valeur 2' },
          url: 'https://www.optiwifi.site',
          urlText: 'Voir le site',
        };
      default:
        return {};
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <div className="space-y-4 p-4">
        <h3 className="text-lg font-semibold">Test Telegram Bot</h3>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">Type de notification</label>
          <select
            value={testType}
            onChange={(e) => setTestType(e.target.value)}
            disabled={loading}
            className="w-full h-11 px-4 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          >
            <option value="build">✅ Build Réussi</option>
            <option value="database">🔌 Alerte Base de Données</option>
            <option value="error">🔴 Erreur</option>
            <option value="custom">📢 Personnalisée</option>
          </select>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={testNotification} disabled={loading} className="w-full">
            {loading ? 'Envoi...' : 'Tester'}
          </Button>
          
          <Button onClick={() => { setTestType('build'); testNotification(); }} disabled={loading} variant="outline" className="w-full">
            Build Success
          </Button>
          
          <Button onClick={() => { setTestType('database'); testNotification(); }} disabled={loading} variant="secondary" className="w-full">
            Alerte DB
          </Button>
          
          <Button onClick={() => { setTestType('error'); testNotification(); }} disabled={loading} variant="danger" className="w-full">
            Erreur
          </Button>
          
          <Button onClick={() => { setTestType('custom'); testNotification(); }} disabled={loading} variant="ghost" className="w-full col-span-2">
            Personnalisée
          </Button>
        </div>

        {result && (
          <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm">
            {result}
          </div>
        )}

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Test de connexion : <a href="/api/telegram/test" target="_blank" className="underline text-brand-500">GET /api/telegram/test</a>
          </p>
        </div>
      </div>
    </Card>
  );
}