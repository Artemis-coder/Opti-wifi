import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from '@/tw';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { useDataStore, Collection } from '@/store/dataStore';
import { Check, X, ShieldAlert, Calendar, User, Landmark, HelpCircle } from 'lucide-react-native';
import { Modal } from 'react-native';

export default function CollectesScreen() {
  const { collections, pointsOfSale, validateCollection, ticketTypes } = useDataStore();
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'validated'>('all');

  const filteredCols = collections.filter(c => {
    if (filter === 'pending') return c.status === 'pending';
    if (filter === 'validated') return c.status === 'validated';
    return true;
  });

  const getPOSName = (posId: string) => {
    return pointsOfSale.find(p => p.id === posId)?.name || 'Point de vente inconnu';
  };

  const handleValidate = (id: string) => {
    validateCollection(id);
    setSelectedCollection(null);
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Filter Header */}
      <View className="flex-row bg-white border-b border-gray-100 p-3 gap-2">
        {['all', 'pending', 'validated'].map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f as any)}
            className={`px-4 py-2 rounded-xl ${
              filter === f ? 'bg-blue-600' : 'bg-gray-100'
            }`}
          >
            <Text
              className={`font-[Poppins_600SemiBold] text-xs ${
                filter === f ? 'text-white' : 'text-gray-600'
              }`}
            >
              {f === 'all' ? 'Toutes' : f === 'pending' ? 'En attente' : 'Validées'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Collections List */}
      <ScrollView className="flex-1 p-4" contentContainerClassName="pb-10">
        {filteredCols.length === 0 ? (
          <View className="py-20 items-center justify-center">
            <Text className="text-gray-400 font-[Poppins_500Medium] text-base mb-1">Aucune collecte</Text>
            <Text className="text-gray-400 font-[Poppins_400Regular] text-xs text-center px-6">
              Les collectes enregistrées auprès des points de vente s'afficheront ici.
            </Text>
          </View>
        ) : (
          filteredCols.map((c) => {
            const hasDifference = c.difference !== 0;
            return (
              <Pressable
                key={c.id}
                onPress={() => setSelectedCollection(c)}
                className="mb-4"
              >
                <Card className="p-4 border-l-4 border-l-blue-600">
                  <View className="flex-row justify-between items-start mb-2">
                    <View>
                      <Text className="font-[Poppins_700Bold] text-base text-gray-900">
                        {getPOSName(c.pointOfSaleId)}
                      </Text>
                      <Text className="text-xs text-gray-400 font-[Poppins_400Regular] flex-row items-center gap-1 mt-0.5">
                        {new Date(c.collectionDate).toLocaleDateString('fr-FR')} à {new Date(c.collectionDate).toLocaleTimeString('fr-FR')}
                      </Text>
                    </View>
                    <View
                      className={`px-2.5 py-1 rounded-full ${
                        c.status === 'validated'
                          ? 'bg-emerald-50'
                          : c.status === 'pending'
                          ? 'bg-amber-50'
                          : 'bg-red-50'
                      }`}
                    >
                      <Text
                        className={`text-xs font-[Poppins_600SemiBold] ${
                          c.status === 'validated'
                            ? 'text-emerald-700'
                            : c.status === 'pending'
                            ? 'text-amber-700'
                            : 'text-red-700'
                        }`}
                      >
                        {c.status === 'validated' ? 'Validée' : 'En attente'}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row justify-between items-center border-t border-gray-100 pt-3 mt-1">
                    <View>
                      <Text className="text-gray-400 font-[Poppins_500Medium] text-[10px]">Montant attendu</Text>
                      <Text className="font-[Poppins_600SemiBold] text-sm text-gray-900">
                        {c.expectedAmount.toLocaleString('fr-FR')} FCFA
                      </Text>
                    </View>
                    <View>
                      <Text className="text-gray-400 font-[Poppins_500Medium] text-[10px] text-right">Montant collecté</Text>
                      <Text className="font-[Poppins_700Bold] text-sm text-blue-600 text-right">
                        {c.collectedAmount.toLocaleString('fr-FR')} FCFA
                      </Text>
                    </View>
                  </View>

                  {hasDifference && (
                    <View className="flex-row items-center gap-1.5 bg-red-50 border border-red-100 p-2 rounded-xl mt-3">
                      <ShieldAlert size={14} color="#DC2626" />
                      <Text className="text-xs font-[Poppins_600SemiBold] text-red-700">
                        Écart : {c.difference.toLocaleString('fr-FR')} FCFA ({c.reason})
                      </Text>
                    </View>
                  )}
                </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Collect Details / Action Modal */}
      <Modal visible={!!selectedCollection} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/40">
          {selectedCollection && (
            <View className="bg-white rounded-t-3xl p-6 gap-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-xl font-[Poppins_700Bold] text-gray-900">
                  Détail de la collecte
                </Text>
                <Pressable onPress={() => setSelectedCollection(null)}>
                  <X size={24} color="#374151" />
                </Pressable>
              </View>

              <View className="gap-2">
                <Text className="font-[Poppins_700Bold] text-base text-gray-900">
                  {getPOSName(selectedCollection.pointOfSaleId)}
                </Text>
                <Text className="text-xs text-gray-500 font-[Poppins_400Regular]">
                  Date de dépôt : {new Date(selectedCollection.collectionDate).toLocaleString('fr-FR')}
                </Text>
              </View>

              {/* Tickets Details in Collection */}
              <View className="bg-gray-50 p-4 rounded-2xl gap-3">
                <Text className="font-[Poppins_600SemiBold] text-sm text-gray-700">Détails des ventes déclarées :</Text>
                {selectedCollection.items.map((item, idx) => {
                  const type = ticketTypes.find(t => t.id === item.ticketTypeId);
                  return (
                    <View key={idx} className="flex-row justify-between items-center">
                      <Text className="font-[Poppins_400Regular] text-sm text-gray-600">
                        {type?.name} (x{item.quantitySold})
                      </Text>
                      <Text className="font-[Poppins_600SemiBold] text-sm text-gray-900">
                        {item.totalAmount.toLocaleString('fr-FR')} FCFA
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View className="flex-row justify-between border-t border-gray-100 pt-3">
                <View>
                  <Text className="text-gray-500 font-[Poppins_500Medium] text-xs">Montant attendu</Text>
                  <Text className="font-[Poppins_600SemiBold] text-base text-gray-900 mt-1">
                    {selectedCollection.expectedAmount.toLocaleString('fr-FR')} FCFA
                  </Text>
                </View>
                <View>
                  <Text className="text-gray-500 font-[Poppins_500Medium] text-xs text-right">Montant collecté</Text>
                  <Text className="font-[Poppins_700Bold] text-base text-blue-600 text-right mt-1">
                    {selectedCollection.collectedAmount.toLocaleString('fr-FR')} FCFA
                  </Text>
                </View>
              </View>

              {selectedCollection.difference !== 0 && (
                <View className="bg-red-50 border border-red-200 p-4 rounded-2xl gap-2">
                  <View className="flex-row items-center gap-2">
                    <ShieldAlert size={18} color="#DC2626" />
                    <Text className="font-[Poppins_700Bold] text-sm text-red-700">
                      Écart constaté : {selectedCollection.difference.toLocaleString('fr-FR')} FCFA
                    </Text>
                  </View>
                  <Text className="font-[Poppins_500Medium] text-xs text-red-800">
                    Motif : {selectedCollection.reason}
                  </Text>
                  {selectedCollection.comment && (
                    <Text className="font-[Poppins_400Regular] text-xs text-red-800 italic">
                      Commentaire : "{selectedCollection.comment}"
                    </Text>
                  )}
                </View>
              )}

              {/* Action buttons if status is pending */}
              {selectedCollection.status === 'pending' && (
                <View className="flex-row gap-2 mt-4">
                  <Button
                    variant="primary"
                    label="Valider la collecte"
                    onPress={() => handleValidate(selectedCollection.id)}
                    className="flex-1"
                  >
                    <Check size={18} color="white" />
                  </Button>
                </View>
              )}
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}
