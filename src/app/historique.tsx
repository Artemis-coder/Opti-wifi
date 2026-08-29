import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from '@/tw';
import { Card } from '@/components/Card';
import { useDataStore } from '@/store/dataStore';
import { Stack, router } from 'expo-router';
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Landmark, Filter } from 'lucide-react-native';

export default function HistoriqueScreen() {
  const { distributions, sales, collections, pointsOfSale, ticketTypes } = useDataStore();
  const [filter, setFilter] = useState<'all' | 'distribution' | 'sale' | 'collection'>('all');

  const getPOSName = (posId: string) => {
    return pointsOfSale.find(p => p.id === posId)?.name || 'Point de vente inconnu';
  };

  // Compile general history items
  const historyItems = [
    ...distributions.map(d => ({
      type: 'distribution' as const,
      date: d.distributedAt,
      label: `Distribution : +${d.quantity} tickets ${ticketTypes.find(t => t.id === d.ticketTypeId)?.name}`,
      subtitle: `Remis à ${getPOSName(d.pointOfSaleId)}`,
      amount: null
    })),
    ...sales.map(s => ({
      type: 'sale' as const,
      date: s.saleDate,
      label: `Vente de ${s.items.reduce((sum, item) => sum + item.quantity, 0)} tickets`,
      subtitle: `Enregistré par ${getPOSName(s.pointOfSaleId)}`,
      amount: `+${s.totalAmount.toLocaleString('fr-FR')} FCFA`
    })),
    ...collections.map(c => ({
      type: 'collection' as const,
      date: c.collectionDate,
      label: `Recouvrement Collecte`,
      subtitle: `${getPOSName(c.pointOfSaleId)} (${c.status === 'validated' ? 'Validé' : 'En attente'})`,
      amount: `${c.collectedAmount.toLocaleString('fr-FR')} FCFA`
    }))
  ]
  .filter(item => filter === 'all' || item.type === filter)
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen options={{ 
        title: 'Historique Général',
        headerShown: true,
        headerLeft: () => (
          <Pressable onPress={() => router.back()} className="mr-4">
            <ArrowLeft size={24} color="#111827" />
          </Pressable>
        )
      }} />

      {/* Filter Tabs */}
      <View className="flex-row bg-white border-b border-gray-100 p-3 gap-2 overflow-x-scroll">
        {[
          { key: 'all', label: 'Tout' },
          { key: 'distribution', label: 'Distributions' },
          { key: 'sale', label: 'Ventes' },
          { key: 'collection', label: 'Collectes' }
        ].map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setFilter(item.key as any)}
            className={`px-4 py-2 rounded-xl ${
              filter === item.key ? 'bg-blue-600' : 'bg-gray-100'
            }`}
          >
            <Text
              className={`font-[Poppins_600SemiBold] text-xs ${
                filter === item.key ? 'text-white' : 'text-gray-600'
              }`}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Operations List */}
      <ScrollView className="flex-1 p-4" contentContainerClassName="pb-10">
        {historyItems.length === 0 ? (
          <View className="py-20 items-center justify-center">
            <Text className="text-gray-400 font-[Poppins_500Medium] text-base mb-1">Aucune transaction</Text>
            <Text className="text-gray-400 font-[Poppins_400Regular] text-xs text-center">
              Les opérations apparaîtront au fur et à mesure de l'activité.
            </Text>
          </View>
        ) : (
          historyItems.map((item, idx) => {
            const isDistribution = item.type === 'distribution';
            const isSale = item.type === 'sale';
            
            return (
              <Card key={idx} className="mb-4 flex-row justify-between items-center p-4">
                <View className="flex-row items-center gap-3 flex-1 pr-3">
                  <View className={`p-2.5 rounded-xl ${
                    isDistribution 
                      ? 'bg-blue-50' 
                      : isSale 
                      ? 'bg-emerald-50' 
                      : 'bg-indigo-50'
                  }`}>
                    {isDistribution ? (
                      <ArrowUpRight size={20} color="#2563EB" />
                    ) : isSale ? (
                      <ArrowDownLeft size={20} color="#059669" />
                    ) : (
                      <Landmark size={20} color="#4F46E5" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="font-[Poppins_600SemiBold] text-sm text-gray-900" numberOfLines={1}>
                      {item.label}
                    </Text>
                    <Text className="text-xs text-gray-500 font-[Poppins_500Medium] mt-0.5" numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                    <Text className="text-[10px] text-gray-400 font-[Poppins_400Regular] mt-1">
                      {new Date(item.date).toLocaleDateString('fr-FR')} à {new Date(item.date).toLocaleTimeString('fr-FR')}
                    </Text>
                  </View>
                </View>
                {item.amount && (
                  <Text className={`font-[Poppins_700Bold] text-sm ${isSale ? 'text-emerald-600' : 'text-gray-950'}`}>
                    {item.amount}
                  </Text>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
