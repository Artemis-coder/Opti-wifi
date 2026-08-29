import React, { useState } from 'react';
import { View, Text } from '@/tw';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleLogin = () => {
    setLoading(true);
    // Simulation d'un appel réseau
    setTimeout(() => {
      setLoading(false);
login({
         id: '1',
         firstName: 'Admin',
         lastName: 'System',
         role: 'ADMIN',
       });
       router.navigate('/(tabs)', { replace: true });
    }, 1000);
  };

  return (
    <View className="flex-1 bg-white justify-center px-6">
      <View className="mb-10 items-center">
        <Text className="text-3xl font-poppins-bold text-blue-600 mb-2">Opti Wifi</Text>
        <Text className="text-base font-poppins-regular text-gray-500 text-center">
          Connectez-vous pour gérer vos ventes et collectes de tickets.
        </Text>
      </View>

      <View className="gap-4">
        <Input
          label="Adresse email"
          placeholder="admin@optiwifi.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        
        <Input
          label="Mot de passe"
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Button
          label="Se connecter"
          onPress={handleLogin}
          loading={loading}
          className="mt-4"
        />
      </View>
    </View>
  );
}
