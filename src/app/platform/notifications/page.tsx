'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Loader2, Check, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export default function PlatformNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
        <span>Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notifications</h1>
          <p className="text-xs text-slate-500">Alertes et notifications système pour le Super Admin.</p>
        </div>
      </div>

      {notifications.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <Bell className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucune notification</h3>
          <p className="text-xs text-slate-500">Vous serez notifié(e) lorsqu&apos;il y aura des alertes système.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <Card key={n.id} className="p-4">
              <div className="flex items-start gap-3">
                <Bell className="w-5 h-5 text-amber-500 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{n.title}</h3>
                    <Badge variant={n.read ? 'neutral' : 'info'} className="text-xs">
                      {n.read ? 'Lue' : 'Nouvelle'}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{n.message}</p>
                  <p className="text-xs text-slate-500 mt-2">{new Date(n.created_at).toLocaleString('fr-FR')}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
