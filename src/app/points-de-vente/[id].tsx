import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from '@/tw';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { useDataStore, TicketType, CollectionItem, SaleItem } from '@/store/dataStore';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, ShoppingCart, ShieldAlert, X } from 'lucide-react';

export default function PointOfSaleDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { 
    pointsOfSale, 
    ticketTypes, 
    distributions, 
    sales, 
    collections, 
    getStock, 
    getExpectedCollection,
    distributeTickets,
    recordSale,
    createCollection
  } = useDataStore();

  const pos = pointsOfSale.find(p => p.id === id);

  // Modal states
  const [isDistributeOpen, setIsDistributeOpen] = useState(false);
  const [isSaleOpen, setIsSaleOpen] = useState(false);
  const [isCollectOpen, setIsCollectOpen] = useState(false);

  // Distribution Form State
  const [distTicketId, setDistTicketId] = useState('');
  const [distQty, setDistQty] = useState('');

  // Sale Form State (array of quantities for each ticket type)
  const [saleQuantities, setSaleQuantities] = useState<Record<string, string>>({});

  // Collection Form State
  const [collectedAmountInput, setCollectedAmountInput] = useState('');
  const [collectReason, setCollectReason] = useState('');
  const [collectComment, setCollectComment] = useState('');

  if (!pos) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500 font-poppins-medium">Point de vente introuvable</Text>
        <Button label="Retour" onPress={() => navigate(-1)} className="mt-4" />
      </View>
    );
  }

  // Calculate detailed stats per ticket type
  const ticketStats = ticketTypes.map(type => {
    const totalDist = distributions
      .filter(d => d.pointOfSaleId === pos.id && d.ticketTypeId === type.id)
      .reduce((sum, d) => sum + d.quantity, 0);

    const totalSold = sales
      .filter(s => s.pointOfSaleId === pos.id)
      .flatMap(s => s.items)
      .filter(item => item.ticketTypeId === type.id)
      .reduce((sum, item) => sum + item.quantity, 0);

    const remaining = totalDist - totalSold;

    return {
      type,
      totalDist,
      totalSold,
      remaining,
    };
  });

  // Calculate global POS stats
  const totalReceived = ticketStats.reduce((sum, s) => sum + s.totalDist, 0);
  const totalSold = ticketStats.reduce((sum, s) => sum + s.totalSold, 0);
  const stockRemaining = ticketStats.reduce((sum, s) => sum + s.remaining, 0);
  const caGenerated = sales
    .filter(s => s.pointOfSaleId === pos.id)
    .reduce((sum, s) => sum + s.totalAmount, 0);
  const totalCollected = collections
    .filter(c => c.pointOfSaleId === pos.id && c.status === 'validated')
    .reduce((sum, c) => sum + c.collectedAmount, 0);
  const totalDifference = collections
    .filter(c => c.pointOfSaleId === pos.id && c.status === 'validated')
    .reduce((sum, c) => sum + c.difference, 0);

  // History list
  const historyItems = [
    ...distributions.filter(d => d.pointOfSaleId === pos.id).map(d => ({
      type: 'distribution',
      date: d.distributedAt,
      label: `Distribution : +${d.quantity} tickets ${ticketTypes.find(t => t.id === d.ticketTypeId)?.name}`,
      amount: null
    })),
    ...sales.filter(s => s.pointOfSaleId === pos.id).map(s => ({
      type: 'sale',
      date: s.saleDate,
      label: `Vente de ${s.items.reduce((sum, item) => sum + item.quantity, 0)} tickets`,
      amount: `${s.totalAmount.toLocaleString('fr-FR')} FCFA`
    })),
    ...collections.filter(c => c.pointOfSaleId === pos.id).map(c => ({
      type: 'collection',
      date: c.collectionDate,
      label: `Collecte (${c.status === 'validated' ? 'Validée' : 'En attente'})`,
      amount: `${c.collectedAmount.toLocaleString('fr-FR')} FCFA`
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Form handlers
  const handleDistribute = () => {
    const qty = parseInt(distQty);
    const type = ticketTypes.find(t => t.id === distTicketId);
    if (!qty || !type) return;

    distributeTickets({
      pointOfSaleId: pos.id,
      ticketTypeId: distTicketId,
      quantity: qty,
      unitPrice: type.price
    });

    setDistQty('');
    setDistTicketId('');
    setIsDistributeOpen(false);
  };

  const handleSale = () => {
    const items: SaleItem[] = [];
    let totalAmount = 0;

    let hasError = false;

    ticketTypes.forEach(type => {
      const qtyStr = saleQuantities[type.id];
      if (!qtyStr) return;
      const qty = parseInt(qtyStr);
      if (!qty) return;

      const currentStock = getStock(pos.id, type.id);
      if (qty > currentStock) {
        alert(`Impossible d'enregistrer la vente. Le stock disponible de ${type.name} est de ${currentStock} tickets.`);
        hasError = true;
        return;
      }

      const itemAmount = qty * type.price;
      items.push({
        ticketTypeId: type.id,
        quantity: qty,
        unitPrice: type.price,
        totalAmount: itemAmount
      });
      totalAmount += itemAmount;
    });

    if (hasError || items.length === 0) return;

    recordSale({
      pointOfSaleId: pos.id,
      items,
      totalAmount,
      status: 'completed'
    } as any);

    setSaleQuantities({});
    setIsSaleOpen(false);
  };

  const expectedData = getExpectedCollection(pos.id);

  const handleCollect = () => {
    const collected = parseInt(collectedAmountInput);
    if (isNaN(collected)) return;

    const difference = collected - expectedData.expectedAmount;

    createCollection({
      pointOfSaleId: pos.id,
      expectedAmount: expectedData.expectedAmount,
      collectedAmount: collected,
      difference,
      status: 'pending',
      items: expectedData.items,
      reason: difference !== 0 ? collectReason : undefined,
      comment: collectComment || undefined
    });

    setCollectedAmountInput('');
    setCollectReason('');
    setCollectComment('');
    setIsCollectOpen(false);
  };

  return (
    <View className="flex-1 bg-gray-50">

      <ScrollView className="flex-1 px-4 py-6" contentContainerClassName="pb-10">
        
        {/* Quick Stats Summary */}
        <View className="flex-row flex-wrap justify-between mb-6">
          <Card className="w-[48%] mb-4">
            <Text className="text-gray-500 font-poppins-medium text-xs">Stock restant</Text>
            <Text className="text-xl font-poppins-bold text-gray-900 mt-1">{stockRemaining} tickets</Text>
            <Text className="text-[10px] text-gray-400 font-poppins-regular mt-1">Reçus: {totalReceived} | Vendus: {totalSold}</Text>
          </Card>
          <Card className="w-[48%] mb-4">
            <Text className="text-gray-500 font-poppins-medium text-xs">CA Généré</Text>
            <Text className="text-xl font-poppins-bold text-emerald-600 mt-1">{caGenerated.toLocaleString('fr-FR')} FCFA</Text>
          </Card>
          <Card className="w-[48%] mb-4">
            <Text className="text-gray-500 font-poppins-medium text-xs">Total Collecté</Text>
            <Text className="text-xl font-poppins-bold text-indigo-600 mt-1">{totalCollected.toLocaleString('fr-FR')} FCFA</Text>
          </Card>
          <Card className="w-[48%] mb-4">
            <Text className="text-gray-500 font-poppins-medium text-xs">Écart cumulé</Text>
            <Text className={`text-xl font-poppins-bold mt-1 ${totalDifference < 0 ? 'text-red-600' : 'text-gray-950'}`}>
              {totalDifference.toLocaleString('fr-FR')} FCFA
            </Text>
          </Card>
        </View>

        {/* Action Buttons */}
        <View className="flex-row gap-2 mb-6">
          <Button 
            variant="primary" 
            label="Distribuer" 
            onPress={() => setIsDistributeOpen(true)}
            className="flex-1"
          >
            <Plus size={18} color="white" />
          </Button>
          <Button 
            variant="secondary" 
            label="Vente" 
            onPress={() => setIsSaleOpen(true)}
            className="flex-1"
          >
            <ShoppingCart size={18} color="#1F2937" />
          </Button>
          <Button 
            variant="ghost" 
            label="Collecter" 
            onPress={() => setIsCollectOpen(true)}
            className="flex-1 border border-blue-200"
          />
        </View>

        {/* Detailed Stock Table */}
        <Text className="text-lg font-poppins-semibold text-gray-900 mb-3">Détail du stock</Text>
        <Card className="p-0 overflow-hidden mb-6">
          <View className="flex-row bg-gray-100 p-3 border-b border-gray-200">
            <Text className="flex-[2] font-poppins-semibold text-xs text-gray-700">Type</Text>
            <Text className="flex-1 font-poppins-semibold text-xs text-gray-700 text-center">Reçus</Text>
            <Text className="flex-1 font-poppins-semibold text-xs text-gray-700 text-center">Vendus</Text>
            <Text className="flex-1 font-poppins-semibold text-xs text-gray-700 text-right">Restants</Text>
          </View>
          {ticketStats.map(stat => (
            <View key={stat.type.id} className="flex-row p-3 border-b border-gray-100 items-center">
              <View className="flex-[2]">
                <Text className="font-poppins-semibold text-sm text-gray-900">{stat.type.name}</Text>
                <Text className="text-xs text-gray-400">{stat.type.price} FCFA</Text>
              </View>
              <Text className="flex-1 font-poppins-regular text-sm text-gray-600 text-center">{stat.totalDist}</Text>
              <Text className="flex-1 font-poppins-regular text-sm text-gray-600 text-center">{stat.totalSold}</Text>
              <Text className="flex-1 font-poppins-bold text-sm text-gray-900 text-right">{stat.remaining}</Text>
            </View>
          ))}
        </Card>

        {/* History */}
        <Text className="text-lg font-poppins-semibold text-gray-900 mb-3">Historique du point de vente</Text>
        <Card className="p-0 overflow-hidden">
          {historyItems.length === 0 ? (
            <View className="p-6 items-center">
              <Text className="text-gray-400 font-poppins-regular">Aucune opération enregistrée</Text>
            </View>
          ) : (
            historyItems.map((item, idx) => (
              <View key={idx} className="p-4 border-b border-gray-100 flex-row justify-between items-center">
                <View className="flex-1 pr-3">
                  <Text className="font-poppins-medium text-sm text-gray-900">{item.label}</Text>
                  <Text className="text-xs text-gray-400">{new Date(item.date).toLocaleDateString('fr-FR')} à {new Date(item.date).toLocaleTimeString('fr-FR')}</Text>
                </View>
                {item.amount && (
                  <Text className="font-poppins-bold text-sm text-gray-900">{item.amount}</Text>
                )}
              </View>
            ))
          )}
        </Card>

      </ScrollView>

      {/* Distribution Modal */}
      {isDistributeOpen && (
        <View className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <View className="bg-white rounded-2xl p-6 gap-4 w-full mx-4 max-h-[80vh] overflow-y-auto">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-xl font-poppins-bold text-gray-900 font-bold">Distribuer des tickets</Text>
              <Pressable onPress={() => setIsDistributeOpen(false)}>
                <X size={24} color="#374151" />
              </Pressable>
            </View>

            <Text className="font-poppins-medium text-sm text-gray-700">Type de ticket</Text>
            <View className="flex-row gap-2 flex-wrap mb-2">
              {ticketTypes.map(type => (
                <Pressable 
                  key={type.id} 
                  onPress={() => setDistTicketId(type.id)}
                  className={`px-4 py-2.5 rounded-xl border ${distTicketId === type.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'}`}
                >
                  <Text className={`font-poppins-semibold text-sm ${distTicketId === type.id ? 'text-blue-600' : 'text-gray-700'}`}>
                    {type.name} ({type.price} FCFA)
                  </Text>
                </Pressable>
              ))}
            </View>

            <Input 
              label="Quantité" 
              placeholder="ex: 10" 
              keyboardType="number-pad"
              value={distQty}
              onChangeText={setDistQty}
            />

            <Button 
              label="Valider la distribution" 
              onPress={handleDistribute} 
              className="mt-4"
            />
          </View>
        </View>
      )}

      {/* Vente Modal */}
      {isSaleOpen && (
        <View className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <View className="bg-white rounded-2xl p-6 gap-4 w-full mx-4 max-h-[80vh] overflow-y-auto">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-xl font-poppins-bold text-gray-900 font-bold">Enregistrer une vente</Text>
              <Pressable onPress={() => setIsSaleOpen(false)}>
                <X size={24} color="#374151" />
              </Pressable>
            </View>

            {ticketTypes.map(type => {
              const currentStock = getStock(pos.id, type.id);
              return (
                <View key={type.id} className="flex-row items-center justify-between border-b border-gray-100 pb-3">
                  <View className="flex-1">
                    <Text className="font-poppins-semibold text-sm text-gray-900">{type.name}</Text>
                    <Text className="text-xs text-gray-400">{type.price} FCFA · Stock: {currentStock}</Text>
                  </View>
                  <Input 
                    placeholder="0" 
                    keyboardType="number-pad"
                    value={saleQuantities[type.id] || ''}
                    onChangeText={(val) => setSaleQuantities(prev => ({ ...prev, [type.id]: val }))}
                    className="w-20 text-center h-10 border-gray-300"
                  />
                </View>
              );
            })}

            <Button 
              label="Valider la vente" 
              onPress={handleSale} 
              className="mt-4"
            />
          </View>
        </View>
      )}

      {/* Collecte Modal */}
      {isCollectOpen && (
        <View className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <View className="bg-white rounded-2xl p-6 gap-4 w-full mx-4 max-h-[80vh] overflow-y-auto">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-xl font-poppins-bold text-gray-900 font-bold">Effectuer une collecte</Text>
              <Pressable onPress={() => setIsCollectOpen(false)}>
                <X size={24} color="#374151" />
              </Pressable>
            </View>

            <View className="bg-gray-50 p-4 rounded-2xl mb-2">
              <Text className="text-gray-500 font-poppins-medium text-xs">Montant attendu (théorique)</Text>
              <Text className="text-2xl font-poppins-bold text-blue-600 mt-1">{expectedData.expectedAmount.toLocaleString('fr-FR')} FCFA</Text>
              <Text className="text-[10px] text-gray-400 font-poppins-regular mt-2">
                Basé sur les ventes enregistrées non collectées.
              </Text>
            </View>

            <Input 
              label="Montant collecté" 
              placeholder="ex: 18500" 
              keyboardType="number-pad"
              value={collectedAmountInput}
              onChangeText={setCollectedAmountInput}
            />

            {/* Difference logic representation */}
            {(() => {
              const collected = parseInt(collectedAmountInput);
              if (isNaN(collected)) return null;
              const diff = collected - expectedData.expectedAmount;
              if (diff === 0) return null;

              return (
                <View className="gap-3 mt-1">
                  <View className="flex-row items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <ShieldAlert size={18} color="#DC2626" />
                    <Text className="text-xs font-poppins-semibold text-red-700">
                      Écart de : {diff.toLocaleString('fr-FR')} FCFA
                    </Text>
                  </View>

                  <Text className="font-poppins-medium text-sm text-gray-700">Motif de l'écart</Text>
                  <View className="flex-row gap-2 flex-wrap">
                    {['Ticket non payé', 'Erreur de déclaration', 'Crédit accordé', 'Perte', 'Autre'].map(reason => (
                      <Pressable 
                        key={reason} 
                        onPress={() => setCollectReason(reason)}
                        className={`px-3 py-2 rounded-xl border ${collectReason === reason ? 'border-red-600 bg-red-50' : 'border-gray-200 bg-white'}`}
                      >
                        <Text className={`font-poppins-semibold text-xs ${collectReason === reason ? 'text-red-600' : 'text-gray-700'}`}>
                          {reason}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Input 
                    label="Commentaire additionnel" 
                    placeholder="Commentaire libre..." 
                    value={collectComment}
                    onChangeText={setCollectComment}
                  />
                </View>
              );
            })()}

            <Button 
              label="Enregistrer la collecte" 
              onPress={handleCollect} 
              className="mt-4"
            />
          </View>
        </View>
      )}
    </View>
  );
}
