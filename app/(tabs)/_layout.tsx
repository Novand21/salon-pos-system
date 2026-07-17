import { db } from "@/database/db";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// NAVIGATION BAR LAYOUT PURPOSE BUT NOT USED FOR NOW
// import * as NavigationBar from "expo-navigation-bar";
// import { useEffect } from "react";

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  // recap data will be deleted if older than 2 years
  useEffect(() => {
    try {
      // Delete main transactions and expenses older than 2 years
      db.runSync(
        "DELETE FROM Transactions WHERE timestamp <= datetime('now', '-2 years')",
      );
      db.runSync(
        "DELETE FROM Expenditures WHERE timestamp <= datetime('now', '-2 years')",
      );

      // Clean up any orphaned child items
      db.runSync(
        "DELETE FROM Transaction_Items WHERE transaction_id NOT IN (SELECT id FROM Transactions)",
      );

      console.log("Database auto-cleanup completed.");
    } catch (e) {
      console.error("Auto-clean failed:", e);
    }
  }, []);
  return (
    <View style={{ flex: 1, paddingBottom: insets.bottom }}>
      <StatusBar style="light" backgroundColor="#000000" />
      <Tabs
        screenOptions={{
          headerShown: false, // Hides the default top header
          tabBarStyle: {
            backgroundColor: "#121212",
            borderTopColor: "#2C2C2E",
            paddingBottom: Platform.OS === "ios" ? 20 : 10,
            paddingTop: 10,
            height: Platform.OS === "ios" ? 85 : 65,
          },
          tabBarActiveTintColor: "#0A84FF",
          tabBarInactiveTintColor: "#8E8E93",
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Kasir",
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons
                name="cash-register"
                style={{ opacity: color === "#0A84FF" ? 1 : 0.5 }}
                size={24}
                color="white"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: "Riwayat",
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons
                name="receipt-clock"
                style={{ opacity: color === "#0A84FF" ? 1 : 0.5 }}
                size={24}
                color="white"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="recap"
          options={{
            title: "Recap",
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons
                name="chart-bar"
                style={{ opacity: color === "#0A84FF" ? 1 : 0.5 }}
                size={24}
                color="white"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="manage"
          options={{
            title: "Manajemen",
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons
                name="clipboard-list"
                style={{ opacity: color === "#0A84FF" ? 1 : 0.5 }}
                size={24}
                color="white"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Pengaturan",
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons
                name="cog"
                style={{ opacity: color === "#0A84FF" ? 1 : 0.5 }}
                size={24}
                color="white"
              />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
