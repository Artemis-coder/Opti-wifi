import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from '@/tw';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { useDataStore } from '@/store/dataStore';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, User, MapPin, Ticket, Landmark, ChevronRight, X } from 'lucide-react';

export default function PointsDeVenteScreen() {
  const { pointsOfSale, addPointOfSale, getStock, sales, collections, ticketTypes } = useDataStore();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  
  // Form fields
  const [name, setName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const filteredPOS = pointsOfSale.filter(pos => 
    pos.name.toLowerCase().includes(search.toLowerCase()) || 
    pos.managerName.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    if (!name || !managerName || !phone || !address) return;
    addPointOfSale({
      name,
      managerName,
      phone,
      address,
      status: 'active',
    });
    // Reset and close
    setName('');
    setManagerName('');
    setPhone('');
    setAddress('');
    setIsModalOpen(false);
  };

  const getPOSStats = (posId: string) => {
    // Total stock
    const stock = ticketTypes.reduce((sum, type) => sum + getStock(posId, type.id), 0);
    
    // Total CA
    const posSales = sales.filter(s => s.pointOfSaleId === posId);
    const ca = posSales.reduce((sum, s) => sum + s.totalAmount, 0);

    // Last collection
    const posCols = collections.filter(c => c.pointOfSaleId === posId && c.status === 'validated');
    const lastCol = posCols.length > 0 
      ? new Date(posCols[posCols.length - 1].collectionDate).toLocaleDateString('fr-FR')
      : 'Aucune';

    return { stock, ca, lastCol };
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Search and Action Bar */}
      <View className="p-4 bg-white border-b border-gray-100 flex-row gap-2 items-center">
        <View className="flex-1 flex-row bg-gray-100 rounded-xl px-3 items-center h-12">
          <Search size={20} color="#9CA3AF" />
          <Input 
            placeholder="Rechercher un point de vente..." 
            value={search}
            onChangeText={setSearch}
            className="flex-1 bg-transparent border-0 h-12 text-sm"
          />
        </View>
        <Button 
          variant="primary" 
          label="" 
          onPress={() => setIsModalOpen(true)}
          className="w-12 h-12 rounded-xl"
        >
          <Plus size={24} color="white" />
        </Button>
      </View>

      {/* POS List */}
      <ScrollView className="flex-1 p-4" contentContainerClassName="pb-10">
        {filteredPOS.length === 0 ? (
          <View className="py-20 items-center justify-center">
            <Text className="text-gray-400 font-poppins-medium text-base mb-2">Aucun point de vente</Text>
            <Text className="text-gray-400 font-poppins-regular text-sm text-center px-6">
              Commencez par ajouter un nouveau point de vente en clicking sur le bouton "+".
            </Text>
          </View>
        ) : (
          filteredPOS.map(pos => {
            const stats = getPOSStats(pos.id);
            return (
              <Pressable 
                key={pos.id} 
                onPress={() => navigate(`/points-de-vente/${pos.id}`)}
                className="mb-4"
              >
                <Card className="flex-row justify-between items-center p-5">
                  <View className="flex-1 pr-4">
                    <View className="flex-row items-center gap-2 mb-2">
                      <Text className="text-lg font-poppins-bold text-gray-900">{pos.name}</Text>
                      <View className={`px-2 py-0.5 rounded-full ${pos.status === 'active' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                        <Text className={`text-xs font-poppins-semibold ${pos.status === 'active' ? 'text-emerald-700' : 'text-red-700'}`}>
                          {pos.status === 'active' ? 'Actif' : 'Inactif'}
                        </Text>
                      </View>
                    </View>

                    {/* Meta info */}
                    <View className="flex-row items-center gap-1.5 mb-1">
                      <User size={14} color="#6B7280" />
                      <Text className="text-sm font-poppins-regular text-gray-600">{pos.managerName}</Text>
                    </View>

                    <View className="flex-row items-center gap-1.5 mb-3">
                      <MapPin size={14} color="#6B7280" />
                      <Text className="text-sm font-poppins-regular text-gray-600">{pos.address}</Text>
                    </View>

                    {/* Stock & CA Overview */}
                    <View className="flex-row gap-4 border-t border-gray-100 pt-3">
                      <View className="flex-row items-center gap-1.5">
                        <Ticket size={16} color="#2563EB" />
                        <Text className="text-xs font-poppins-semibold text-gray-900">{stats.stock} restants</Text>
                      </View>
                      <View className="flex-row items-center gap-1.5">
                        <Landmark size={16} color="#059669" />
                        <Text className="text-xs font-poppins-semibold text-gray-900">{stats.ca.toLocaleString('fr-FR')} FCFA</Text>
                      </View>
                    </View>
                  </View>
                  <ChevronRight size={20} color="#9CA3AF" />
                </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Add POS Modal */}
      {isModalOpen && (
        <View className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <View className="bg-white rounded-2xl p-6 gap-4 w-full mx-4 max-h-[80vh] overflow-y-auto">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-xl font-poppins-bold text-gray-900 font-bold">Nouveau point de vente</Text>
              <Pressable onPress={() => setIsModalOpen(false)}>
                <X size={24} color="#374151" />
              </Pressable>
            </View>

            <Input 
              label="Nom de la boutique" 
              placeholder="ex: Boutique ABC" 
              value={name}
              onChangeText={setName}
            />
            <Input 
              label="Nom du responsable" 
              placeholder="ex: Jean Dupont" 
              value={managerName}
              onChangeText={setManagerName}
            />
            <Input 
              label="Téléphone" 
              placeholder="ex: +241 07 00 00 00" 
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            <Input 
              label="Adresse / Localisation" 
              placeholder="ex: Boulevard Triomphal" 
              value={address}
              onChangeText={setAddress}
            />

            <Button 
              label="Créer le point de vente" 
              onPress={handleCreate} 
              className="mt-4"
            />
          </View>
        </View>
      )}
    </View>
  );
}
