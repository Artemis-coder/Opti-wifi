import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from '@/tw';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { useDataStore, TicketType } from '@/store/dataStore';
import { Stack, router } from 'expo-router';
import { ArrowLeft, Plus, X, Pencil } from 'lucide-react-native';
import { Modal } from 'react-native';

export default function TicketsScreen() {
  const { ticketTypes, addTicketType, updateTicketType } = useDataStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<TicketType | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [price, setPrice] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const handleOpenAdd = () => {
    setEditingTicket(null);
    setName('');
    setDuration('');
    setPrice('');
    setStatus('active');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ticket: TicketType) => {
    setEditingTicket(ticket);
    setName(ticket.name);
    setDuration(ticket.duration);
    setPrice(String(ticket.price));
    setStatus(ticket.status);
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    const numPrice = parseInt(price);
    if (!name || !duration || isNaN(numPrice)) return;

    if (editingTicket) {
      updateTicketType(editingTicket.id, {
        name,
        duration,
        price: numPrice,
        status,
      });
    } else {
      addTicketType({
        name,
        duration,
        price: numPrice,
        status,
      });
    }

    setIsModalOpen(false);
  };

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen options={{ 
        title: 'Types de Tickets',
        headerShown: true,
        headerLeft: () => (
          <Pressable onPress={() => router.back()} className="mr-4">
            <ArrowLeft size={24} color="#111827" />
          </Pressable>
        )
      }} />

      <ScrollView className="flex-1 p-4" contentContainerClassName="pb-10">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-gray-500 font-[Poppins_500Medium] text-sm">Tarification active</Text>
          <Button variant="ghost" label="Ajouter" onPress={handleOpenAdd} className="h-8 px-3">
            <Plus size={16} color="#2563EB" />
          </Button>
        </View>

        {ticketTypes.map((type) => (
          <Card key={type.id} className="mb-4 flex-row justify-between items-center p-4">
            <View>
              <View className="flex-row items-center gap-2 mb-1">
                <Text className="font-[Poppins_700Bold] text-base text-gray-900">{type.name}</Text>
                <View className={`px-2 py-0.5 rounded-full ${type.status === 'active' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <Text className={`text-[10px] font-[Poppins_600SemiBold] ${type.status === 'active' ? 'text-emerald-700' : 'text-red-700'}`}>
                    {type.status === 'active' ? 'Actif' : 'Inactif'}
                  </Text>
                </View>
              </View>
              <Text className="text-xs text-gray-400 font-[Poppins_400Regular]">Durée: {type.duration}</Text>
              <Text className="font-[Poppins_700Bold] text-sm text-blue-600 mt-1">{type.price.toLocaleString('fr-FR')} FCFA</Text>
            </View>

            <Button variant="secondary" label="" onPress={() => handleOpenEdit(type)} className="w-10 h-10 rounded-xl">
              <Pencil size={16} color="#4B5563" />
            </Button>
          </Card>
        ))}
      </ScrollView>

      {/* Add / Edit Ticket Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl p-6 gap-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-xl font-[Poppins_700Bold] text-gray-900 font-bold">
                {editingTicket ? 'Modifier le ticket' : 'Nouveau type de ticket'}
              </Text>
              <Pressable onPress={() => setIsModalOpen(false)}>
                <X size={24} color="#374151" />
              </Pressable>
            </View>

            <Input 
              label="Nom du ticket" 
              placeholder="ex: 24H" 
              value={name}
              onChangeText={setName}
            />
            <Input 
              label="Durée" 
              placeholder="ex: 24 heures" 
              value={duration}
              onChangeText={setDuration}
            />
            <Input 
              label="Prix unitaire (FCFA)" 
              placeholder="ex: 500" 
              keyboardType="number-pad"
              value={price}
              onChangeText={setPrice}
            />

            {editingTicket && (
              <View className="gap-2">
                <Text className="font-[Poppins_500Medium] text-sm text-gray-700">Statut du ticket</Text>
                <View className="flex-row gap-2">
                  <Pressable 
                    onPress={() => setStatus('active')}
                    className={`flex-1 py-3 rounded-xl border items-center ${status === 'active' ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200'}`}
                  >
                    <Text className={`font-[Poppins_600SemiBold] text-sm ${status === 'active' ? 'text-emerald-700' : 'text-gray-700'}`}>Actif</Text>
                  </Pressable>
                  <Pressable 
                    onPress={() => setStatus('inactive')}
                    className={`flex-1 py-3 rounded-xl border items-center ${status === 'inactive' ? 'border-red-600 bg-red-50' : 'border-gray-200'}`}
                  >
                    <Text className={`font-[Poppins_600SemiBold] text-sm ${status === 'inactive' ? 'text-red-700' : 'text-gray-700'}`}>Inactif</Text>
                  </Pressable>
                </View>
              </View>
            )}

            <Button 
              label={editingTicket ? 'Sauvegarder les modifications' : 'Créer le type de ticket'} 
              onPress={handleSubmit} 
              className="mt-4"
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
