import React from 'react';
import { View, Text, ScrollView, Pressable } from '@/tw';
import { Card } from '@/components/Card';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';
import { Ticket, History, LogOut, ChevronRight, Settings, Info } from 'lucide-react';

export default function PlusScreen() {
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    navigate('/(auth)/login');
  };

  const menuItems = [
    {
      title: 'Gestion des Tickets',
      description: 'Configurer les grilles tarifaires et durées.',
      icon: <Ticket size={22} color="#2563EB" />,
      onPress: () => navigate('/tickets'),
    },
    {
      title: 'Historique Général',
      description: 'Consulter toutes les opérations passées.',
      icon: <History size={22} color="#4F46E5" />,
      onPress: () => navigate('/historique'),
    },
  ];

  return (
    <ScrollView className="flex-1 bg-gray-50 p-4">
      <Text className="text-sm font-[Poppins_500Medium] text-gray-500 mb-4 mt-2">OPTIONS DE GESTION</Text>

      <Card className="p-0 overflow-hidden mb-6">
        {menuItems.map((item, idx) => (
          <Pressable
            key={item.title}
            onPress={item.onPress}
            className={`flex-row justify-between items-center p-4 border-b border-gray-100 active:bg-gray-50 ${
              idx === menuItems.length - 1 ? 'border-b-0' : ''
            }`}
          >
            <View className="flex-row items-center gap-4">
              <View className="bg-gray-50 p-2.5 rounded-xl">
                {item.icon}
              </View>
              <View>
                <Text className="font-[Poppins_600SemiBold] text-sm text-gray-900">{item.title}</Text>
                <Text className="text-xs text-gray-500 font-[Poppins_400Regular] mt-0.5">{item.description}</Text>
              </View>
            </View>
            <ChevronRight size={20} color="#9CA3AF" />
          </Pressable>
        ))}
      </Card>

      <Text className="text-sm font-[Poppins_500Medium] text-gray-500 mb-4">COMPTE</Text>

      <Card className="p-0 overflow-hidden mb-6">
        <Pressable
          onPress={handleLogout}
          className="flex-row justify-between items-center p-4 active:bg-gray-50"
        >
          <View className="flex-row items-center gap-4">
            <View className="bg-red-50 p-2.5 rounded-xl">
              <LogOut size={22} color="#DC2626" />
            </View>
            <View>
              <Text className="font-[Poppins_600SemiBold] text-sm text-red-600">Se déconnecter</Text>
              <Text className="text-xs text-gray-500 font-[Poppins_400Regular] mt-0.5">Fermer la session actuelle.</Text>
            </View>
          </View>
        </Pressable>
      </Card>
      
      {/* App Version Info */}
      <View className="items-center mt-6">
        <Text className="text-xs text-gray-400 font-[Poppins_400Regular]">Opti Wifi — V1.0 MVP</Text>
        <Text className="text-[10px] text-gray-400 font-[Poppins_400Regular] mt-1">Août 2026</Text>
      </View>
    </ScrollView>
  );
}
