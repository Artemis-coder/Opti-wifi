'use client';

import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  Loader2,
  Calendar,
  User,
  Building2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { formatDateFR } from '@/lib/utils/format';
import { PlatformAuditLogWithUser } from '@/types/platform';

export default function PlatformAuditLogsPage() {
  const [logs, setLogs] = useState<PlatformAuditLogWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadLogs();
  }, [actionFilter, entityTypeFilter, startDate, endDate]);

  async function loadLogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        action: actionFilter,
        entity_type: entityTypeFilter,
        start_date: startDate,
        end_date: endDate,
      });
      const res = await fetch(`/api/platform/audit-logs?${params}`);
      const result = await res.json();
      if (res.ok) {
        setLogs(result.data || []);
      }
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'organization.activate': 'Activation',
      'organization.suspend': 'Suspension',
      'organization.reactivate': 'Réactivation',
      'organization.cancel': 'Annulation',
      'plan.create': 'Création de plan',
      'plan.update': 'Modification de plan',
      'plan.delete': 'Suppression de plan',
      'subscription.cancel': 'Annulation d&apos;abonnement',
      'subscription.reactivate': 'Réactivation d&apos;abonnement',
      'subscription.suspend': 'Suspension d&apos;abonnement',
      'impersonate_access': 'Accès support',
    };
    return labels[action] || action;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Journal d&apos;Audit</h1>
          <p className="text-xs text-slate-500">Historique complet des actions administratives.</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrer par action..."
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <Input
            label="Type d'entité"
            placeholder="organization, plan, subscription..."
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
          />
          <Input
            label="Date de début"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="Date de fin"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </Card>

      {/* Table */}
      {loading ? (
        <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          <span>Chargement des logs...</span>
        </div>
      ) : logs.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <History className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucune entrée d&apos;audit</h3>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Date/Heure</th>
                  <th className="px-4 py-3">Utilisateur</th>
                  <th className="px-4 py-3">Organisation</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">ID Entité</th>
                  <th className="px-4 py-3 text-right">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {logs.map((log) => {
                  const isExpanded = expandedRows.has(log.id);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 text-slate-500">
                        {formatDateFR(log.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {log.platform_user ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[#0b1a3a] text-amber-400 flex items-center justify-center font-bold text-xs">
                              {log.platform_user.full_name?.[0] || log.platform_user.email?.[0] || 'S'}
                            </div>
                            <span className="text-slate-900 dark:text-white">
                              {log.platform_user.full_name || log.platform_user.email || 'Super Admin'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {log.organization?.name || 'Plateforme'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="info" className="text-xs">
                          {getActionLabel(log.action)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {log.entity_type || '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {log.entity_id || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(log.old_data || log.new_data) && (
                          <button
                            onClick={() => toggleExpand(log.id)}
                            className="p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            aria-label={isExpanded ? 'Réduire' : 'Détails'}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Expanded Detail Rows */}
          {Array.from(expandedRows).map((id) => {
            const log = logs.find((l) => l.id === id);
            if (!log) return null;
            return (
              <div key={`detail-${id}`} className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 mx-4">
                <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {log.old_data && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Anciennes valeurs</p>
                      <pre className="text-[10px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 p-2 rounded overflow-x-auto">
                        {JSON.stringify(log.old_data, null, 2)}
                      </pre>
                    </div>
                  )}
                  {log.new_data && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Nouvelles valeurs</p>
                      <pre className="text-[10px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 p-2 rounded overflow-x-auto">
                        {JSON.stringify(log.new_data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
