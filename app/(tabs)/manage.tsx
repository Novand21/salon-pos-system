import { useFocusEffect } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
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

import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
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

  // staff management dashboard
  const [showStaffDashboard, setShowStaffDashboard] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // for staff attendance
  const [attStartDate, setAttStartDate] = useState<Date>(new Date());
  const [attEndDate, setAttEndDate] = useState<Date>(new Date());
  const [activeAttPicker, setActiveAttPicker] = useState<
    "start" | "end" | null
  >(null);
  const [activeTimePicker, setActiveTimePicker] = useState<{
    staffId: number;
    dateStr: string;
    currentDate: Date;
  } | null>(null);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);

  const handleAttDateChange = (event: any, date?: Date) => {
    if (Platform.OS === "android") setActiveAttPicker(null);
    if (date) {
      if (activeAttPicker === "start") {
        setAttStartDate(date);
        if (date > attEndDate) setAttEndDate(date);
      } else if (activeAttPicker === "end") {
        setAttEndDate(date);
        if (date < attStartDate) setAttStartDate(date);
      }
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === "android") {
      setActiveTimePicker(null);
    }
    if (selectedTime && activeTimePicker) {
      const timeStr = selectedTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      markAttendance(
        activeTimePicker.staffId,
        activeTimePicker.dateStr,
        "Hadir",
        timeStr,
      );
    }
  };

  const loadAttendance = useCallback(() => {
    const getLocalDateString = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const startStr = getLocalDateString(attStartDate);
    const endStr = getLocalDateString(attEndDate);

    try {
      const rawAtt = db.getAllSync(
        "SELECT * FROM Attendance WHERE date >= ? AND date <= ?",
        [startStr, endStr],
      );

      let table: any[] = [];
      let currDate = new Date(attStartDate);
      currDate.setHours(0, 0, 0, 0);
      let lastDate = new Date(attEndDate);
      lastDate.setHours(0, 0, 0, 0);

      while (currDate <= lastDate) {
        const dateStr = getLocalDateString(currDate);
        const displayDate = currDate.toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });

        staffList.forEach((staff) => {
          const record: any = rawAtt.find(
            (r: any) => r.employee_id === staff.id && r.date === dateStr,
          );
          table.push({
            staffId: staff.id,
            staffName: staff.name,
            date: dateStr,
            displayDate: displayDate,
            startTime: record ? record.start_time : "-",
            status: record ? record.status : null,
          });
        });
        currDate.setDate(currDate.getDate() + 1);
      }
      setAttendanceData(table);
    } catch (e) {
      console.error("Error loading attendance:", e);
    }
  }, [attStartDate, attEndDate, staffList]);

  // Reload table whenever dates or staff list change
  React.useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const markAttendance = useCallback(
    (employeeId: number, dateStr: string, status: string, time: string) => {
      try {
        const existing: any = db.getFirstSync(
          "SELECT id FROM Attendance WHERE employee_id = ? AND date = ?",
          [employeeId, dateStr],
        );

        const startTime = status === "Hadir" ? time : "-";

        if (existing) {
          db.runSync(
            "UPDATE Attendance SET status = ?, start_time = ? WHERE id = ?",
            [status, startTime, existing.id],
          );
        } else {
          db.runSync(
            "INSERT INTO Attendance (employee_id, date, start_time, status) VALUES (?, ?, ?, ?)",
            [employeeId, dateStr, startTime, status],
          );
        }
        loadAttendance();
      } catch (error) {
        console.error("Error marking attendance:", error);
      }
    },
    [loadAttendance],
  );

  const toggleSidebar = (open: boolean) => {
    if (open) {
      setIsSidebarOpen(true);
      setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }, 50);
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setIsSidebarOpen(false);
      });
    }
  };
  const [staffDashboardTab, setStaffDashboardTab] = useState<
    "List" | "Attendance" | "Bonus"
  >("List");

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
    setItemAddOns([
      ...itemAddOns,
      { name: "", additional_price: "", stock_quantity: "" },
    ]);
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
        stock_quantity: addon.is_stock_enabled
          ? addon.stock_quantity.toString()
          : "",
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
            // Check if this add-on already exists anywhere else in the DB
            const existingGlobal: any = db.getFirstSync(
              "SELECT is_stock_enabled, stock_quantity FROM Add_Ons WHERE name = ?",
              [addon.name],
            );

            // Inherit its stock if it exists, otherwise default to 0 (unlimited)
            const isStockEnabled = existingGlobal
              ? existingGlobal.is_stock_enabled
              : 0;
            const stockQty = existingGlobal ? existingGlobal.stock_quantity : 0;

            db.runSync(
              "INSERT INTO Add_Ons (service_id, name, additional_price, is_stock_enabled, stock_quantity) VALUES (?, ?, ?, ?, ?)",
              [
                editingItemId,
                addon.name,
                Number(addon.additional_price),
                isStockEnabled,
                stockQty,
              ],
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
            // Check if this add-on already exists anywhere else in the DB
            const existingGlobal: any = db.getFirstSync(
              "SELECT is_stock_enabled, stock_quantity FROM Add_Ons WHERE name = ?",
              [addon.name],
            );

            // Inherit its stock if it exists, otherwise default to 0 (unlimited)
            const isStockEnabled = existingGlobal
              ? existingGlobal.is_stock_enabled
              : 0;
            const stockQty = existingGlobal ? existingGlobal.stock_quantity : 0;

            db.runSync(
              "INSERT INTO Add_Ons (service_id, name, additional_price, is_stock_enabled, stock_quantity) VALUES (?, ?, ?, ?, ?)",
              [
                newServiceId,
                addon.name,
                Number(addon.additional_price),
                isStockEnabled,
                stockQty,
              ],
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
  const handleDeleteMenuItem = (id: number, itemName: string) => {
    Alert.alert(
      "Konfirmasi Hapus",
      `Apakah yakin ingin menghapus menu ${itemName}`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: () => {
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
          },
        },
      ],
    );
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
      const handle = requestIdleCallback(
        () => {
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
        },
        { timeout: 1000 },
      );

      return () => cancelIdleCallback(handle);
    }, []),
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Header & Tab Navigation */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Manajemen</Text>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, styles.tabActive]}
            onPress={() => {}}
          >
            <Text style={styles.textWhiteBold}>Layanan & Produk</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tabButton}
            onPress={() => setShowStaffDashboard(true)}
          >
            <Text style={styles.textGray}>Staff Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area for Menus*/}
      <FlatList
        contentContainerStyle={styles.listContainer}
        data={displayedMenuItems}
        keyExtractor={(item) => item.id.toString()}
        initialNumToRender={15}
        maxToRenderPerBatch={20}
        windowSize={10}
        ListHeaderComponent={
          <>
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
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.listItem}>
            <View style={{ flex: 1, marginRight: 15 }}>
              <Text style={styles.itemTitle}>{item.name}</Text>
              <Text style={styles.itemSubtitle}>
                {item.category} • Rp {item.base_price.toLocaleString("id-ID")}
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
                onPress={() => handleDeleteMenuItem(item.id, item.name)}
              >
                <Text style={styles.deleteText}>Hapus</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
      {/* FULL SCREEN STAFF DASHBOARD MODAL */}
      <Modal
        visible={showStaffDashboard}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          if (isSidebarOpen) {
            toggleSidebar(false);
          } else {
            setShowStaffDashboard(false);
          }
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#000000" }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            {/* Dashboard Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 20,
                backgroundColor: "#121212",
                borderBottomWidth: 1,
                borderBottomColor: "#2C2C2E",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <TouchableOpacity
                  onPress={() => toggleSidebar(true)}
                  style={{ marginRight: 15 }}
                >
                  <MaterialCommunityIcons name="menu" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text
                  style={{ color: "#FFF", fontSize: 20, fontWeight: "bold" }}
                >
                  {staffDashboardTab === "List" && "Daftar Staff"}
                  {staffDashboardTab === "Attendance" && "Absensi Staff"}
                  {staffDashboardTab === "Bonus" && "Perhitungan Komisi"}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setShowStaffDashboard(false)}
                style={{ padding: 5 }}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={28}
                  color="#8E8E93"
                />
              </TouchableOpacity>
            </View>

            {/* Main Content Area */}
            <View style={{ flex: 1 }}>
              {staffDashboardTab === "List" && (
                <ScrollView contentContainerStyle={styles.listContainer}>
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => setShowAddStaffModal(true)}
                  >
                    <Text style={styles.textWhiteBold}>
                      + Tambah Staff Baru
                    </Text>
                  </TouchableOpacity>
                  {staffList.map((staff) => (
                    <View key={staff.id} style={styles.listItem}>
                      <View>
                        <Text style={styles.itemTitle}>{staff.name}</Text>
                        <Text style={styles.itemSubtitle}>
                          Posisi: {staff.role}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteStaff(staff.id)}
                      >
                        <Text style={styles.deleteText}>Hapus</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
              {/* ATTENDANCE FOR STAFF */}
              {staffDashboardTab === "Attendance" && (
                <View style={styles.attendanceContainer}>
                  {/* Date Range Selectors */}
                  <View style={styles.dateRangeRow}>
                    <TouchableOpacity
                      onPress={() => setActiveAttPicker("start")}
                      style={styles.datePickerBox}
                    >
                      <Text style={styles.dateLabel}>DARI TANGGAL</Text>
                      <Text style={styles.dateValue}>
                        {attStartDate.toLocaleDateString("id-ID")}
                      </Text>
                    </TouchableOpacity>

                    <Text style={styles.dateDivider}>-</Text>

                    <TouchableOpacity
                      onPress={() => setActiveAttPicker("end")}
                      style={styles.datePickerBox}
                    >
                      <Text style={styles.dateLabel}>SAMPAI TANGGAL</Text>
                      <Text style={styles.dateValue}>
                        {attEndDate.toLocaleDateString("id-ID")}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Native Date Pickers */}
                  {activeAttPicker && (
                    <DateTimePicker
                      value={
                        activeAttPicker === "start" ? attStartDate : attEndDate
                      }
                      mode="date"
                      display="default"
                      onChange={handleAttDateChange}
                    />
                  )}

                  {/* Native Time Picker */}
                  {activeTimePicker && (
                    <DateTimePicker
                      value={activeTimePicker.currentDate}
                      mode="time"
                      is24Hour={true}
                      display={Platform.OS === "ios" ? "spinner" : "clock"}
                      onChange={handleTimeChange}
                    />
                  )}

                  {/* The Data Table */}
                  <View style={styles.tableContainer}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={true}
                    >
                      <View>
                        {/* Table Header */}
                        <View style={styles.tableHeaderRow}>
                          <Text
                            style={[styles.tableHeaderText, styles.colName]}
                          >
                            NAMA STAFF
                          </Text>
                          <Text
                            style={[styles.tableHeaderText, styles.colDate]}
                          >
                            TANGGAL
                          </Text>
                          <Text
                            style={[styles.tableHeaderText, styles.colTime]}
                          >
                            MULAI
                          </Text>
                          <Text
                            style={[
                              styles.tableHeaderText,
                              styles.colStatus,
                              { textAlign: "center" },
                            ]}
                          >
                            STATUS
                          </Text>
                        </View>
                        {/* Table Rows */}
                        <FlatList
                          data={attendanceData}
                          keyExtractor={(row, index) =>
                            `${row.staffId}-${row.date}-${row.status}-${row.startTime}-${index}`
                          }
                          showsVerticalScrollIndicator={true}
                          initialNumToRender={15}
                          maxToRenderPerBatch={20}
                          windowSize={5}
                          renderItem={({ item: row }) => (
                            <View style={styles.tableRow}>
                              <View
                                style={[
                                  styles.colName,
                                  {
                                    flexDirection: "row",
                                    alignItems: "center",
                                  },
                                ]}
                              >
                                <MaterialCommunityIcons
                                  name="account-circle-outline"
                                  size={24}
                                  color="#8E8E93"
                                  style={{ marginRight: 8 }}
                                />
                                <Text style={styles.tableCellText}>
                                  {row.staffName}
                                </Text>
                              </View>

                              <Text
                                style={[
                                  styles.tableCellText,
                                  styles.colDate,
                                  { color: "#8E8E93", fontWeight: "normal" },
                                ]}
                              >
                                {row.displayDate}
                              </Text>

                              <TouchableOpacity
                                style={{
                                  width: 60,
                                  backgroundColor: "#121212",
                                  padding: 5,
                                  borderRadius: 4,
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                                onPress={() => {
                                  let initDate = new Date();
                                  if (row.startTime && row.startTime !== "-") {
                                    const [hours, minutes] =
                                      row.startTime.split(":");
                                    initDate.setHours(
                                      parseInt(hours, 10),
                                      parseInt(minutes, 10),
                                      0,
                                      0,
                                    );
                                  }
                                  setActiveTimePicker({
                                    staffId: row.staffId,
                                    dateStr: row.date,
                                    currentDate: initDate,
                                  });
                                }}
                              >
                                <Text
                                  style={{
                                    color:
                                      row.startTime === "-" ? "#555" : "#FFF",
                                    fontWeight: "bold",
                                  }}
                                >
                                  {row.startTime === "-"
                                    ? "09:00"
                                    : row.startTime}
                                </Text>
                              </TouchableOpacity>

                              {/* Status Radio Buttons */}
                              <View
                                style={[
                                  styles.statusContainer,
                                  styles.colStatus,
                                ]}
                              >
                                {["Hadir", "Izin", "Sakit"].map((st) => (
                                  <TouchableOpacity
                                    key={st}
                                    onPress={() => {
                                      let timeToSave = row.startTime;
                                      if (
                                        st === "Hadir" &&
                                        (timeToSave === "-" ||
                                          timeToSave === "" ||
                                          !timeToSave)
                                      ) {
                                        timeToSave =
                                          new Date().toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          });
                                      }
                                      markAttendance(
                                        row.staffId,
                                        row.date,
                                        st,
                                        timeToSave,
                                      );
                                    }}
                                    style={styles.statusBtn}
                                  >
                                    <MaterialCommunityIcons
                                      name={
                                        row.status === st
                                          ? "circle-slice-8"
                                          : "circle-outline"
                                      }
                                      color={
                                        row.status === st
                                          ? st === "Hadir"
                                            ? "#34C759"
                                            : st === "Izin"
                                              ? "#FF9F0A"
                                              : "#FF453A"
                                          : "#8E8E93"
                                      }
                                      size={20}
                                    />
                                    <Text
                                      style={[
                                        styles.statusText,
                                        {
                                          color:
                                            row.status === st
                                              ? "#FFF"
                                              : "#8E8E93",
                                        },
                                      ]}
                                    >
                                      {st}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            </View>
                          )}
                        />
                      </View>
                    </ScrollView>
                  </View>
                </View>
              )}
              {/* BONUS CALCULATION FOR STAFF */}
              {staffDashboardTab === "Bonus" && (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <MaterialCommunityIcons
                    name="tools"
                    size={60}
                    color="#8E8E93"
                  />
                  <Text
                    style={{ color: "#8E8E93", marginTop: 15, fontSize: 16 }}
                  >
                    Fitur Perhitungan Komisi sedang dibangun...
                  </Text>
                </View>
              )}
            </View>

            {/* SIDEBAR OVERLAY */}
            {isSidebarOpen && (
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  zIndex: 10,
                }}
              >
                <Animated.View
                  style={{
                    flex: 1,
                    backgroundColor: "rgba(0,0,0,0.6)",
                    opacity: slideAnim,
                  }}
                >
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: "row" }}
                    activeOpacity={1}
                    onPress={() => toggleSidebar(false)}
                  >
                    <Animated.View
                      style={{
                        width: 240,
                        backgroundColor: "#1C1C1E",
                        height: "100%",
                        paddingHorizontal: 15,
                        paddingTop: insets.top ? insets.top + 20 : 40,
                        paddingBottom: insets.bottom ? insets.bottom + 20 : 20,
                        borderRightWidth: 1,
                        borderColor: "#2C2C2E",
                        transform: [
                          {
                            translateX: slideAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [-240, 0],
                            }),
                          },
                        ],
                      }}
                    >
                      <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => {}}
                        style={{ flex: 1 }}
                      >
                        <Text
                          style={{
                            color: "#8E8E93",
                            fontSize: 16,
                            fontWeight: "bold",
                            marginBottom: 20,
                          }}
                        >
                          MENU MANAJEMEN
                        </Text>

                        <TouchableOpacity
                          style={[
                            styles.sidebarMenuItem,
                            staffDashboardTab === "List" &&
                              styles.sidebarMenuItemActive,
                          ]}
                          onPress={() => {
                            setStaffDashboardTab("List");
                            toggleSidebar(false);
                          }}
                        >
                          <MaterialCommunityIcons
                            name="account-tie"
                            size={20}
                            color={
                              staffDashboardTab === "List"
                                ? "#0A84FF"
                                : "#8E8E93"
                            }
                          />
                          <Text
                            style={[
                              styles.sidebarMenuText,
                              staffDashboardTab === "List" && {
                                color: "#0A84FF",
                                fontWeight: "bold",
                              },
                            ]}
                          >
                            Daftar Staff
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.sidebarMenuItem,
                            staffDashboardTab === "Attendance" &&
                              styles.sidebarMenuItemActive,
                          ]}
                          onPress={() => {
                            setStaffDashboardTab("Attendance");
                            toggleSidebar(false);
                          }}
                        >
                          <MaterialCommunityIcons
                            name="calendar-check"
                            size={20}
                            color={
                              staffDashboardTab === "Attendance"
                                ? "#0A84FF"
                                : "#8E8E93"
                            }
                          />
                          <Text
                            style={[
                              styles.sidebarMenuText,
                              staffDashboardTab === "Attendance" && {
                                color: "#0A84FF",
                                fontWeight: "bold",
                              },
                            ]}
                          >
                            Absensi Staff
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.sidebarMenuItem,
                            staffDashboardTab === "Bonus" &&
                              styles.sidebarMenuItemActive,
                          ]}
                          onPress={() => {
                            setStaffDashboardTab("Bonus");
                            toggleSidebar(false);
                          }}
                        >
                          <MaterialCommunityIcons
                            name="cash-multiple"
                            size={20}
                            color={
                              staffDashboardTab === "Bonus"
                                ? "#0A84FF"
                                : "#8E8E93"
                            }
                          />
                          <Text
                            style={[
                              styles.sidebarMenuText,
                              staffDashboardTab === "Bonus" && {
                                color: "#0A84FF",
                                fontWeight: "bold",
                              },
                            ]}
                          >
                            Perhitungan Komisi
                          </Text>
                        </TouchableOpacity>

                        <View style={{ flex: 1 }} />

                        <TouchableOpacity
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 15,
                            borderTopWidth: 1,
                            borderColor: "#2C2C2E",
                          }}
                          onPress={() => {
                            toggleSidebar(false);
                          }}
                        >
                          <MaterialCommunityIcons
                            name="arrow-left"
                            size={20}
                            color="#FF453A"
                          />
                          <Text
                            style={{
                              color: "#FF453A",
                              fontSize: 14,
                              fontWeight: "bold",
                              marginLeft: 15,
                            }}
                          >
                            Kembali
                          </Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    </Animated.View>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

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
                    style={{ flexDirection: "row", gap: 8, marginBottom: 15 }}
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
                      placeholder="Nama Tambahan"
                      placeholderTextColor="#8E8E93"
                      value={addon.name}
                      onChangeText={(text) =>
                        handleUpdateAddOn(index, "name", text)
                      }
                    />
                    <TextInput
                      style={{
                        flex: 1,
                        backgroundColor: "#121212",
                        color: "#FFF",
                        padding: 12,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: "#2C2C2E",
                      }}
                      placeholder="Harga"
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
                        paddingHorizontal: 5,
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
  sidebarMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  sidebarMenuItemActive: {
    backgroundColor: "rgba(10, 132, 255, 0.1)",
  },
  sidebarMenuText: {
    color: "#FFF",
    fontSize: 14,
    marginLeft: 15,
  },

  // ATTENDANCE TABLE STYLES
  attendanceContainer: {
    flex: 1,
    padding: 20,
  },
  dateRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 10,
  },
  datePickerBox: {
    flex: 1,
    backgroundColor: "#1C1C1E",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  dateLabel: {
    color: "#8E8E93",
    fontSize: 10,
    fontWeight: "bold",
  },
  dateValue: {
    color: "#FFF",
    fontSize: 14,
    marginTop: 4,
  },
  dateDivider: {
    color: "#8E8E93",
    fontWeight: "bold",
  },
  tableContainer: {
    flex: 1,
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2C2C2E",
    overflow: "hidden",
  },
  tableHeaderRow: {
    flexDirection: "row",
    padding: 15,
    borderBottomWidth: 1,
    borderColor: "#2C2C2E",
    backgroundColor: "#121212",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderColor: "#2C2C2E",
  },
  tableHeaderText: {
    color: "#8E8E93",
    fontWeight: "bold",
    fontSize: 12,
  },
  tableCellText: {
    color: "#FFF",
    fontWeight: "bold",
  },

  // Table Column Widths
  colName: { width: 140 },
  colDate: { width: 100 },
  colTime: { width: 80 },
  colStatus: { width: 220 },

  statusContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
  },
  statusBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusText: {
    fontSize: 12,
  },
});
