import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { connectToPrinter, fetchPairedPrinters } from "../utils/bluetooth";

interface PrinterModalProps {
  visible: boolean;
  onClose: () => void;
  activePrinter: any;
  setActivePrinter: (printer: any) => void;
}

export default function PrinterModal({
  visible,
  onClose,
  activePrinter,
  setActivePrinter,
}: PrinterModalProps) {
  const [devices, setDevices] = useState<any[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadPrinters();
    }
  }, [visible]);

  const loadPrinters = async () => {
    setIsLoading(true);
    const pairedDevices = await fetchPairedPrinters();
    setDevices(pairedDevices);
    setIsLoading(false);
  };

  const handleConnect = async (device: any) => {
    setIsConnecting(true);
    const success = await connectToPrinter(device.address);
    if (success) {
      setActivePrinter(device);
      alert(`Connected to ${device.name}!`);
      onClose();
    } else {
      alert("Failed to connect. Make sure the printer is on.");
    }
    setIsConnecting(false);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>🖨️ Select Printer</Text>

          {isLoading ? (
            <ActivityIndicator
              size="large"
              color="#34C759"
              style={{ marginVertical: 20 }}
            />
          ) : (
            <ScrollView style={styles.deviceList}>
              {devices.length === 0 ? (
                <Text style={styles.textGray}>
                  No paired Bluetooth printers found.
                </Text>
              ) : (
                devices.map((device, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.deviceItem,
                      activePrinter?.address === device.address &&
                        styles.activeDevice,
                    ]}
                    onPress={() => handleConnect(device)}
                    disabled={isConnecting}
                  >
                    <Text style={styles.deviceName}>{device.name}</Text>
                    <Text style={styles.deviceMac}>{device.address}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#1C1C1E",
    padding: 20,
    borderRadius: 15,
    width: "90%",
    maxWidth: 400,
  },
  modalTitle: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
  },
  deviceList: { maxHeight: 300 },
  deviceItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#2C2C2E",
  },
  activeDevice: { backgroundColor: "rgba(52, 199, 89, 0.2)" },
  deviceName: { color: "#FFF", fontWeight: "bold", fontSize: 16 },
  deviceMac: { color: "#8E8E93", fontSize: 12, marginTop: 4 },
  textGray: { color: "#8E8E93", textAlign: "center", marginVertical: 20 },
  closeButton: {
    backgroundColor: "#34C759",
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
    alignItems: "center",
  },
  closeButtonText: { color: "#FFF", fontWeight: "bold", fontSize: 16 },
});
