import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// printer bluetooth ui
import { printReceiptRaw } from "../../utils/bluetooth";
import { generateThermalReceiptString } from "../../utils/printer";

import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
// 🧠 1. IMPORT OUR GLOBAL BRAIN
import { db } from "@/database/db";
import { useCart } from "../../context/CartContext";

export default function RegisterScreen() {
  const {
    cart,
    addToCart,
    removeFromCart,
    clearCart,
    overwriteCart,
    cartTotal,
    totalItems,
  } = useCart();
  const params = useLocalSearchParams();
  const [pendingTxId, setPendingTxId] = useState<number | null>(null);
  // database sets
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);

  // States for Menu and Side Panel
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // States for Checkout Modal
  const [quantity, setQuantity] = useState(1);
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("QRIS");
  const [amountTendered, setAmountTendered] = useState("");
  const [cashier, setCashier] = useState("");
  const [itemStylists, setItemStylists] = useState<string[]>([]);
  const [itemDiscount, setItemDiscount] = useState("");
  const [itemDiscountDesc, setItemDiscountDesc] = useState("");
  const [itemNote, setItemNote] = useState("");

  // for editing purposes
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [editItemName, setEditItemName] = useState("");
  const [editItemPrice, setEditItemPrice] = useState("");
  const [isEditingAddOns, setIsEditingAddOns] = useState(false);
  const [customAddOns, setCustomAddOns] = useState<any[]>([]);
  // ---------------------------------

  // area for the notch bar
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      // 1. Check if we are receiving an edit request from the Basket
      if (params.editTxId) {
        const id = Number(params.editTxId);
        setPendingTxId(id);

        try {
          // FETCH DIRECTLY FROM DB: Bypasses URL length limits!
          const tx: any = db.getFirstSync(
            "SELECT cart_json FROM Transactions WHERE id = ?",
            [id],
          );
          if (tx && tx.cart_json) {
            overwriteCart(JSON.parse(tx.cart_json));
          }
        } catch (e) {
          console.error("Error loading pending cart:", e);
        }

        // Clear the URL param so it doesn't loop
        router.setParams({ editTxId: "" });
      }

      // 2. Fetch the standard menu data
      try {
        const services = db.getAllSync(
          "SELECT * FROM Services_Products ORDER BY name ASC",
        );
        const addOns = db.getAllSync("SELECT * FROM Add_Ons");
        const employees = db.getAllSync("SELECT * FROM Employees");

        const formattedMenu = services.map((service: any) => ({
          ...service,
          price: service.base_price,
          addOns: addOns
            .filter((a: any) => a.service_id === service.id)
            .map((a: any) => ({ ...a, price: a.additional_price })),
        }));
        setMenuItems(formattedMenu);

        const uniqueCategories = Array.from(
          new Set(services.map((s: any) => s.category)),
        ) as string[];
        setCategories(["Semua", ...uniqueCategories]);

        if (!activeCategory) {
          setActiveCategory("Semua");
        }

        setStaffList(employees);
        if (employees.length > 0 && !cashier) {
          setCashier((employees[0] as any).name);
        }
      } catch (e) {
        console.error("Error loading data from database:", e);
      }
    }, [params.editTxId]),
  );

  // Filters items by Search Query (case-insensitive)
  const displayedItems = menuItems.filter((item) => {
    // If the search bar has text, search the ENTIRE database by item name only
    if (searchQuery.length > 0) {
      return item.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    // If the search bar is empty, just show the currently selected category
    if (activeCategory === "Semua") {
      return true;
    }
    return item.category === activeCategory;
  });

  // 1. Calculate the base cost before discounts
  const baseItemCost = selectedItem
    ? (selectedItem.price +
        selectedAddOns.reduce(
          (sum: number, addon: any) => sum + addon.price,
          0,
        )) *
      quantity
    : 0;

  // 2. Calculate the discount percentage amount
  const discountAmount = baseItemCost * (Number(itemDiscount || 0) / 100);

  // 3. Final total for the UI button
  const currentItemTotal = baseItemCost - discountAmount;

  const toggleStylist = (name: string) => {
    if (itemStylists.includes(name)) {
      setItemStylists(itemStylists.filter((s) => s !== name));
    } else {
      setItemStylists([...itemStylists, name]);
    }
  };

  const change =
    Number(amountTendered) >= cartTotal
      ? Number(amountTendered) - cartTotal
      : 0;

  // Functions
  const toggleAddOn = (addon: any) => {
    if (selectedAddOns.find((a) => a.id === addon.id)) {
      setSelectedAddOns(selectedAddOns.filter((a) => a.id !== addon.id));
    } else {
      setSelectedAddOns([...selectedAddOns, addon]);
    }
  };

  const handleAddToCart = () => {
    const customizedItem = {
      ...selectedItem,
      stylists: itemStylists, // array of names!
      discountPercent: Number(itemDiscount || 0),
      discountDesc: itemDiscountDesc,
      customNote: itemNote,
    };

    addToCart(customizedItem, selectedAddOns, quantity);

    // Reset all states
    setSelectedItem(null);
    setQuantity(1);
    setItemStylists([]); // Reset array
    setItemDiscount("");
    setItemDiscountDesc("");
    setItemNote("");
  };

  const handleQuickEditSave = () => {
    if (!editItemName || !editItemPrice) {
      return alert("Nama dan Harga tidak boleh kosong!");
    }

    try {
      // Update the permanent database
      db.runSync(
        "UPDATE Services_Products SET name = ?, base_price = ? WHERE id = ?",
        [editItemName, Number(editItemPrice), selectedItem.id],
      );

      // Update the live item in the side panel so checkout math uses the new price
      const updatedItem = {
        ...selectedItem,
        name: editItemName,
        price: Number(editItemPrice),
      };
      setSelectedItem(updatedItem);

      // Update the global menu grid instantly without a database reload
      setMenuItems((prev) =>
        prev.map((item) =>
          item.id === selectedItem.id
            ? { ...item, name: editItemName, price: Number(editItemPrice) }
            : item,
        ),
      );

      // Close edit mode
      setIsEditingItem(false);
    } catch (error) {
      console.error("Quick edit failed:", error);
      alert("Gagal menyimpan perubahan menu.");
    }
  };

  // Helper to generate a simple unique transaction code
  const generateTrxCode = () => `TX-${Date.now()}`;

  // Helper to calculate the next incremental queue number for today
  const getNextQueueNumber = () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Just sort them highest-to-lowest and grab the top one!
    try {
      const result: any = db.getFirstSync(
        "SELECT queue_number FROM Transactions WHERE timestamp >= ? ORDER BY queue_number DESC LIMIT 1",
        [startOfDay.toISOString()],
      );

      return result && result.queue_number ? result.queue_number + 1 : 1;
    } catch (e) {
      console.error("Queue fetch error:", e);
      return 1; // Fallback
    }
  };

  const handleSaveToBasket = () => {
    if (cart.length === 0) return;
    try {
      const timestamp = new Date().toISOString();
      const cartJson = JSON.stringify(cart);

      if (pendingTxId) {
        // Update existing pending order (keeps original queue_number and trx_code)
        db.runSync(
          "UPDATE Transactions SET total_amount = ?, cart_json = ?, timestamp = ? WHERE id = ?",
          [cartTotal, cartJson, timestamp, pendingTxId],
        );
      } else {
        // Create brand new pending order: locks in queue number and unique trx_code immediately
        const queueNum = getNextQueueNumber();
        const code = generateTrxCode();

        db.runSync(
          "INSERT INTO Transactions (timestamp, total_amount, payment_method, status, cart_json, queue_number, trx_code) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            timestamp,
            cartTotal,
            "Pending",
            "pending",
            cartJson,
            queueNum,
            code,
          ],
        );
      }

      alert("Order disimpan di keranjang! 🛒");
      clearCart();
      setPendingTxId(null);
    } catch (e) {
      console.error("Error saving to basket:", e);
    }
  };

  const handlePrintOnly = async () => {
    var queueNumber = 1; // You can run your queue logic here
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const rawPrinterText = generateThermalReceiptString(
      pendingTxId || "NEW",
      queueNumber,
      cart,
      cartTotal,
      paymentMethod,
      cashier,
      amountTendered || cartTotal,
      change,
    );

    if (pendingTxId) {
      const rankQuery: any = db.getFirstSync(
        "SELECT COUNT(*) as count FROM Transactions WHERE timestamp >= ? AND id <= ?",
        [startOfDay.toISOString(), pendingTxId],
      );
      queueNumber = rankQuery ? rankQuery.count : 1;
    } else {
      const dailyCount: any = db.getFirstSync(
        "SELECT COUNT(*) as count FROM Transactions WHERE timestamp >= ?",
        [startOfDay.toISOString()],
      );
      queueNumber = dailyCount ? dailyCount.count + 1 : 1;
    }

    const printed = await printReceiptRaw(rawPrinterText);
    if (!printed) alert("Tidak ada printer aktif!");
  };

  const finalizeTransaction = (shouldPrint: boolean) => {
    if (cart.length === 0) return;
    try {
      const selectedStaff = staffList.find((s) => s.name === cashier);
      const employeeId = selectedStaff ? selectedStaff.id : null;
      const timestamp = new Date().toISOString();
      const cartJsonStr = JSON.stringify(cart);

      let currentQueue = 1;
      let currentCode = "";
      let targetId = pendingTxId;

      if (pendingTxId) {
        const existing: any = db.getFirstSync(
          "SELECT queue_number, trx_code FROM Transactions WHERE id = ?",
          [pendingTxId],
        );
        currentQueue = existing?.queue_number || 1;
        currentCode = existing?.trx_code || generateTrxCode();

        db.runSync(
          "UPDATE Transactions SET timestamp = ?, total_amount = ?, payment_method = ?, employee_id = ?, status = 'completed', cart_json = ?, amount_tendered = ?, change_amount = ? WHERE id = ?",
          [
            timestamp,
            cartTotal,
            paymentMethod,
            employeeId,
            cartJsonStr,
            Number(amountTendered) || cartTotal, // default to pas if left empty
            change,
            pendingTxId,
          ],
        );
      } else {
        currentQueue = getNextQueueNumber();
        currentCode = generateTrxCode();

        // Add amount_tendered and change_amount columns
        const result = db.runSync(
          "INSERT INTO Transactions (timestamp, total_amount, payment_method, employee_id, status, cart_json, queue_number, trx_code, amount_tendered, change_amount) VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?)",
          [
            timestamp,
            cartTotal,
            paymentMethod,
            employeeId,
            cartJsonStr,
            currentQueue,
            currentCode,
            Number(amountTendered) || cartTotal,
            change,
          ],
        );
        targetId = result.lastInsertRowId;
      }

      cart.forEach((cartItem: any) => {
        const addOnsString = cartItem.selectedAddOns
          .map((a: any) => a.name)
          .join(", ");
        const stylistsString =
          cartItem.stylists && cartItem.stylists.length > 0
            ? cartItem.stylists.join(", ")
            : "";
        const itemNameWithQty = `${cartItem.quantity}x ${cartItem.name}`;

        db.runSync(
          "INSERT INTO Transaction_Items (transaction_id, item_name, add_ons_list, stylists, discount_percent, discount_desc, final_price) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            targetId,
            itemNameWithQty,
            addOnsString,
            stylistsString,
            cartItem.discountPercent || 0,
            cartItem.discountDesc || "",
            cartItem.itemTotal,
          ],
        );
        if (cartItem.is_stock_enabled) {
          db.runSync(
            "UPDATE Services_Products SET stock_quantity = stock_quantity - ? WHERE id = ?",
            [cartItem.quantity, cartItem.id],
          );
        }
      });

      if (shouldPrint) {
        const rawPrinterText = generateThermalReceiptString(
          currentCode,
          currentQueue,
          cart,
          cartTotal,
          paymentMethod,
          cashier,
          amountTendered || cartTotal,
          change,
        );
        printReceiptRaw(rawPrinterText).then((printed) => {
          if (!printed)
            alert("Order disimpan, tetapi printer tidak terdeteksi!");
        });
      }

      alert(`Order ${currentCode} Selesai! ✅`);

      const refreshedServices = db.getAllSync(
        "SELECT * FROM Services_Products ORDER BY name ASC",
      );
      const addOns = db.getAllSync("SELECT * FROM Add_Ons");
      const formattedMenu = refreshedServices.map((service: any) => ({
        ...service,
        price: service.base_price,
        addOns: addOns
          .filter((a: any) => a.service_id === service.id)
          .map((a: any) => ({ ...a, price: a.additional_price })),
      }));

      setMenuItems(formattedMenu);
      clearCart();
      setShowCheckout(false);
      setPendingTxId(null);
      setAmountTendered("");
      setPaymentMethod("QRIS");
    } catch (error) {
      console.error("Error finalising order:", error);
    }
  };

  // ADD-ONS EDITING LOGICS
  const handleAddCustomRow = () => {
    // Generate a temporary ID for the cart receipt
    setCustomAddOns([
      ...customAddOns,
      { id: `custom-${Date.now()}`, name: "", price: 0 },
    ]);
  };

  const updateCustomAddOn = (index: number, field: string, value: string) => {
    const updated = [...customAddOns];
    updated[index] = { ...updated[index] };

    if (field === "price") {
      updated[index].price = Number(value) || 0;
    } else {
      updated[index].name = value;
    }
    setCustomAddOns(updated);
  };

  const removeCustomAddOn = (index: number) => {
    const updated = [...customAddOns];
    const removedItem = updated[index];

    // 1. Remove it from the custom list
    updated.splice(index, 1);
    setCustomAddOns(updated);

    // 2. Uncheck it automatically if it was already selected
    setSelectedAddOns(
      selectedAddOns.filter((a: any) => a.id !== removedItem.id),
    );
  };

  const handleSaveCustomAddOns = () => {
    try {
      // Wipe the old add-ons for this specific item from the database
      db.runSync("DELETE FROM Add_Ons WHERE service_id = ?", [selectedItem.id]);

      // Filter out any blank rows the user might have left empty
      const validAddOns = customAddOns.filter(
        (addon) => addon.name.trim() !== "",
      );

      // Insert the newly edited list into the permanent Add_Ons table
      validAddOns.forEach((addon) => {
        db.runSync(
          "INSERT INTO Add_Ons (service_id, name, additional_price) VALUES (?, ?, ?)",
          [selectedItem.id, addon.name, Number(addon.price) || 0],
        );
      });

      // Update the side panel and the global menu so the UI doesn't require a reload
      setSelectedItem({ ...selectedItem, addOns: validAddOns });
      setMenuItems((prev) =>
        prev.map((item) =>
          item.id === selectedItem.id ? { ...item, addOns: validAddOns } : item,
        ),
      );

      // Clean up the UI state and close edit mode
      setCustomAddOns(validAddOns);
      setIsEditingAddOns(false);
    } catch (error) {
      console.error("Failed to save add-ons permanently:", error);
      alert("Gagal menyimpan add-on permanen ke database.");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Top Category Filter */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Menu Order</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setActiveCategory(cat)}
              style={[
                styles.categoryPill,
                activeCategory === cat
                  ? styles.categoryActive
                  : styles.categoryInactive,
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  activeCategory === cat ? styles.textWhite : styles.textGray,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Search Bar Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari menu atau produk..."
          placeholderTextColor="#8E8E93"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing" // Adds a native "X" clear button on iOS
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery("")}
            style={styles.clearSearchBtn}
          >
            <Text style={{ color: "#0A84FF", fontWeight: "bold" }}>Hapus</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Item Grid */}
      <ScrollView contentContainerStyle={styles.grid}>
        {displayedItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => {
              setSelectedItem(item);
              setSelectedAddOns([]);
              setQuantity(1);
              setIsEditingItem(false);
              setEditItemName(item.name);
              setEditItemPrice(item.price.toString());
              setItemNote("");
              setCustomAddOns(
                item.addOns ? item.addOns.map((a: any) => ({ ...a })) : [],
              );
            }}
            style={styles.itemCard}
          >
            {item.image_uri ? (
              <Image
                source={{ uri: item.image_uri }}
                style={styles.itemImagePlaceholder}
              />
            ) : (
              <View style={styles.itemImagePlaceholder} />
            )}
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemPrice}>
              Rp {item.price.toLocaleString("id-ID")}
            </Text>
            {!!item.is_stock_enabled && (
              <Text
                style={{
                  color: item.stock_quantity > 0 ? "#8E8E93" : "#FF453A",
                  fontSize: 12,
                  marginTop: 4,
                  fontWeight: item.stock_quantity <= 0 ? "bold" : "normal",
                }}
              >
                Stok: {item.stock_quantity}
              </Text>
            )}
            <View style={styles.addButton}>
              <Text style={styles.addButtonText}>+</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Cart Summary Bar */}
      <View style={styles.cartBar}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={styles.textGray}>{totalItems} Barang</Text>
          <Text style={styles.cartTotal} numberOfLines={1} adjustsFontSizeToFit>
            Rp {cartTotal.toLocaleString("id-ID")}
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            onPress={handleSaveToBasket}
            style={[
              styles.chargeBtn,
              { backgroundColor: "#0A84FF" },
              cart.length === 0 && { backgroundColor: "#2C2C2E" },
            ]}
            disabled={cart.length === 0}
          >
            <Text
              style={[
                styles.chargeBtnText,
                cart.length === 0 && { color: "#8E8E93" },
              ]}
            >
              + Tambah
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => cart.length > 0 && setShowCheckout(true)}
            style={[
              styles.chargeBtn,
              cart.length === 0 && { backgroundColor: "#2C2C2E" },
            ]}
            disabled={cart.length === 0}
          >
            <Text
              style={[
                styles.chargeBtnText,
                cart.length === 0 && { color: "#8E8E93" },
              ]}
            >
              Checkout
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Side Panel Modal (Item Customization) */}
      <Modal
        visible={!!selectedItem}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setSelectedItem(null);
          setItemStylists([]);
          setIsEditingAddOns(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBgClose}
            onPress={() => {
              setSelectedItem(null);
              setIsEditingAddOns(false);
            }}
          />

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={[
              styles.sidePanel,
              { paddingTop: insets.top, paddingBottom: insets.bottom },
            ]}
          >
            <View style={styles.sidePanelHeader}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                {isEditingItem ? (
                  <View style={{ gap: 10 }}>
                    <TextInput
                      style={styles.quickEditInput}
                      value={editItemName}
                      onChangeText={setEditItemName}
                      placeholder="Nama Menu"
                      placeholderTextColor="#8E8E93"
                    />
                    <TextInput
                      style={styles.quickEditInput}
                      value={editItemPrice}
                      onChangeText={setEditItemPrice}
                      keyboardType="numeric"
                      placeholder="Harga"
                      placeholderTextColor="#8E8E93"
                    />
                  </View>
                ) : (
                  <View>
                    <Text style={styles.modalTitle}>{selectedItem?.name}</Text>
                    <Text style={styles.itemPrice}>
                      Rp {selectedItem?.price.toLocaleString("id-ID")}
                    </Text>
                  </View>
                )}
              </View>

              <View
                style={{
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                }}
              >
                <TouchableOpacity
                  onPress={() => {
                    setSelectedItem(null);
                    setItemStylists([]);
                    setIsEditingItem(false);
                    setIsEditingAddOns(false);
                  }}
                >
                  <Text style={styles.closeBtn}>×</Text>
                </TouchableOpacity>

                {isEditingItem ? (
                  <TouchableOpacity
                    onPress={handleQuickEditSave}
                    style={styles.quickEditBtn}
                  >
                    <Text
                      style={{
                        color: "#0A84FF",
                        fontWeight: "bold",
                        fontSize: 12,
                      }}
                    >
                      💾 Simpan
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => setIsEditingItem(true)}
                    style={styles.quickEditBtn}
                  >
                    <Text
                      style={{
                        color: "#0A84FF",
                        fontWeight: "bold",
                        fontSize: 12,
                      }}
                    >
                      ✏️ Edit
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <ScrollView style={styles.sidePanelBody}>
              {selectedItem?.image_uri && (
                <Image
                  source={{ uri: selectedItem.image_uri }}
                  style={styles.sidePanelHeroImage}
                />
              )}
              <Text style={styles.descriptionBox}>
                {selectedItem?.description}
              </Text>
              <View style={styles.customAddonHeader}>
                <Text style={styles.sectionTitle}>TAMBAHAN (ADD-ONS)</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (isEditingAddOns) {
                      handleSaveCustomAddOns();
                    } else {
                      setIsEditingAddOns(true);
                    }
                  }}
                  style={styles.quickEditBtn}
                >
                  <Text
                    style={{
                      color: "#0A84FF",
                      fontWeight: "bold",
                      fontSize: 12,
                    }}
                  >
                    {isEditingAddOns ? "💾 Simpan" : "✏️ Edit"}
                  </Text>
                </TouchableOpacity>
              </View>

              {isEditingAddOns ? (
                /* --- EDIT MODE --- */
                <View style={styles.customAddonListContainer}>
                  {customAddOns.map((addon, idx) => (
                    <View key={addon.id} style={styles.customAddonEditRow}>
                      <TextInput
                        style={styles.customAddonInputName}
                        placeholder="Nama Tambahan"
                        placeholderTextColor="#8E8E93"
                        value={addon.name}
                        onChangeText={(text) =>
                          updateCustomAddOn(idx, "name", text)
                        }
                      />
                      <TextInput
                        style={styles.customAddonInputPrice}
                        placeholder="Harga"
                        placeholderTextColor="#8E8E93"
                        keyboardType="numeric"
                        value={addon.price === 0 ? "" : addon.price.toString()}
                        onChangeText={(text) =>
                          updateCustomAddOn(idx, "price", text)
                        }
                      />
                      <TouchableOpacity
                        onPress={() => removeCustomAddOn(idx)}
                        style={styles.customAddonDeleteBtn}
                      >
                        <Text style={styles.customAddonDeleteText}>X</Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  <TouchableOpacity
                    onPress={handleAddCustomRow}
                    style={styles.customAddonAddRowBtn}
                  >
                    <Text style={styles.customAddonAddRowText}>
                      + Tambah Baris Baru
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* --- SELECTION MODE --- */
                <View style={styles.customAddonListContainer}>
                  {customAddOns.length === 0 && (
                    <Text style={styles.customAddonEmptyText}>
                      Tidak ada tambahan.
                    </Text>
                  )}
                  {customAddOns.map((addon) => {
                    const isSelected = selectedAddOns.some(
                      (a: any) => a.id === addon.id,
                    );
                    return (
                      <TouchableOpacity
                        key={addon.id}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedAddOns(
                              selectedAddOns.filter(
                                (a: any) => a.id !== addon.id,
                              ),
                            );
                          } else {
                            setSelectedAddOns([...selectedAddOns, addon]);
                          }
                        }}
                        style={[
                          styles.customAddonSelectRow,
                          isSelected
                            ? styles.customAddonSelectRowActive
                            : styles.customAddonSelectRowInactive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.customAddonSelectText,
                            isSelected && { color: "#0A84FF" },
                          ]}
                        >
                          {addon.name}
                        </Text>
                        <Text
                          style={[
                            styles.customAddonSelectPrice,
                            isSelected && { color: "#0A84FF" },
                          ]}
                        >
                          + Rp {addon.price.toLocaleString("id-ID")}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* MULTIPLE STYLIST SELECTOR */}
              <View style={{ marginTop: 25 }}>
                <Text style={styles.sectionTitle}>
                  TAMBAH STYLIST (Optional)
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ flexDirection: "row" }}
                >
                  {staffList.map((employee) => {
                    const isAssigned = itemStylists.includes(employee.name);
                    return (
                      <TouchableOpacity
                        key={employee.id}
                        onPress={() => toggleStylist(employee.name)}
                        style={[
                          styles.paymentBtn,
                          { marginRight: 10, paddingHorizontal: 25, flex: 0 },
                          isAssigned ? styles.paymentBtnActive : {},
                        ]}
                      >
                        <Text
                          style={
                            isAssigned ? styles.textWhiteBold : styles.textGray
                          }
                        >
                          {employee.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* PERCENTAGE DISCOUNT */}
              <View style={{ marginTop: 25, marginBottom: 20 }}>
                <Text style={styles.sectionTitle}>DISKON (%)</Text>
                <TextInput
                  style={{
                    backgroundColor: "#121212",
                    color: "#FFF",
                    padding: 15,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: "#2C2C2E",
                    marginBottom: 10,
                  }}
                  placeholder="e.g. 10"
                  placeholderTextColor="#8E8E93"
                  keyboardType="numeric"
                  maxLength={3} // Prevents typing more than 100 easily
                  value={itemDiscount}
                  onChangeText={setItemDiscount}
                />

                <Text style={styles.sectionTitle}>CATATAN DISKON</Text>
                <TextInput
                  style={{
                    backgroundColor: "#121212",
                    color: "#FFF",
                    padding: 15,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: "#2C2C2E",
                  }}
                  placeholder="e.g. Member Promo, Diskon Spesial, etc."
                  placeholderTextColor="#8E8E93"
                  value={itemDiscountDesc}
                  onChangeText={setItemDiscountDesc}
                />
              </View>

              {/* CUSTOM NOTE INPUT */}
              <View style={{ marginBottom: 30 }}>
                <Text style={styles.sectionTitle}>
                  CATATAN PESANAN (OPTIONAL)
                </Text>
                <TextInput
                  style={{
                    backgroundColor: "#121212",
                    color: "#FFF",
                    padding: 15,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: "#2C2C2E",
                  }}
                  placeholder="..."
                  placeholderTextColor="#8E8E93"
                  value={itemNote}
                  onChangeText={setItemNote}
                />
              </View>
            </ScrollView>

            <View style={styles.sidePanelFooter}>
              {/* quantity controller */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: 15,
                  gap: 20,
                }}
              >
                <TouchableOpacity
                  onPress={() => setQuantity(Math.max(1, quantity - 1))}
                  style={{
                    backgroundColor: "#2C2C2E",
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={styles.textWhiteBold}>-</Text>
                </TouchableOpacity>

                <Text
                  style={{ color: "#FFF", fontSize: 20, fontWeight: "bold" }}
                >
                  {quantity}
                </Text>

                <TouchableOpacity
                  onPress={() => setQuantity(quantity + 1)}
                  style={{
                    backgroundColor: "#2C2C2E",
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={styles.textWhiteBold}>+</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.addToOrderBtn}
                onPress={handleAddToCart}
              >
                <Text style={styles.textWhiteBold}>Tambah Order</Text>
                <Text style={styles.textWhiteBold}>
                  Rp {currentItemTotal.toLocaleString("id-ID")}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Checkout Modal */}
      <Modal
        visible={showCheckout}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCheckout(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.checkoutModal, { paddingTop: insets.top }]}>
              <View style={styles.checkoutHeader}>
                <Text style={styles.modalTitle}>Tampilan Checkout</Text>
                <TouchableOpacity onPress={() => setShowCheckout(false)}>
                  <Text style={styles.closeBtn}>×</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.checkoutBody}>
                {/* Receipt Preview */}
                <View style={styles.receiptPaper}>
                  <Text style={styles.receiptTitle}>D'FFOND SALON</Text>
                  <Text style={styles.receiptCenter}>
                    Jl. Dagopojok No.16, Kota Bandung
                  </Text>

                  <Text style={styles.receiptDivider}>
                    --------------------------------
                  </Text>
                  <Text style={styles.receiptLine}>
                    Tanggal: {new Date().toLocaleDateString("en-GB")}
                  </Text>
                  <Text style={styles.receiptLine}>
                    Waktu:{" "}
                    {new Date().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                  <Text style={styles.receiptLine}>Cashier: {cashier}</Text>
                  <Text style={styles.receiptDivider}>
                    --------------------------------
                  </Text>

                  {/* LOOP THROUGH ACTUAL CART ITEMS*/}
                  {cart.map((cartItem: any, index: number) => {
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
                      <View
                        key={cartItem.cartId}
                        style={{
                          marginBottom: 12,
                          paddingBottom: 8,
                          borderBottomWidth: 1,
                          borderBottomColor: "#F2F2F7",
                        }}
                      >
                        {/* Item Name & Delete Button */}
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
                            {cartItem.quantity}x {cartItem.name}
                          </Text>
                          <TouchableOpacity
                            onPress={() => removeFromCart(cartItem.cartId)}
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

                        {/* Display Multiple Stylists */}
                        {cartItem.stylists && cartItem.stylists.length > 0 && (
                          <View style={styles.receiptRow}>
                            <Text
                              style={[
                                styles.receiptAddon,
                                { fontStyle: "italic", paddingLeft: 0 },
                              ]}
                            >
                              {cartItem.stylists
                                .map((s: string) => `@${s}`)
                                .join(", ")}
                            </Text>
                          </View>
                        )}

                        {/* Map Add-ons (Flex wrapping added to prevent overlap) */}
                        {cartItem.selectedAddOns.map(
                          (addon: any, idx: number) => (
                            <View
                              key={idx}
                              style={{
                                flexDirection: "row",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                marginVertical: 2,
                              }}
                            >
                              <Text
                                style={{
                                  color: "#555",
                                  fontSize: 12,
                                  flex: 1,
                                  flexShrink: 1,
                                  paddingRight: 15,
                                }}
                              >
                                + {addon.name}
                              </Text>
                              <Text
                                style={{
                                  color: "#555",
                                  fontSize: 12,
                                  textAlign: "right",
                                }}
                              >
                                Rp {addon.price.toLocaleString("id-ID")}
                              </Text>
                            </View>
                          ),
                        )}

                        {/* Display Discount Data & Subtracted Amount (Fixed Overlap Solution) */}
                        {cartItem.discountPercent > 0 && (
                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              marginVertical: 2,
                            }}
                          >
                            <Text
                              style={{
                                color: "#FF453A",
                                fontSize: 12,
                                flex: 1,
                                flexShrink: 1,
                                paddingRight: 15,
                              }}
                            >
                              Disc {cartItem.discountPercent}%{" "}
                              {cartItem.discountDesc
                                ? `(${cartItem.discountDesc})`
                                : ""}
                            </Text>
                            <Text
                              style={{
                                color: "#FF453A",
                                fontSize: 12,
                                textAlign: "right",
                              }}
                            >
                              -Rp {discountNominal.toLocaleString("id-ID")}
                            </Text>
                          </View>
                        )}

                        {/* Subtotal Positioned at Flex-End */}
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "flex-end",
                            marginTop: 4,
                          }}
                        >
                          <Text
                            style={[styles.receiptLine, { fontWeight: "bold" }]}
                          >
                            Subtotal: Rp{" "}
                            {cartItem.itemTotal.toLocaleString("id-ID")}
                          </Text>
                        </View>
                        {/* DISPLAY CUSTOM NOTE AT THE VERY BOTTOM */}
                        {cartItem.customNote ? (
                          <View
                            style={{
                              marginTop: 4,
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
                      </View>
                    );
                  })}

                  <Text style={styles.receiptDivider}>
                    --------------------------------
                  </Text>

                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptBold}>TOTAL:</Text>
                    <Text style={styles.receiptBold}>
                      Rp {cartTotal.toLocaleString("id-ID")}
                    </Text>
                  </View>

                  <Text style={styles.receiptDivider}>
                    --------------------------------
                  </Text>

                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLine}>PEMBAYARAN:</Text>
                    <Text style={styles.receiptLine}>{paymentMethod}</Text>
                  </View>
                </View>

                {/* Payment Settings Container */}
                <View style={styles.paymentContainer}>
                  {/* Payment Method Selector */}
                  <Text style={styles.sectionTitle}>METODE PEMBAYARAN</Text>
                  <View style={styles.paymentRow}>
                    {/* QRIS Button */}
                    <TouchableOpacity
                      onPress={() => setPaymentMethod("QRIS")}
                      style={[
                        styles.paymentBtn,
                        paymentMethod === "QRIS" ? styles.paymentBtnActive : {},
                      ]}
                    >
                      <Text
                        style={
                          paymentMethod === "QRIS"
                            ? styles.textWhiteBold
                            : styles.textGray
                        }
                      >
                        QRIS
                      </Text>
                    </TouchableOpacity>

                    {/* Cash Button */}
                    <TouchableOpacity
                      onPress={() => setPaymentMethod("Cash")}
                      style={[
                        styles.paymentBtn,
                        paymentMethod === "Cash" ? styles.paymentBtnActive : {},
                      ]}
                    >
                      <Text
                        style={
                          paymentMethod === "Cash"
                            ? styles.textWhiteBold
                            : styles.textGray
                        }
                      >
                        Cash
                      </Text>
                    </TouchableOpacity>
                    {/* Transfer Button */}
                    <TouchableOpacity
                      onPress={() => setPaymentMethod("Transfer")}
                      style={[
                        styles.paymentBtn,
                        paymentMethod === "Transfer"
                          ? styles.paymentBtnActive
                          : {},
                      ]}
                    >
                      <Text
                        style={[
                          paymentMethod === "Transfer"
                            ? styles.textWhiteBold
                            : styles.textGray,
                        ]}
                      >
                        Transfer
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Cash Input */}
                  <View style={styles.cashInputContainer}>
                    <Text style={styles.sectionTitle}>JUMLAH DIBAYAR (Rp)</Text>
                    <TextInput
                      style={styles.cashInput}
                      keyboardType="numeric"
                      value={amountTendered}
                      onChangeText={setAmountTendered}
                      placeholder={cartTotal.toLocaleString("id-ID")}
                      placeholderTextColor="#8E8E93"
                    />

                    {Number(amountTendered) > 0 &&
                      Number(amountTendered) < cartTotal && (
                        <Text
                          style={{
                            color: "#FF453A",
                            marginTop: 5,
                            fontSize: 12,
                          }}
                        >
                          Kurang Rp{" "}
                          {(cartTotal - Number(amountTendered)).toLocaleString(
                            "id-ID",
                          )}
                        </Text>
                      )}

                    {Number(amountTendered) > cartTotal && (
                      <Text
                        style={{
                          color: "#34C759",
                          marginTop: 5,
                          fontSize: 12,
                          fontWeight: "bold",
                        }}
                      >
                        Kembalian: Rp {change.toLocaleString("id-ID")}
                      </Text>
                    )}

                    {Number(amountTendered) > 0 &&
                      Number(amountTendered) === cartTotal && (
                        <Text
                          style={{
                            color: "#34C759",
                            marginTop: 5,
                            fontSize: 12,
                            fontWeight: "bold",
                          }}
                        >
                          Uang Pas
                        </Text>
                      )}
                  </View>

                  {/* STYLIST SELECTION UI */}
                  <View style={{ marginTop: 25 }}>
                    <Text style={styles.sectionTitle}>CASHIER</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ flexDirection: "row" }}
                    >
                      {staffList.map((employee) => (
                        <TouchableOpacity
                          key={employee.id}
                          onPress={() => setCashier(employee.name)}
                          style={[
                            styles.paymentBtn,
                            { marginRight: 10, paddingHorizontal: 25, flex: 0 },
                            cashier === employee.name
                              ? styles.paymentBtnActive
                              : {},
                          ]}
                        >
                          <Text
                            style={
                              cashier === employee.name
                                ? styles.textWhiteBold
                                : styles.textGray
                            }
                          >
                            {employee.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              </ScrollView>

              <View
                style={[
                  styles.checkoutFooter,
                  { flexDirection: "row", gap: 10 },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.printBtn,
                    { flex: 1, backgroundColor: "#0A84FF" },
                    Number(amountTendered) > 0 &&
                      Number(amountTendered) < cartTotal && {
                        backgroundColor: "#2C2C2E",
                      },
                  ]}
                  onPress={() => finalizeTransaction(true)} // Confirm & Print Flow
                  disabled={
                    Number(amountTendered) > 0 &&
                    Number(amountTendered) < cartTotal
                  }
                >
                  <Text style={styles.textWhiteBold}>🖨️ Selesai & Print</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.printBtn,
                    { flex: 1 },
                    paymentMethod === "Cash" &&
                      Number(amountTendered) < cartTotal && {
                        backgroundColor: "#2C2C2E",
                      },
                  ]}
                  onPress={() => finalizeTransaction(false)} // Confirm Only Flow
                  disabled={
                    Number(amountTendered) > 0 &&
                    Number(amountTendered) < cartTotal
                  }
                >
                  <Text style={styles.textWhiteBold}>✅ Selesai</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// --- STYLESHEET ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    padding: 20,
    backgroundColor: "#121212",
    borderBottomWidth: 1,
    borderBottomColor: "#2C2C2E",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFF",
    marginBottom: 15,
  },

  categoryScroll: {
    flexDirection: "row",
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  categoryActive: {
    backgroundColor: "#0A84FF",
  },
  categoryInactive: {
    backgroundColor: "#2C2C2E",
  },
  categoryText: {
    fontWeight: "bold",
  },

  textWhite: {
    color: "#FFF",
  },
  textWhiteBold: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  textGray: {
    color: "#8E8E93",
  },

  grid: {
    padding: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  itemCard: {
    width: "48%",
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
  },
  itemImagePlaceholder: {
    height: 80,
    backgroundColor: "#2C2C2E",
    borderRadius: 8,
    marginBottom: 10,
  },
  itemName: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  itemPrice: {
    color: "#0A84FF",
    fontSize: 14,
    marginTop: 5,
    fontWeight: "bold",
  },
  addButton: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "#0A84FF",
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
    lineHeight: 22,
  },

  cartBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#2C2C2E",
  },
  cartTotal: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "bold",
  },
  chargeBtn: {
    backgroundColor: "#34C759",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  chargeBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
    flexDirection: "row",
  },
  modalBgClose: {
    flex: 1,
  },

  sidePanel: {
    width: "80%",
    maxWidth: 400,
    backgroundColor: "#1C1C1E",
    height: "100%",
    borderLeftWidth: 1,
    borderColor: "#2C2C2E",
  },
  sidePanelHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderColor: "#2C2C2E",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalTitle: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  closeBtn: {
    color: "#8E8E93",
    fontSize: 30,
    lineHeight: 30,
  },
  sidePanelBody: {
    flex: 1,
    padding: 20,
  },
  descriptionBox: {
    color: "#8E8E93",
    backgroundColor: "#121212",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  sectionTitle: {
    color: "#8E8E93",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 10,
  },
  addonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start", // <-- Added to keep the price pinned to the top right if text wraps
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  addonSelected: {
    borderColor: "#0A84FF",
    backgroundColor: "rgba(10,132,255,0.1)",
  },
  addonUnselected: {
    borderColor: "#2C2C2E",
    backgroundColor: "#121212",
  },
  addonName: {
    fontWeight: "bold",
    flex: 1, // <-- Added to force wrapping
    flexShrink: 1, // <-- Added to force wrapping
    paddingRight: 15, // <-- Adds an invisible gap so text never touches the price
  },
  addonPrice: {
    textAlign: "right", // <-- New style to ensure the price stays aligned
  },
  sidePanelFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderColor: "#2C2C2E",
    backgroundColor: "#1C1C1E",
  },
  addToOrderBtn: {
    backgroundColor: "#0A84FF",
    padding: 15,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
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
  checkoutBody: {
    padding: 20,
    backgroundColor: "#121212",
  },
  checkoutFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderColor: "#2C2C2E",
  },
  printBtn: {
    backgroundColor: "#34C759",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },

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
  receiptCenter: {
    color: "#000",
    textAlign: "center",
    fontSize: 12,
  },
  receiptDivider: {
    color: "#000",
    textAlign: "center",
    marginVertical: 5,
  },
  receiptLine: {
    color: "#000",
    fontSize: 12,
  },
  receiptAddon: {
    color: "#555",
    fontSize: 12,
    paddingLeft: 10,
  },
  receiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 2,
  },
  receiptBold: {
    color: "#000",
    fontSize: 14,
    fontWeight: "bold",
  },

  paymentContainer: {
    marginTop: 30,
  },
  paymentRow: {
    flexDirection: "row",
    gap: 10,
  },
  paymentBtn: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#2C2C2E",
    backgroundColor: "#1C1C1E",
    alignItems: "center",
  },
  paymentBtnActive: {
    borderColor: "#0A84FF",
    backgroundColor: "rgba(10,132,255,0.2)",
  },
  cashInputContainer: {
    marginTop: 20,
    backgroundColor: "#1C1C1E",
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  cashInput: {
    backgroundColor: "#121212",
    color: "#FFF",
    fontSize: 20,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2C2C2E",
    marginTop: 10,
  },
  searchContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#121212",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#1C1C1E",
    color: "#FFF",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2C2C2E",
    fontSize: 14,
  },
  clearSearchBtn: {
    paddingHorizontal: 5,
  },
  quickEditInput: {
    backgroundColor: "#121212",
    color: "#FFF",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0A84FF",
    fontSize: 16,
    fontWeight: "bold",
  },
  quickEditBtn: {
    backgroundColor: "rgba(10,132,255,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#0A84FF",
  },
  quickSaveBtn: {
    backgroundColor: "#34C759",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  // --- CUSTOM ADD-ON STYLES ---
  customAddonHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
    marginTop: 10,
  },
  customAddonActionText: {
    color: "#0A84FF",
    fontSize: 12,
    fontWeight: "bold",
  },
  customAddonListContainer: {
    gap: 10,
    marginBottom: 20,
  },
  customAddonEditRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  customAddonInputName: {
    flex: 2,
    backgroundColor: "#1C1C1E",
    color: "#FFF",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  customAddonInputPrice: {
    flex: 1,
    backgroundColor: "#1C1C1E",
    color: "#FFF",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  customAddonDeleteBtn: {
    padding: 10,
  },
  customAddonDeleteText: {
    color: "#FF453A",
    fontWeight: "bold",
    fontSize: 18,
  },
  customAddonAddRowBtn: {
    marginTop: 5,
    padding: 12,
    backgroundColor: "rgba(10,132,255,0.2)",
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#0A84FF",
  },
  customAddonAddRowText: {
    color: "#0A84FF",
    fontWeight: "bold",
  },
  customAddonEmptyText: {
    color: "#8E8E93",
    fontStyle: "italic",
    fontSize: 12,
  },
  customAddonSelectRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
  },
  customAddonSelectRowActive: {
    borderColor: "#0A84FF",
    backgroundColor: "rgba(10,132,255,0.2)",
  },
  customAddonSelectRowInactive: {
    borderColor: "#2C2C2E",
    backgroundColor: "#1C1C1E",
  },
  customAddonSelectText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  customAddonSelectPrice: {
    color: "#8E8E93",
  },
  sidePanelHeroImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginBottom: 15,
    resizeMode: "cover",
  },
});
