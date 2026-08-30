'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ExternalLink, MapPin } from 'lucide-react';
import { useSpaceStore } from '@/lib/stores/spaceStore';
import { createClient } from '@/lib/supabase/client';

export function SpaceSelector() {
  const { currentSpaceId, spaces, setCurrentSpaceId, setSpaces } = useSpaceStore();
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);

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
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full h-9 pl-3 pr-8 bg-slate-900/50 border border-slate-700 rounded-lg text-xs font-medium text-white text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <span className={isOpen ? 'text-white' : 'text-slate-400'}>
            {selectedSpace?.nom || 'Aucun espace'}
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-slate-900/95 border border-slate-700 rounded-lg max-h-60 overflow-y-auto backdrop-blur-sm">
            {spaces.map((space) => {
              const isSelected = space.id === currentSpaceId;
              return (
                <button
                  key={space.id}
                  onClick={() => {
                    setCurrentSpaceId(space.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-xs hover:bg-slate-800/60 transition ${
                    isSelected ? 'bg-amber-500/10 text-amber-400 font-medium' : 'text-slate-300'
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  <span className="truncate">{space.nom}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {selectedSpace && (
        <p className="text-[10px] text-slate-400 mt-1 truncate">
          {selectedSpace.ville || selectedSpace.adresse || selectedSpace.description || 'Espace sélectionné'}
        </p>
      )}
    </div>
  );
}
