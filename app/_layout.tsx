import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { CartProvider } from '../context/CartContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDB, seedDB } from '../database/db';

export default function RootLayout() {
  useEffect(() => {
    initDB();
    seedDB();
  }, []);
  return (
    // By wrapping <Stack> inside <CartProvider>, every single screen in our app
    // now has automatic access to the shopping cart data!
    <SafeAreaProvider>
      <CartProvider>
        <Stack screenOptions={{ headerShown: false }}>
          {/* This tells Expo Router to load our bottom tabs */}
          <Stack.Screen name="(tabs)" />
        </Stack>
      </CartProvider>
    </SafeAreaProvider>
  );
}

