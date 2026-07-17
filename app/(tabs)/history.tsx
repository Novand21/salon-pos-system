import { db } from "@/database/db";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

export default function BasketScreen() {
  const insets = useSafeAreaInsets();
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      const handle = requestIdleCallback(
        () => {
          fetchPendingOrders();
        },
        { timeout: 1000 },
      );

      return () => cancelIdleCallback(handle);
    }, []),
  );

  const fetchPendingOrders = () => {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      db.runSync(
        "DELETE FROM Transactions WHERE status = 'pending' AND timestamp < ?",
        [startOfDay.toISOString()],
      );

      const data = db.getAllSync(
        "SELECT * FROM Transactions WHERE status = 'pending' AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC",
        [startOfDay.toISOString(), endOfDay.toISOString()],
      );

      // parsing json after parsing
      const parsedData = data.map((order: any) => ({
        ...order,
        parsedCart: JSON.parse(order.cart_json || "[]"),
      }));

      setPendingOrders(parsedData);
    } catch (e) {
      console.error("Error fetching basket:", e);
    }
  };

  const handleEditOrder = () => {
    router.push({
      pathname: "/",
      params: { editTxId: selectedOrder.id },
    });
    setSelectedOrder(null);
  };

  const handleDeleteOrder = () => {
    if (!selectedOrder) return;

    try {
      const deletedQueueNum = selectedOrder.queue_number;
      const cartToRevert =
        selectedOrder.parsedCart || JSON.parse(selectedOrder.cart_json || "[]");

      cartToRevert.forEach((item: any) => {
        // Revert Main Item
        if (item.is_stock_enabled === 1) {
          db.runSync(
            "UPDATE Services_Products SET stock_quantity = stock_quantity + ? WHERE id = ?",
            [item.quantity, item.id],
          );
        }
        // Revert Linked Add-Ons
        (item.selectedAddOns || []).forEach((addon: any) => {
          db.runSync(
            "UPDATE Services_Products SET stock_quantity = stock_quantity + ? WHERE lower(name) = lower(?) AND is_stock_enabled = 1",
            [(addon.quantity || 1) * item.quantity, addon.name],
          );
        });
      });

      db.runSync("DELETE FROM Transactions WHERE id = ?", selectedOrder.id);

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      db.runSync(
        "UPDATE Transactions SET queue_number = queue_number - 1 WHERE timestamp >= ? AND queue_number > ?",
        [startOfDay.toISOString(), deletedQueueNum],
      );

      fetchPendingOrders();
      setSelectedOrder(null);
    } catch (e) {
      console.error("Error deleting order:", e);
    }
  };

  const handleRemoveItem = (cartIdToRemove: string) => {
    if (!selectedOrder) return;

    const currentCart = JSON.parse(selectedOrder.cart_json || "[]");

    const updatedCart = currentCart.filter(
      (item: any) => item.cartId !== cartIdToRemove,
    );

    if (updatedCart.length === 0) {
      handleDeleteOrder();
      return;
    }

    const itemToRemove = currentCart.find(
      (item: any) => item.cartId === cartIdToRemove,
    );
    if (itemToRemove) {
      if (itemToRemove.is_stock_enabled === 1) {
        db.runSync(
          "UPDATE Services_Products SET stock_quantity = stock_quantity + ? WHERE id = ?",
          [itemToRemove.quantity, itemToRemove.id],
        );
      }
      (itemToRemove.selectedAddOns || []).forEach((addon: any) => {
        db.runSync(
          "UPDATE Services_Products SET stock_quantity = stock_quantity + ? WHERE lower(name) = lower(?) AND is_stock_enabled = 1",
          [(addon.quantity || 1) * itemToRemove.quantity, addon.name],
        );
      });
    }

    const newTotal = updatedCart.reduce(
      (sum: number, item: any) => sum + item.itemTotal,
      0,
    );
    const newCartJson = JSON.stringify(updatedCart);

    db.runSync(
      "UPDATE Transactions SET cart_json = ?, total_amount = ? WHERE id = ?",
      [newCartJson, newTotal, selectedOrder.id],
    );

    setSelectedOrder({
      ...selectedOrder,
      cart_json: newCartJson,
      total_amount: newTotal,
      parsedCart: updatedCart,
    });

    fetchPendingOrders();
  };

  const activeCartItems = selectedOrder ? selectedOrder.parsedCart : [];

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Keranjang / Pending Orders</Text>
      </View>

      <ScrollView contentContainerStyle={styles.listContainer}>
        {pendingOrders.length === 0 ? (
          <Text
            style={{ color: "#8E8E93", textAlign: "center", marginTop: 50 }}
          >
            Tidak ada order.
          </Text>
        ) : (
          pendingOrders.map((order) => {
            const cartItems = order.parsedCart;
            return (
              <TouchableOpacity
                key={order.id}
                style={styles.listCard}
                onPress={() => setSelectedOrder(order)}
              >
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.listCardTitle}>
                    Antrian #{order.queue_number} ({order.trx_code})
                  </Text>
                  <Text style={styles.listCardSubtitle}>
                    {new Date(order.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    • {cartItems.length} items
                  </Text>
                </View>
                <Text style={styles.listCardValue}>
                  Rp {order.total_amount.toLocaleString("id-ID")}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={!!selectedOrder}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedOrder(null)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.checkoutModal, { paddingBottom: insets.bottom }]}
          >
            <View style={styles.checkoutHeader}>
              <Text style={styles.modalTitle}>
                Antrian #{selectedOrder?.queue_number} -{" "}
                {selectedOrder?.trx_code}
              </Text>
              <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                <Text style={styles.closeBtn}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.checkoutBody}>
              <View style={styles.receiptPaper}>
                <Text style={styles.receiptTitle}>D'FFOND SALON</Text>
                <Text style={styles.receiptCenter}>
                  Keranjang Order / Pending
                </Text>
                <Text style={styles.receiptDivider}>
                  --------------------------------
                </Text>

                {activeCartItems.map((cartItem: any, index: number) => {
                  const addOnsTotal =
                    cartItem.selectedAddOns &&
                    cartItem.selectedAddOns.length > 0
                      ? cartItem.selectedAddOns.reduce(
                          (sum: number, addon: any) => sum + addon.price,
                          0,
                        )
                      : 0;
                  const basePriceWithAddons = cartItem.price + addOnsTotal;
                  const discountNominal = Math.round(
                    basePriceWithAddons *
                      cartItem.quantity *
                      (cartItem.discountPercent / 100),
                  );

                  return (
                    <View key={cartItem.cartId} style={{ marginBottom: 10 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                        }}
                      >
                        <Text
                          style={[
                            styles.receiptLine,
                            { flex: 1, fontWeight: "bold" },
                          ]}
                        >
                          {cartItem.name}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleRemoveItem(cartItem.cartId)}
                          style={{ paddingLeft: 10 }}
                        >
                          <Text
                            style={{
                              color: "#FF453A",
                              fontSize: 18,
                              fontWeight: "bold",
                              lineHeight: 18,
                            }}
                          >
                            ×
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Stylists */}
                      {cartItem.stylists && cartItem.stylists.length > 0 && (
                        <View
                          style={[styles.receiptRowWrap, { marginLeft: 10 }]}
                        >
                          <Text
                            style={[
                              styles.receiptTextLeftWrap,
                              { fontStyle: "italic", paddingLeft: 0 },
                            ]}
                          >
                            {cartItem.stylists
                              .map((s: string) => `@${s}`)
                              .join(", ")}
                          </Text>
                        </View>
                      )}

                      {/* Map Add-ons  */}
                      {cartItem.selectedAddOns.map(
                        (addon: any, idx: number) => (
                          <View
                            key={idx}
                            style={[styles.receiptRowWrap, { marginLeft: 20 }]}
                          >
                            <Text style={styles.receiptTextLeftWrap}>
                              +{" "}
                              {addon.quantity > 1 ? `${addon.quantity}x ` : ""}
                              {addon.name}
                            </Text>
                            <Text style={styles.receiptTextRight}>
                              Rp {addon.price.toLocaleString("id-ID")}
                            </Text>
                          </View>
                        ),
                      )}

                      {/* Discount Data */}
                      {cartItem.discountPercent > 0 && (
                        <View>
                          <View
                            style={[styles.receiptRowWrap, { marginLeft: 10 }]}
                          >
                            <Text style={styles.receiptDiscountLeftWrap}>
                              Disc {cartItem.discountPercent}%{" "}
                              {cartItem.discountDesc
                                ? `(${cartItem.discountDesc})`
                                : ""}
                            </Text>
                          </View>
                          <View
                            style={[styles.receiptRowWrap, { marginLeft: 20 }]}
                          >
                            <Text style={styles.receiptDiscountLeftWrap}>
                              - Potongan:
                            </Text>
                            <Text style={styles.receiptDiscountRight}>
                              -Rp {discountNominal.toLocaleString("id-ID")}
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* Item QTY & Subtotal */}
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          marginTop: 4,
                          marginLeft: 10,
                        }}
                      >
                        <Text style={styles.receiptLine}>
                          {cartItem.quantity}x Rp{" "}
                          {cartItem.price.toLocaleString("id-ID")}
                        </Text>
                        <Text
                          style={[styles.receiptLine, { fontWeight: "bold" }]}
                        >
                          Rp {cartItem.itemTotal.toLocaleString("id-ID")}
                        </Text>
                      </View>

                      {/* DISPLAY CUSTOM NOTE */}
                      {cartItem.customNote ? (
                        <View
                          style={{
                            marginTop: 4,
                            marginLeft: 10,
                            paddingTop: 4,
                            borderTopWidth: 1,
                            borderTopColor: "#F2F2F7",
                            borderStyle: "dashed",
                          }}
                        >
                          <Text
                            style={[
                              styles.receiptLine,
                              { fontStyle: "italic", color: "#555" },
                            ]}
                          >
                            Catatan: {cartItem.customNote}
                          </Text>
                        </View>
                      ) : null}

                      {/* Dashed Line Separator */}
                      {index < activeCartItems.length - 1 && (
                        <Text
                          style={[
                            styles.receiptDivider,
                            { color: "#8E8E93", marginTop: 12 },
                          ]}
                        >
                          - - - - - - - - - - - - - - - -
                        </Text>
                      )}
                    </View>
                  );
                })}

                <Text style={styles.receiptDivider}>
                  --------------------------------
                </Text>
                <View style={styles.receiptRowWrap}>
                  <Text style={styles.receiptBold}>TOTAL:</Text>
                  <Text style={styles.receiptBold}>
                    Rp {selectedOrder?.total_amount.toLocaleString("id-ID")}
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.checkoutFooter}>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={handleEditOrder}
              >
                <Text style={styles.textWhiteBold}>✏️ Checkout / Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleDeleteOrder}
              >
                <Text style={styles.textRedBold}>🗑️ Hapus Seluruh Order</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  listContainer: { padding: 15, gap: 12 },
  listCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
    padding: 16,
    borderRadius: 12,
  },
  listCardTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
  listCardSubtitle: { color: "#8E8E93", fontSize: 14, marginTop: 4 },
  listCardValue: { color: "#FFFFFF", fontSize: 18, fontWeight: "bold" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
    flexDirection: "row",
  },
  checkoutModal: {
    width: "100%",
    backgroundColor: "#1C1C1E",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    flex: 1,
  },
  checkoutHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderColor: "#2C2C2E",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalTitle: { color: "#FFF", fontSize: 20, fontWeight: "bold" },
  closeBtn: { color: "#8E8E93", fontSize: 30, lineHeight: 30 },
  checkoutBody: { padding: 20, backgroundColor: "#121212" },
  checkoutFooter: { padding: 20, borderTopWidth: 1, borderColor: "#2C2C2E" },

  receiptPaper: {
    backgroundColor: "#FFF",
    padding: 20,
    alignSelf: "center",
    width: "100%",
    maxWidth: 350,
  },
  receiptTitle: {
    color: "#000",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    letterSpacing: 2,
    marginBottom: 5,
  },
  receiptCenter: { color: "#000", textAlign: "center", fontSize: 12 },
  receiptDivider: { color: "#000", textAlign: "center", marginVertical: 5 },
  receiptLine: { color: "#000", fontSize: 12 },

  // NEW REUSABLE RECEIPT WRAPPING STYLES
  receiptRowWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginVertical: 2,
  },
  receiptTextLeftWrap: {
    color: "#555",
    fontSize: 12,
    flex: 1,
    flexShrink: 1,
    paddingRight: 15,
  },
  receiptTextRight: {
    color: "#555",
    fontSize: 12,
    textAlign: "right",
  },
  receiptDiscountLeftWrap: {
    color: "#FF453A",
    fontSize: 12,
    flex: 1,
    flexShrink: 1,
    paddingRight: 15,
  },
  receiptDiscountRight: {
    color: "#FF453A",
    fontSize: 12,
    textAlign: "right",
  },

  receiptBold: { color: "#000", fontSize: 14, fontWeight: "bold" },

  editBtn: {
    backgroundColor: "#0A84FF",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  deleteBtn: {
    backgroundColor: "rgba(255, 69, 58, 0.1)",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FF453A",
  },
  textWhiteBold: { color: "#FFF", fontWeight: "bold", fontSize: 16 },
  textRedBold: { color: "#FF453A", fontWeight: "bold", fontSize: 16 },
});
