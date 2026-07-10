import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Hardware & File System Imports
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy"; // Using legacy to keep your terminal warning-free
import * as Sharing from "expo-sharing";
import { connectToPrinter, fetchPairedPrinters } from "../../utils/bluetooth";

export default function SettingsScreen() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<"General" | "Printer">("Printer");

  // Printer States
  const [devices, setDevices] = useState<any[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeAddress, setActiveAddress] = useState<string | null>(null);

  useEffect(() => {
    loadPrinters();
  }, []);

  const loadPrinters = async () => {
    setIsLoading(true);

    if (Platform.OS === "android" && Platform.Version >= 31) {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);

      if (
        granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] !==
        PermissionsAndroid.RESULTS.GRANTED
      ) {
        alert("Izin Bluetooth diperlukan untuk mencari printer salon!");
        setIsLoading(false);
        return; // Stops the code so it doesn't crash!
      }
    }

    // Dynamically fetch paired printers, which automatically fires BLEPrinter.init() again
    const pairedDevices = await fetchPairedPrinters();

    if (pairedDevices.length === 0) {
      alert(
        "Tidak ada printer ditemukan. Pastikan Bluetooth aktif, lalu tekan Refresh kembali.",
      );
    }

    setDevices(pairedDevices);
    setIsLoading(false);
  };

  const handleConnect = async (device: any) => {
    setIsConnecting(true);
    const success = await connectToPrinter(device.address);
    if (success) {
      setActiveAddress(device.address);
      alert(`Successfully connected to ${device.name}!`);
    } else {
      alert("Failed to connect. Make sure the printer is turned on.");
    }
    setIsConnecting(false);
  };

  // ==========================================
  // DATABASE BACKUP, SHARE, & RESTORE LOGIC
  // ==========================================

  const getDbPath = () => {
    const docDir = (FileSystem as any).documentDirectory || "";
    return `${docDir}SQLite/salonpos.db`;
  };

  // OPTION 1: Share menu (Drive, Email, WhatsApp, etc.)
  const handleExportDB = async () => {
    try {
      const dbPath = getDbPath();
      const cacheDir = (FileSystem as any).cacheDirectory || "";
      const backupPath = `${cacheDir}salonpos_backup.db`;

      try {
        await FileSystem.copyAsync({
          from: dbPath,
          to: backupPath,
        });
      } catch (copyError) {
        alert(
          "Database file not found! Try adding an item to the menu or making a transaction first.",
        );
        return;
      }

      await Sharing.shareAsync(backupPath, {
        mimeType: "application/x-sqlite3",
        dialogTitle: "Export Salon Database",
      });
    } catch (error) {
      console.error("Export error:", error);
      alert("Failed to export database.");
    }
  };

  // NEW OPTION 2: Save Directly to a Folder on the Phone Storage
  const handleSaveToPhone = async () => {
    try {
      const dbPath = getDbPath();

      // 1. Read the database as a Base64 string since it's a binary file
      let base64Data;
      try {
        base64Data = await FileSystem.readAsStringAsync(dbPath, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (e) {
        alert(
          "Database file not found! Try generating some transactions first.",
        );
        return;
      }

      // 2. Request directory access permission from Android (opens the native folder selector)
      const permissions =
        await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

      if (!permissions.granted) {
        alert("Permission denied. Cannot save backup file to device storage.");
        return;
      }

      // 3. Create a brand new file in their chosen folder
      const directoryUri = permissions.directoryUri;
      const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
        directoryUri,
        "salonpos_backup.db",
        "application/x-sqlite3",
      );

      // 4. Write our base64 data stream into that local file
      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      alert("Backup saved directly to your phone folder! 🎉");
    } catch (error) {
      console.error("Save to phone error:", error);
      alert("Failed to save file to device storage.");
    }
  };

  const handleImportDB = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/octet-stream",
          "application/x-sqlite3",
          "application/vnd.sqlite3",
          "*/*",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const sourceUri = result.assets[0].uri;
      const importedName = result.assets[0].name;

      if (!importedName.endsWith(".db") && !importedName.endsWith(".sqlite")) {
        alert("Invalid file format. Please select a valid SQLite .db file.");
        return;
      }

      const docDir = (FileSystem as any).documentDirectory || "";
      const sqliteDir = `${docDir}SQLite`;
      const dbPath = `${sqliteDir}/salonpos.db`;

      const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
      }

      await FileSystem.copyAsync({
        from: sourceUri,
        to: dbPath,
      });

      alert(
        "Database Restored Successfully! ✅\n\nPlease FORCE CLOSE the app (swipe it away) and restart it completely for the changes to take effect.",
      );
    } catch (error) {
      console.error("Import error:", error);
      alert("Failed to restore database.");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* HEADER & TABS */}
      <View style={styles.header}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 15,
          }}
        >
          <Text style={styles.headerTitle}>Settings</Text>
          {activeTab === "Printer" && (
            <TouchableOpacity onPress={loadPrinters} style={styles.refreshBtn}>
              <Text style={styles.refreshText}>↻ Refresh</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "General" && styles.tabActive,
            ]}
            onPress={() => setActiveTab("General")}
          >
            <Text
              style={
                activeTab === "General" ? styles.textWhiteBold : styles.textGray
              }
            >
              General
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "Printer" && styles.tabActive,
            ]}
            onPress={() => setActiveTab("Printer")}
          >
            <Text
              style={
                activeTab === "Printer" ? styles.textWhiteBold : styles.textGray
              }
            >
              Hardware & Printer
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* DYNAMIC BODY */}
      <View style={styles.body}>
        {activeTab === "General" ? (
          <ScrollView
            style={styles.deviceList}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionTitle}>MANAJEMEN DATA</Text>

            <View style={styles.placeholderCard}>
              <View style={{ marginBottom: 20 }}>
                <Text style={styles.textWhiteBold}>Export & Backup Data</Text>
                <Text
                  style={[styles.textGray, { marginTop: 5, marginBottom: 15 }]}
                >
                  Menyimpan seluruh menu, list staff, dan riwayat transaksi
                  supaya aman.
                </Text>

                {/* Button A: Share Tray */}
                <TouchableOpacity
                  style={[
                    styles.dbActionBtn,
                    { backgroundColor: "#0A84FF", marginBottom: 10 },
                  ]}
                  onPress={handleExportDB}
                >
                  <Text style={styles.textWhiteBold}>
                    Share via Apps (Drive / WA)
                  </Text>
                </TouchableOpacity>

                {/* Button B: Save Directly to Device Folder */}
                <TouchableOpacity
                  style={[styles.dbActionBtn, { backgroundColor: "#34C759" }]}
                  onPress={handleSaveToPhone}
                >
                  <Text style={styles.textWhiteBold}>
                    Simpan Langsung di Penyimpanan HP
                  </Text>
                </TouchableOpacity>
              </View>

              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: "#2C2C2E",
                  paddingTop: 20,
                }}
              >
                <Text style={styles.textWhiteBold}>Import & Pulihkan Data</Text>
                <Text
                  style={[styles.textGray, { marginTop: 5, marginBottom: 15 }]}
                >
                  Memulihkan data salon dari data yang sudah disimpan sebelumnya
                  '.db' file, Peringatan: Melakukan hal ini dapat menghapus data
                  yang aktif saat ini!
                </Text>
                <TouchableOpacity
                  style={[
                    styles.dbActionBtn,
                    {
                      backgroundColor: "rgba(255, 69, 58, 0.1)",
                      borderColor: "#FF453A",
                      borderWidth: 1,
                    },
                  ]}
                  onPress={handleImportDB}
                >
                  <Text style={[styles.textWhiteBold, { color: "#FF453A" }]}>
                    ↓ Pulihkan File Database
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>PAIRED BLUETOOTH PRINTERS</Text>

            {isLoading ? (
              <ActivityIndicator
                size="large"
                color="#0A84FF"
                style={{ marginTop: 40 }}
              />
            ) : (
              <ScrollView style={styles.deviceList}>
                {devices.length === 0 ? (
                  <Text style={styles.textGrayCenter}>
                    No paired Bluetooth printers found. Pair one in your Android
                    Settings first.
                  </Text>
                ) : (
                  devices.map((device, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.deviceItem,
                        activeAddress === device.address && styles.activeDevice,
                      ]}
                      onPress={() => handleConnect(device)}
                      disabled={isConnecting}
                    >
                      <View>
                        <Text style={styles.deviceName}>{device.name}</Text>
                        <Text style={styles.deviceMac}>{device.address}</Text>
                      </View>
                      {activeAddress === device.address && (
                        <Text style={styles.connectedBadge}>Connected</Text>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  header: {
    padding: 20,
    backgroundColor: "#121212",
    borderBottomWidth: 1,
    borderBottomColor: "#2C2C2E",
  },
  headerTitle: { fontSize: 24, fontWeight: "bold", color: "#FFF" },
  tabContainer: { flexDirection: "row", gap: 10 },
  tabButton: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#1C1C1E",
  },
  tabActive: { backgroundColor: "#0A84FF" },
  textWhiteBold: { fontWeight: "bold", color: "#FFF" },
  textGray: { color: "#8E8E93" },
  textGrayCenter: { color: "#8E8E93", textAlign: "center", marginTop: 20 },
  refreshBtn: {
    backgroundColor: "#2C2C2E",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  refreshText: { color: "#FFF", fontWeight: "bold" },
  body: { padding: 20, flex: 1 },
  sectionTitle: {
    color: "#8E8E93",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 15,
  },
  deviceList: { flex: 1 },
  deviceItem: {
    padding: 15,
    backgroundColor: "#1C1C1E",
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  activeDevice: {
    borderColor: "#34C759",
    backgroundColor: "rgba(52, 199, 89, 0.1)",
  },
  deviceName: { color: "#FFF", fontWeight: "bold", fontSize: 16 },
  deviceMac: { color: "#8E8E93", fontSize: 12, marginTop: 4 },
  connectedBadge: { color: "#34C759", fontWeight: "bold", fontSize: 12 },
  placeholderCard: {
    backgroundColor: "#1C1C1E",
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  dbActionBtn: {
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
});
