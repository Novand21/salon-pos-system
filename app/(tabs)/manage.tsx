import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

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
  const [activeCategory, setActiveCategory] = useState("");
  // logic for selected category
  const displayedMenuItems = menuItems.filter(
    (item) => item.category === activeCategory,
  );

  // menu management states
  const [showAddMenuModal, setShowAddMenuModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [itemAddOns, setItemAddOns] = useState<any[]>([]);

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
    setShowAddMenuModal(true);
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

  // const handleSaveMenuItem = () => {
  //   if (!newItemName || !newItemCategory || !newItemPrice)
  //     return alert("Name, category, and price are required!");

  //   try {
  //     if (editingItemId) {
  //       db.runSync(
  //         "UPDATE Services_Products SET name = ?, category = ?, base_price = ?, description = ? WHERE id = ?",
  //         newItemName,
  //         newItemCategory,
  //         Number(newItemPrice),
  //         newItemDesc,
  //         editingItemId,
  //       );
  //     } else {
  //       db.runSync(
  //         "INSERT INTO Services_Products (name, category, base_price, description) VALUES (?, ?, ?, ?)",
  //         newItemName,
  //         newItemCategory,
  //         Number(newItemPrice),
  //         newItemDesc,
  //       );
  //     }
  //     setEditingItemId(null);
  //   } catch (e) {
  //     console.error("Error editing menu item:", e);
  //   }
  // };

  // add menu handler
  const handleSaveMenuItem = () => {
    if (!newItemName || !newItemCategory || !newItemPrice)
      return alert("Nama, kategori, dan kategori dibutuhkan!");
    try {
      // editing item
      if (editingItemId) {
        // 1. UPDATE EXISTING ITEM
        db.runSync(
          "UPDATE Services_Products SET name = ?, category = ?, base_price = ?, description = ? WHERE id = ?",
          newItemName,
          newItemCategory,
          Number(newItemPrice),
          newItemDesc,
          editingItemId,
        );

        // 2. Wipe old add-ons for this item
        db.runSync("DELETE FROM Add_Ons WHERE service_id = ?", editingItemId);

        // 3. Save new add-ons
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
        // 1. INSERT BRAND NEW ITEM
        const result = db.runSync(
          "INSERT INTO Services_Products (name, category, base_price, description) VALUES (?, ?, ?, ?)",
          newItemName,
          newItemCategory,
          Number(newItemPrice),
          newItemDesc,
        );

        const newServiceId = result.lastInsertRowId;

        // 2. Save the add-ons using that new ID
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
      // 2. Refresh the UI list immediately
      const refreshedItems = db.getAllSync(
        "SELECT * FROM Services_Products ORDER BY category, name",
      );
      setMenuItems(refreshedItems);

      // Extract categories and auto-select the one we just added!
      const uniqueCats = Array.from(
        new Set(refreshedItems.map((s: any) => s.category)),
      ) as string[];
      setCategories(uniqueCats);
      setActiveCategory(newItemCategory); // <-- Force UI to snap to this category instantly!

      // 3. Clear inputs and close

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
      setCategories(uniqueCats);

      // If the current category was wiped out completely, fallback to the first available category
      if (!uniqueCats.includes(activeCategory) && uniqueCats.length > 0) {
        setActiveCategory(uniqueCats[0]);
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

  // Fetch Data
  useFocusEffect(
    useCallback(() => {
      try {
        const services = db.getAllSync(
          "SELECT * FROM Services_Products ORDER BY category, name",
        );
        setMenuItems(services);

        const uniqueCategories = Array.from(
          new Set(services.map((s: any) => s.category)),
        ) as string[];
        setCategories(uniqueCategories);
        if (uniqueCategories.length > 0) {
          // keep the selected category if selected, otherwise default to the first category
          setActiveCategory((prev) => prev || uniqueCategories[0]);
        }

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
              }}
            >
              <Text style={styles.textWhiteBold}>+ Tambah Menu Baru</Text>
            </TouchableOpacity>

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

              {/* 3. Dynamic Add-Ons */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <Text
                  style={{ color: "#8E8E93", fontSize: 12, fontWeight: "bold" }}
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

            {/* 4. PINNED BOTTOM BUTTONS */}
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
                <Text style={styles.textWhiteBold}>Cancel</Text>
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
                  {editingItemId ? "Update Item" : "Save Item"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- ADD STAFF MODAL --- */}
      <Modal
        visible={showAddStaffModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddStaffModal(false)}
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
                <Text style={styles.textWhiteBold}>Cancel</Text>
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
                <Text style={styles.textWhiteBold}>Save Staff</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
});
