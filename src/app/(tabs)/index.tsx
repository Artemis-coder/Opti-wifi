import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from '@/tw';
import { Card } from '@/components/Card';
import { useDataStore } from '@/store/dataStore';
import { useAuthStore } from '@/store/authStore';
import { TrendingUp, ShoppingBag, Landmark, Ticket, Store, ShieldAlert } from 'lucide-react';

export default function DashboardScreen() {
  const user = useAuthStore((state) => state.user);
  const { sales, collections, distributions, pointsOfSale } = useDataStore();
  const [filter, setFilter] = useState<'day' | 'week' | 'month'>('day');

  // Filter calculations based on dates
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const getFilteredSales = () => {
    return sales.filter(s => {
      const saleDate = new Date(s.saleDate);
      if (filter === 'day') return saleDate >= startOfDay;
      if (filter === 'week') return saleDate >= startOfWeek;
      return saleDate >= startOfMonth;
    });
  };

  const filteredSales = getFilteredSales();

  // KPI 1 & 2: Ventes (quantity sold)
  const totalTicketsSold = filteredSales.reduce((sum, s) => {
    return sum + s.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
  }, 0);

  // KPI 3: Chiffre d'affaires
  const revenue = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);

  // KPI 4: Montant collecté (validated only)
  const totalCollected = collections
    .filter(c => c.status === 'validated')
    .reduce((sum, c) => sum + c.collectedAmount, 0);

  // Écart total (validated only)
  const totalDifference = collections
    .filter(c => c.status === 'validated')
    .reduce((sum, c) => sum + c.difference, 0);

  // KPI 5: Tickets en circulation (Total distributed - Total sold)
  const totalDistributedQty = distributions.reduce((sum, d) => sum + d.quantity, 0);
  const totalSoldAllTime = sales.reduce((sum, s) => {
    return sum + s.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
  }, 0);
  const ticketsInCirculation = totalDistributedQty - totalSoldAllTime;

  // KPI 6: Points de vente actifs
  const activePOSCount = pointsOfSale.filter(pos => pos.status === 'active').length;

  // POS Performance ranking
  const posPerformance = pointsOfSale.map(pos => {
    const posSales = sales.filter(s => s.pointOfSaleId === pos.id);
    const qty = posSales.reduce((sum, s) => sum + s.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
    const amount = posSales.reduce((sum, s) => sum + s.totalAmount, 0);
    return {
      name: pos.name,
      qty,
      amount,
    };
  }).sort((a, b) => b.amount - a.amount);

  return (
    <ScrollView className="flex-1 bg-gray-50 px-4 py-6" contentContainerClassName="pb-10">
      {/* Header / Greetings */}
      <View className="mb-6">
        <Text className="text-gray-500 font-poppins-regular text-sm">Bienvenue,</Text>
        <Text className="text-2xl font-poppins-bold text-gray-900">{user?.firstName} {user?.lastName}</Text>
      </View>

      {/* Filter Switcher */}
      <View className="flex-row bg-gray-200 p-1 rounded-xl mb-6">
        <Pressable 
          onPress={() => setFilter('day')}
          className={`flex-1 py-2.5 rounded-lg items-center ${filter === 'day' ? 'bg-white shadow-sm' : ''}`}
        >
          <Text className={`font-poppins-semibold text-xs ${filter === 'day' ? 'text-blue-600' : 'text-gray-600'}`}>Aujourd'hui</Text>
        </Pressable>
        <Pressable 
          onPress={() => setFilter('week')}
          className={`flex-1 py-2.5 rounded-lg items-center ${filter === 'week' ? 'bg-white shadow-sm' : ''}`}
        >
          <Text className={`font-poppins-semibold text-xs ${filter === 'week' ? 'text-blue-600' : 'text-gray-600'}`}>Cette semaine</Text>
        </Pressable>
        <Pressable 
          onPress={() => setFilter('month')}
          className={`flex-1 py-2.5 rounded-lg items-center ${filter === 'month' ? 'bg-white shadow-sm' : ''}`}
        >
          <Text className={`font-poppins-semibold text-xs ${filter === 'month' ? 'text-blue-600' : 'text-gray-600'}`}>Ce mois</Text>
        </Pressable>
      </View>

      {/* KPI Cards Grid */}
      <View className="flex-row flex-wrap justify-between mb-6">
        <Card className="w-[48%] mb-4 border-l-4 border-l-blue-600 p-4">
          <View className="bg-blue-50 p-2 rounded-lg w-10 h-10 items-center justify-center mb-3">
            <ShoppingBag size={20} color="#2563EB" />
          </View>
          <Text className="text-gray-500 font-poppins-medium text-xs">Ventes</Text>
          <Text className="text-xl font-poppins-bold text-gray-900 mt-1">{totalTicketsSold} tickets</Text>
        </Card>

        <Card className="w-[48%] mb-4 border-l-4 border-l-emerald-600 p-4">
          <View className="bg-emerald-50 p-2 rounded-lg w-10 h-10 items-center justify-center mb-3">
            <TrendingUp size={20} color="#059669" />
          </View>
          <Text className="text-gray-500 font-poppins-medium text-xs">Chiffre d'affaires</Text>
          <Text className="text-lg font-poppins-bold text-gray-900 mt-1">{revenue.toLocaleString('fr-FR')} FCFA</Text>
        </Card>

        <Card className="w-[48%] mb-4 border-l-4 border-l-indigo-600 p-4">
          <View className="bg-indigo-50 p-2 rounded-lg w-10 h-10 items-center justify-center mb-3">
            <Landmark size={20} color="#4F46E5" />
          </View>
          <Text className="text-gray-500 font-poppins-medium text-xs">Collecté (Validé)</Text>
          <Text className="text-lg font-poppins-bold text-gray-900 mt-1">{totalCollected.toLocaleString('fr-FR')} FCFA</Text>
        </Card>

        <Card className="w-[48%] mb-4 border-l-4 border-l-red-600 p-4">
          <View className="bg-red-50 p-2 rounded-lg w-10 h-10 items-center justify-center mb-3">
            <ShieldAlert size={20} color="#DC2626" />
          </View>
          <Text className="text-gray-500 font-poppins-medium text-xs">Écart cumulé</Text>
          <Text className={`text-lg font-poppins-bold mt-1 ${totalDifference < 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {totalDifference.toLocaleString('fr-FR')} FCFA
          </Text>
        </Card>

        <Card className="w-[48%] mb-4 border-l-4 border-l-amber-500 p-4">
          <View className="bg-amber-50 p-2 rounded-lg w-10 h-10 items-center justify-center mb-3">
            <Ticket size={20} color="#D97706" />
          </View>
          <Text className="text-gray-500 font-poppins-medium text-xs">En circulation</Text>
          <Text className="text-lg font-poppins-bold text-gray-900 mt-1">{ticketsInCirculation} tickets</Text>
        </Card>

        <Card className="w-[48%] mb-4 border-l-4 border-l-cyan-600 p-4">
          <View className="bg-cyan-50 p-2 rounded-lg w-10 h-10 items-center justify-center mb-3">
            <Store size={20} color="#0891B2" />
          </View>
          <Text className="text-gray-500 font-poppins-medium text-xs">Points de vente</Text>
          <Text className="text-lg font-poppins-bold text-gray-900 mt-1">{activePOSCount} actifs</Text>
        </Card>
      </View>

      {/* Performance List */}
      <Text className="text-lg font-poppins-semibold text-gray-900 mb-4">Classement des points de vente</Text>
      <Card className="p-0 overflow-hidden mb-6">
        {posPerformance.length === 0 ? (
          <View className="p-6 items-center">
            <Text className="text-gray-400 font-poppins-regular">Aucune donnée disponible</Text>
          </View>
        ) : (
          posPerformance.map((pos, idx) => (
            <View 
              key={pos.name} 
              className={`flex-row justify-between items-center p-4 border-b border-gray-100 ${idx === posPerformance.length - 1 ? 'border-b-0' : ''}`}
            >
              <View className="flex-row items-center gap-3">
                <View className="bg-gray-100 rounded-full w-8 h-8 items-center justify-center">
                  <Text className="font-poppins-bold text-sm text-gray-700">{idx + 1}</Text>
                </View>
                <View>
                  <Text className="font-poppins-semibold text-sm text-gray-900">{pos.name}</Text>
                  <Text className="text-xs text-gray-500">{pos.qty} tickets vendus</Text>
                </View>
              </View>
              <Text className="font-poppins-bold text-sm text-blue-600">
                {pos.amount.toLocaleString('fr-FR')} FCFA
              </Text>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}
