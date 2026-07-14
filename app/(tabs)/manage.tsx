import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import * as ImagePicker from "expo-image-picker";

import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { db } from "../../database/db";

export default function ManageScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<"Menu" | "Staff">("Menu");

  // Database States
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);

  // filter states
  const [categories, setCategories] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState("Semua");
  // filter states for searching
  const [searchQuery, setSearchQuery] = useState("");
  // logic for selected category
  const displayedMenuItems = menuItems.filter((item) => {
    if (searchQuery.length > 0) {
      return item.name.toLowerCase().includes(searchQuery.toLowerCase());
    }

    if (activeCategory === "Semua") {
      return true;
    }
    return item.category === activeCategory;
  });

  // menu management states
  const [showAddMenuModal, setShowAddMenuModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemImage, setNewItemImage] = useState<string | null>(null);
  const [isStockEnabled, setIsStockEnabled] = useState(false);
  const [stockQuantity, setStockQuantity] = useState("");
  const [itemAddOns, setItemAddOns] = useState<any[]>([]);

  // staff menagement states
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffRole, setNewStaffRole] = useState("Stylist");

  const handleAddAddOnRow = () => {
    setItemAddOns([...itemAddOns, { name: "", additional_price: "" }]);
  };

  const handleUpdateAddOn = (index: number, field: string, value: string) => {
    const updated = [...itemAddOns];
    updated[index][field] = value;
    setItemAddOns(updated);
  };

  const handleRemoveAddOn = (index: number) => {
    setItemAddOns(itemAddOns.filter((_, i) => i !== index));
  };

  // handler to open modal in edit mode
  const openEditMenuModal = (item: any) => {
    setEditingItemId(item.id);
    setNewItemName(item.name);
    setNewItemCategory(item.category);
    setNewItemPrice(item.base_price.toString());
    setNewItemDesc(item.description || "");
    setIsStockEnabled(!!item.is_stock_enabled);
    setStockQuantity(item.stock_quantity ? item.stock_quantity.toString() : "");
    setShowAddMenuModal(true);
    setNewItemImage(item.image_uri || null);
    // fetch from addons table
    const existingAddOns = db.getAllSync(
      "SELECT * FROM Add_Ons WHERE service_id = ?",
      item.id,
    );
    // Convert numbers to strings for the TextInputs
    setItemAddOns(
      existingAddOns.map((addon: any) => ({
        name: addon.name,
        additional_price: addon.additional_price.toString(),
      })),
    );
  };

  // add menu handler
  const handleSaveMenuItem = () => {
    if (!newItemName || !newItemCategory || !newItemPrice)
      return alert("Nama, kategori, dan kategori dibutuhkan!");
    try {
      // editing item
      if (editingItemId) {
        db.runSync(
          "UPDATE Services_Products SET name = ?, category = ?, base_price = ?, description = ?, is_stock_enabled = ?, stock_quantity = ?, image_uri = ? WHERE id = ?",
          [
            newItemName,
            newItemCategory,
            Number(newItemPrice),
            newItemDesc,
            isStockEnabled ? 1 : 0,
            Number(stockQuantity) || 0,
            newItemImage,
            editingItemId,
          ],
        );

        // Wipe old add-ons for this item
        db.runSync("DELETE FROM Add_Ons WHERE service_id = ?", editingItemId);

        // Save new add-ons
        itemAddOns.forEach((addon) => {
          if (addon.name && addon.additional_price) {
            db.runSync(
              "INSERT INTO Add_Ons (service_id, name, additional_price) VALUES (?, ?, ?)",
              editingItemId,
              addon.name,
              Number(addon.additional_price),
            );
          }
        });
      } else {
        // INSERT BRAND NEW ITEM
        const result = db.runSync(
          "INSERT INTO Services_Products (name, category, base_price, description, is_stock_enabled, stock_quantity, image_uri) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            newItemName,
            newItemCategory,
            Number(newItemPrice),
            newItemDesc,
            isStockEnabled ? 1 : 0,
            Number(stockQuantity) || 0,
            newItemImage,
          ],
        );

        const newServiceId = result.lastInsertRowId;

        // Save the add-ons using that new ID
        itemAddOns.forEach((addon) => {
          if (addon.name && addon.additional_price) {
            db.runSync(
              "INSERT INTO Add_Ons (service_id, name, additional_price) VALUES (?, ?, ?)",
              newServiceId,
              addon.name,
              Number(addon.additional_price),
            );
          }
        });
      }

      // refresh the ui
      // Refresh the UI list immediately
      const refreshedItems = db.getAllSync(
        "SELECT * FROM Services_Products ORDER BY name ASC",
      );
      setMenuItems(refreshedItems);

      // Extract categories and auto-select the one we just added!
      const uniqueCats = Array.from(
        new Set(refreshedItems.map((s: any) => s.category)),
      ) as string[];
      setCategories(["Semua", ...uniqueCats]);
      setActiveCategory(newItemCategory); // <-- Force UI to snap to this category instantly!

      // Clear inputs and close

      // clear inputs for the next item added
      setEditingItemId(null);
      setNewItemName("");
      setNewItemCategory("");
      setNewItemPrice("");
      setNewItemDesc("");
      setShowAddMenuModal(false);
      setItemAddOns([]);
    } catch (e) {
      console.error("Error adding menu item:", e);
    }
  };

  // handler to delete menu
  const handleDeleteMenuItem = (id: number) => {
    try {
      db.runSync("DELETE FROM Services_Products WHERE id = ?", id);
      const refreshedItems = db.getAllSync(
        "SELECT * FROM Services_Products ORDER BY category, name",
      );
      setMenuItems(refreshedItems);

      const uniqueCats = Array.from(
        new Set(refreshedItems.map((s: any) => s.category)),
      ) as string[];
      setCategories(["Semua", ...uniqueCats]);

      // If the current category was wiped out completely, fallback to the first available category
      if (!uniqueCats.includes(activeCategory)) {
        setActiveCategory("Semua");
      }
    } catch (e) {
      console.error("Error deleting menu item:", e);
    }
  };

  // Staff Handlers ---
  const handleSaveStaff = () => {
    if (!newStaffName || !newStaffRole)
      return alert("Nama dan Posisi wajib diisi!");

    try {
      db.runSync(
        "INSERT INTO Employees (name, role) VALUES (?, ?)",
        newStaffName,
        newStaffRole,
      );

      // Refresh the staff list instantly
      const refreshedStaff = db.getAllSync(
        "SELECT * FROM Employees ORDER BY name",
      );
      setStaffList(refreshedStaff);

      // Close modal and reset form
      setShowAddStaffModal(false);
      setNewStaffName("");
      setNewStaffRole("Stylist");
    } catch (e) {
      console.error("Error adding staff:", e);
    }
  };

  const handleDeleteStaff = (id: number) => {
    try {
      db.runSync("DELETE FROM Employees WHERE id = ?", id);
      const refreshedStaff = db.getAllSync(
        "SELECT * FROM Employees ORDER BY name",
      );
      setStaffList(refreshedStaff);
    } catch (e) {
      // If they have associated transactions, SQLite's foreign key protection will block the delete
      alert(
        "Tidak bisa menghapus staff yang sudah memiliki riwayat transaksi!",
      );
      console.error("Error deleting staff:", e);
    }
  };

  // image picker function

  const handlePickImage = async (useCamera: boolean) => {
    // ask for permission
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        return alert("Izin kamera dibutuhkan !");
      } else {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          return alert("Izin galery dibutuhkan!");
        }
      }
    }

    // launch the camera or galery with crop funtion
    let result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1], // Forces a perfect square crop
          quality: 0.5, // Compresses it so the app stays fast
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.5,
        });

    // Save the image path to our state
    if (!result.canceled) {
      setNewItemImage(result.assets[0].uri);
    }
  };

  // Fetch Data
  useFocusEffect(
    useCallback(() => {
      try {
        const services = db.getAllSync(
          "SELECT * FROM Services_Products ORDER BY name ASC",
        );
        setMenuItems(services);

        const uniqueCategories = Array.from(
          new Set(services.map((s: any) => s.category)),
        ) as string[];
        setCategories(["Semua", ...uniqueCategories]);

        const employees = db.getAllSync(
          "SELECT * FROM Employees ORDER BY name",
        );
        setStaffList(employees);
      } catch (error) {
        console.error("Error loading management data:", error);
      }
    }, []),
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Header & Tab Navigation */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Manajemen</Text>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "Menu" && styles.tabActive]}
            onPress={() => setActiveTab("Menu")}
          >
            <Text
              style={
                activeTab === "Menu" ? styles.textWhiteBold : styles.textGray
              }
            >
              Layanan & Produk
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "Staff" && styles.tabActive,
            ]}
            onPress={() => setActiveTab("Staff")}
          >
            <Text
              style={
                activeTab === "Staff" ? styles.textWhiteBold : styles.textGray
              }
            >
              Staff List
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      <ScrollView contentContainerStyle={styles.listContainer}>
        {activeTab === "Menu" ? (
          <>
            {/* Open the modal */}
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => {
                setShowAddMenuModal(true);
                setNewItemName("");
                setNewItemCategory("");
                setNewItemPrice("");
                setNewItemDesc("");
                setItemAddOns([]);
                setEditingItemId(null);
                setIsStockEnabled(false);
                setStockQuantity("");
                setNewItemImage(null);
              }}
            >
              <Text style={styles.textWhiteBold}>+ Tambah Menu Baru</Text>
            </TouchableOpacity>

            {/* SEARCH BAR UI */}
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Cari menu atau produk..."
                placeholderTextColor="#8E8E93"
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery("")}
                  style={styles.clearSearchBtn}
                >
                  <Text style={{ color: "#0A84FF", fontWeight: "bold" }}>
                    Hapus
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* CATEGORY SCROLL VIEW */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 20, flexDirection: "row" }}
            >
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setActiveCategory(cat)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    marginRight: 10,
                    backgroundColor:
                      activeCategory === cat ? "#0A84FF" : "#2C2C2E",
                  }}
                >
                  <Text
                    style={{
                      fontWeight: "bold",
                      color: activeCategory === cat ? "#FFF" : "#8E8E93",
                    }}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {displayedMenuItems.map((item) => (
              <View key={item.id} style={styles.listItem}>
                <View style={{ flex: 1, marginRight: 15 }}>
                  <Text style={styles.itemTitle}>{item.name}</Text>
                  <Text style={styles.itemSubtitle}>
                    {item.category} • Rp{" "}
                    {item.base_price.toLocaleString("id-ID")}
                  </Text>
                </View>
                {/* Edit and Delete Functions */}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    style={{
                      backgroundColor: "rgba(10, 132, 255, 0.1)",
                      padding: 10,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: "#0A84FF",
                    }}
                    onPress={() => openEditMenuModal(item)}
                  >
                    <Text
                      style={{
                        color: "#0A84FF",
                        fontWeight: "bold",
                        fontSize: 12,
                      }}
                    >
                      Edit
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteMenuItem(item.id)}
                  >
                    <Text style={styles.deleteText}>Hapus</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        ) : (
          <>
            {/* Open Add Staff Modal */}
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddStaffModal(true)}
            >
              <Text style={styles.textWhiteBold}>+ Tambah Staff Baru</Text>
            </TouchableOpacity>

            {staffList.map((staff) => (
              <View key={staff.id} style={styles.listItem}>
                <View>
                  <Text style={styles.itemTitle}>{staff.name}</Text>
                  <Text style={styles.itemSubtitle}>Posisi: {staff.role}</Text>
                </View>
                {/* Trigger Delete Function */}
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteStaff(staff.id)}
                >
                  <Text style={styles.deleteText}>Hapus</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>
      {/* ADD MENU ITEM MODAL */}
      <Modal
        visible={showAddMenuModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddMenuModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.8)",
              justifyContent: "center",
              paddingHorizontal: 20,
              paddingTop: insets.top || 20,
              paddingBottom: insets.bottom || 20,
            }}
          >
            {/* Added maxHeight: '90%' to keep it contained */}
            <View
              style={{
                backgroundColor: "#1C1C1E",
                padding: 20,
                borderRadius: 15,
                width: "100%",
                maxWidth: 400,
                alignSelf: "center",
                maxHeight: "90%",
              }}
            >
              <Text
                style={{
                  color: "#FFF",
                  fontSize: 20,
                  fontWeight: "bold",
                  marginBottom: 20,
                }}
              >
                {editingItemId ? "Edit Menu" : "Menu Baru"}
              </Text>

              {/* --- WRAP ALL INPUTS IN A SCROLLVIEW --- */}
              <ScrollView
                style={{ marginBottom: 20 }}
                showsVerticalScrollIndicator={false}
              >
                {/* IMAGE PICKER UI */}
                <View style={styles.imagePickerContainer}>
                  <TouchableOpacity onPress={() => handlePickImage(false)}>
                    {newItemImage ? (
                      <Image
                        source={{ uri: newItemImage }}
                        style={styles.imagePreview}
                      />
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <Text style={styles.imagePlaceholderText}>+ Foto</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <View style={styles.imageActionRow}>
                    <TouchableOpacity onPress={() => handlePickImage(true)}>
                      <Text style={styles.imageActionTextPrimary}>
                        📷 Kamera
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handlePickImage(false)}>
                      <Text style={styles.imageActionTextPrimary}>
                        🖼️ Galeri
                      </Text>
                    </TouchableOpacity>
                    {newItemImage && (
                      <TouchableOpacity onPress={() => setNewItemImage(null)}>
                        <Text style={styles.imageActionTextDanger}>
                          🗑️ Hapus
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                {/* Category Selector & Input */}
                <TextInput
                  style={{
                    backgroundColor: "#121212",
                    color: "#FFF",
                    padding: 15,
                    borderRadius: 8,
                    marginBottom: 15,
                    borderWidth: 1,
                    borderColor: "#2C2C2E",
                  }}
                  placeholder="Nama Menu (e.g., Potong Rambut)"
                  placeholderTextColor="#8E8E93"
                  value={newItemName}
                  onChangeText={setNewItemName}
                />

                <Text
                  style={{
                    color: "#8E8E93",
                    fontSize: 12,
                    fontWeight: "bold",
                    marginBottom: 10,
                  }}
                >
                  KATEGORI
                </Text>
                {categories.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ flexDirection: "row", marginBottom: 10 }}
                  >
                    {categories.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => setNewItemCategory(cat)}
                        style={{
                          padding: 10,
                          paddingHorizontal: 15,
                          borderRadius: 10,
                          borderWidth: 2,
                          borderColor:
                            newItemCategory === cat ? "#0A84FF" : "#2C2C2E",
                          backgroundColor:
                            newItemCategory === cat
                              ? "rgba(10,132,255,0.2)"
                              : "#1C1C1E",
                          marginRight: 10,
                        }}
                      >
                        <Text
                          style={
                            newItemCategory === cat
                              ? styles.textWhiteBold
                              : styles.textGray
                          }
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                <TextInput
                  style={{
                    backgroundColor: "#121212",
                    color: "#FFF",
                    padding: 15,
                    borderRadius: 8,
                    marginBottom: 15,
                    borderWidth: 1,
                    borderColor: "#2C2C2E",
                  }}
                  placeholder="Atau tambah kategori baru..."
                  placeholderTextColor="#8E8E93"
                  value={newItemCategory}
                  onChangeText={setNewItemCategory}
                />

                {/* Basic Item Details */}
                <TextInput
                  style={{
                    backgroundColor: "#121212",
                    color: "#FFF",
                    padding: 15,
                    borderRadius: 8,
                    marginBottom: 15,
                    borderWidth: 1,
                    borderColor: "#2C2C2E",
                  }}
                  placeholder="Harga Dasar (e.g., 50000)"
                  placeholderTextColor="#8E8E93"
                  keyboardType="numeric"
                  value={newItemPrice}
                  onChangeText={setNewItemPrice}
                />
                <TextInput
                  style={{
                    backgroundColor: "#121212",
                    color: "#FFF",
                    padding: 15,
                    borderRadius: 8,
                    marginBottom: 25,
                    borderWidth: 1,
                    borderColor: "#2C2C2E",
                    height: 80,
                  }}
                  placeholder="Deskripsi (Optional)"
                  placeholderTextColor="#8E8E93"
                  multiline
                  value={newItemDesc}
                  onChangeText={setNewItemDesc}
                />

                {/* INVENTORY TRACKING UI */}
                <View style={styles.stockContainer}>
                  <View style={styles.stockHeader}>
                    <View>
                      <Text style={styles.stockTitle}>Stok?</Text>
                    </View>
                    <Switch
                      trackColor={{ false: "#2C2C2E", true: "#34C759" }}
                      thumbColor={"#FFF"}
                      onValueChange={setIsStockEnabled}
                      value={isStockEnabled}
                    />
                  </View>

                  {/* Conditionally render the quantity input only if the switch is ON */}
                  {isStockEnabled && (
                    <View style={styles.stockQuantityContainer}>
                      <Text style={styles.stockQuantityLabel}>
                        JUMLAH STOK SAAT INI
                      </Text>
                      <TextInput
                        style={styles.stockQuantityInput}
                        placeholder="e.g. 50"
                        placeholderTextColor="#8E8E93"
                        keyboardType="numeric"
                        value={stockQuantity}
                        onChangeText={setStockQuantity}
                      />
                    </View>
                  )}
                </View>

                {/* Dynamic Add-Ons */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <Text
                    style={{
                      color: "#8E8E93",
                      fontSize: 12,
                      fontWeight: "bold",
                    }}
                  >
                    TAMBAHAN LAINNYA
                  </Text>
                  <TouchableOpacity onPress={handleAddAddOnRow}>
                    <Text
                      style={{
                        color: "#0A84FF",
                        fontSize: 12,
                        fontWeight: "bold",
                      }}
                    >
                      + Tambah Baris
                    </Text>
                  </TouchableOpacity>
                </View>

                {itemAddOns.map((addon, index) => (
                  <View
                    key={index}
                    style={{ flexDirection: "row", gap: 10, marginBottom: 15 }}
                  >
                    <TextInput
                      style={{
                        flex: 2,
                        backgroundColor: "#121212",
                        color: "#FFF",
                        padding: 12,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: "#2C2C2E",
                      }}
                      placeholder="Name (e.g. Styling)"
                      placeholderTextColor="#8E8E93"
                      value={addon.name}
                      onChangeText={(text) =>
                        handleUpdateAddOn(index, "name", text)
                      }
                    />
                    <TextInput
                      style={{
                        flex: 1.5,
                        backgroundColor: "#121212",
                        color: "#FFF",
                        padding: 12,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: "#2C2C2E",
                      }}
                      placeholder="Price"
                      placeholderTextColor="#8E8E93"
                      keyboardType="numeric"
                      value={addon.additional_price}
                      onChangeText={(text) =>
                        handleUpdateAddOn(index, "additional_price", text)
                      }
                    />
                    <TouchableOpacity
                      style={{
                        justifyContent: "center",
                        alignItems: "center",
                        paddingHorizontal: 10,
                      }}
                      onPress={() => handleRemoveAddOn(index)}
                    >
                      <Text
                        style={{
                          color: "#FF453A",
                          fontSize: 18,
                          fontWeight: "bold",
                        }}
                      >
                        X
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>

              {/* PINNED BOTTOM BUTTONS */}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    padding: 15,
                    borderRadius: 8,
                    backgroundColor: "#2C2C2E",
                    alignItems: "center",
                  }}
                  onPress={() => setShowAddMenuModal(false)}
                >
                  <Text style={styles.textWhiteBold}>Batal</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flex: 1,
                    padding: 15,
                    borderRadius: 8,
                    backgroundColor: "#34C759",
                    alignItems: "center",
                  }}
                  onPress={handleSaveMenuItem}
                >
                  <Text style={styles.textWhiteBold}>
                    {editingItemId ? "Update" : "Simpan"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ADD STAFF MODAL */}
      <Modal
        visible={showAddStaffModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddStaffModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.8)",
              justifyContent: "center",
              paddingHorizontal: 20,
              paddingTop: insets.top || 20,
              paddingBottom: insets.bottom || 20,
            }}
          >
            <View
              style={{
                backgroundColor: "#1C1C1E",
                padding: 20,
                borderRadius: 15,
                width: "100%",
                maxWidth: 400,
                alignSelf: "center",
              }}
            >
              <Text
                style={{
                  color: "#FFF",
                  fontSize: 20,
                  fontWeight: "bold",
                  marginBottom: 20,
                }}
              >
                Tambah Staff Baru
              </Text>

              <Text
                style={{
                  color: "#8E8E93",
                  fontSize: 12,
                  fontWeight: "bold",
                  marginBottom: 10,
                }}
              >
                NAMA STAFF
              </Text>
              <TextInput
                style={{
                  backgroundColor: "#121212",
                  color: "#FFF",
                  padding: 15,
                  borderRadius: 8,
                  marginBottom: 15,
                  borderWidth: 1,
                  borderColor: "#2C2C2E",
                }}
                placeholder="e.g., Arlina"
                placeholderTextColor="#8E8E93"
                value={newStaffName}
                onChangeText={setNewStaffName}
              />

              <Text
                style={{
                  color: "#8E8E93",
                  fontSize: 12,
                  fontWeight: "bold",
                  marginBottom: 10,
                }}
              >
                POSISI / ROLE
              </Text>
              <TextInput
                style={{
                  backgroundColor: "#121212",
                  color: "#FFF",
                  padding: 15,
                  borderRadius: 8,
                  marginBottom: 25,
                  borderWidth: 1,
                  borderColor: "#2C2C2E",
                }}
                placeholder="e.g., Stylist, Cashier"
                placeholderTextColor="#8E8E93"
                value={newStaffRole}
                onChangeText={setNewStaffRole}
              />

              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    padding: 15,
                    borderRadius: 8,
                    backgroundColor: "#2C2C2E",
                    alignItems: "center",
                  }}
                  onPress={() => setShowAddStaffModal(false)}
                >
                  <Text style={styles.textWhiteBold}>Batal</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flex: 1,
                    padding: 15,
                    borderRadius: 8,
                    backgroundColor: "#34C759",
                    alignItems: "center",
                  }}
                  onPress={handleSaveStaff}
                >
                  <Text style={styles.textWhiteBold}>Simpan</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },

  header: {
    padding: 20,
    backgroundColor: "#121212",
    borderBottomWidth: 1,
    borderColor: "#2C2C2E",
  },

  headerTitle: {
    marginBottom: 15,
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFF",
  },

  tabContainer: {
    flexDirection: "row",
    gap: 10,
  },

  tabButton: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#1C1C1E",
  },

  tabActive: {
    backgroundColor: "#0A84FF",
  },

  textWhiteBold: {
    fontWeight: "bold",
    color: "#FFF",
  },

  textGray: {
    color: "#8E8E93",
  },

  listContainer: {
    padding: 20,
  },

  addButton: {
    alignItems: "center",
    marginBottom: 20,
    padding: 15,
    borderRadius: 10,
    backgroundColor: "#34C759",
  },

  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2C2C2E",
    backgroundColor: "#1C1C1E",
  },

  itemTitle: {
    marginBottom: 5,
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFF",
  },

  itemSubtitle: {
    fontSize: 12,
    color: "#8E8E93",
  },

  deleteButton: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FF453A",
    backgroundColor: "rgba(255, 69, 58, 0.1)",
  },

  deleteText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#FF453A",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  searchInput: {
    flex: 1,
    color: "#FFF",
    fontSize: 14,
  },
  clearSearchBtn: {
    paddingHorizontal: 5,
    marginLeft: 10,
  },

  stockContainer: {
    backgroundColor: "#1C1C1E",
    borderWidth: 1,
    borderColor: "#2C2C2E",
    borderRadius: 8,
    padding: 15,
    marginBottom: 25,
  },
  stockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stockTitle: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 14,
  },
  stockSubtitle: {
    color: "#8E8E93",
    fontSize: 12,
    marginTop: 4,
  },
  stockQuantityContainer: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#2C2C2E",
  },
  stockQuantityLabel: {
    color: "#8E8E93",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 10,
  },
  stockQuantityInput: {
    backgroundColor: "#121212",
    color: "#FFF",
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0A84FF",
  },
  imagePickerContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    backgroundColor: "#2C2C2E",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#3A3A3C",
    borderStyle: "dashed",
  },
  imagePlaceholderText: {
    color: "#8E8E93",
    fontWeight: "bold",
  },
  imageActionRow: {
    flexDirection: "row",
    gap: 20,
    marginTop: 15,
  },
  imageActionTextPrimary: {
    color: "#0A84FF",
    fontWeight: "bold",
  },
  imageActionTextDanger: {
    color: "#FF453A",
    fontWeight: "bold",
  },
});
