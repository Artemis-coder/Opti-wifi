'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { useSpaceStore } from '@/lib/stores/spaceStore';
import { createClient } from '@/lib/supabase/client';

export function SpaceSelector() {
  const { currentSpaceId, spaces, setCurrentSpaceId, setSpaces } = useSpaceStore();
  const supabase = createClient();

  useEffect(() => {
    async function loadSpaces() {
      const { data } = await supabase.from('wifi_spaces').select('*').order('nom');
      if (data) {
        setSpaces(data);
        if (!currentSpaceId && data.length > 0) {
          setCurrentSpaceId(data[0].id);
        }
      }
    }
    loadSpaces();
  }, [setSpaces, setCurrentSpaceId, currentSpaceId, supabase]);

  const selectedSpace = spaces.find((s) => s.id === currentSpaceId);

  return (
    <div className="px-4 py-3 border-b border-slate-800/80">
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Espace Wi-Fi
        </label>
        {currentSpaceId && selectedSpace && (
          <Link
            href={`/spaces/${currentSpaceId}`}
            className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 hover:text-amber-300 uppercase tracking-wider"
            title="Voir le tableau de bord de cet espace"
          >
            Tableau de bord <ExternalLink className="w-2.5 h-2.5" />
          </Link>
        )}
      </div>
      <div className="relative">
        <select
          value={currentSpaceId || ''}
          onChange={(e) => setCurrentSpaceId(e.target.value)}
          className="w-full h-9 pl-3 pr-8 bg-slate-900/50 border border-slate-700 rounded-lg text-xs font-medium text-white appearance-none focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          {spaces.length === 0 && (
            <option value="">Aucun espace</option>
          )}
          {spaces.map((space) => (
            <option key={space.id} value={space.id}>
              {space.nom}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>
      {selectedSpace && (
        <p className="text-[10px] text-slate-400 mt-1 truncate">
          {selectedSpace.ville || selectedSpace.adresse || selectedSpace.description || 'Espace sélectionné'}
        </p>
      )}
    </div>
  );
}
