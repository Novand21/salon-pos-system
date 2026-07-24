import { useFocusEffect } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
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
    desc: string;
    type: "start" | "end";
    existingStart: string;
    existingEnd: string;
  } | null>(null);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);

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

  // payroll for staff and bonuses
  const [selectedPayrollStaff, setSelectedPayrollStaff] = useState<any>(null);
  const [payrollStartDate, setPayrollStartDate] = useState<Date>(new Date());
  const [payrollEndDate, setPayrollEndDate] = useState<Date>(new Date());
  const [activePayrollPicker, setActivePayrollPicker] = useState<
    "start" | "end" | null
  >(null);
  const [payrollSortMode, setPayrollSortMode] = useState<"desc" | "asc">(
    "desc",
  );
  const [payrollTransactions, setPayrollTransactions] = useState<any[]>([]);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [attendanceStats, setAttendanceStats] = useState({
    extraMins: 0,
    penaltyMins: 0,
  });

  // for staff bonuses
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [customBonusAmount, setCustomBonusAmount] = useState("");
  const [menuBonuses, setMenuBonuses] = useState<{
    [key: string]: { method: "percent" | "nominal"; value: string };
  }>({});
  const [selectedBonusItem, setSelectedBonusItem] = useState<{
    key: string;
    name: string;
    quantity: number;
    finalValue: number;
    txId?: number;
    cartId?: string;
  } | null>(null);
  const [bonusMethod, setBonusMethod] = useState<"percent" | "nominal">(
    "percent",
  );
  const [bonusValueInput, setBonusValueInput] = useState("");
  const [menuBonusesTotal, setMenuBonusesTotal] = useState(0);
  const [currentManualBonusId, setCurrentManualBonusId] = useState<
    number | null
  >(null);
  const [manualBonuses, setManualBonuses] = useState(0);

  // base salary states
  const [showBaseSalaryModal, setShowBaseSalaryModal] = useState(false);
  const [baseSalaryInput, setBaseSalaryInput] = useState("");
  const [baseSalary, setBaseSalary] = useState(0);

  const [totalKasbon, setTotalKasbon] = useState(0);
  const [totalUangMakan, setTotalUangMakan] = useState(0);
  const [totalPenjualan, setTotalPenjualan] = useState(0);
  const [linkedExpensesTotal, setLinkedExpensesTotal] = useState(0);

  const [payrollSubTab, setPayrollSubTab] = useState<
    "Bonus" | "Penjualan" | "Kasbon" | "Uang Makan" | "Lainnya"
  >("Bonus");
  const [staffOtherTransactions, setStaffOtherTransactions] = useState<any[]>(
    [],
  );

  // --- BOTTOM BAR ANIMATION STATES ---
  const [isPayrollExpanded, setIsPayrollExpanded] = useState(false);

  // We start the height at 0 (hidden)
  const payrollDetailsHeight = useRef(new Animated.Value(0)).current;

  const togglePayrollBar = (expand: boolean) => {
    setIsPayrollExpanded(expand);
    Animated.timing(payrollDetailsHeight, {
      toValue: expand ? 200 : 0,
      duration: 300, // 300ms is a pretty smooth
      useNativeDriver: false,
    }).start();
  };

  const payrollPanResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false, // Let TouchableOpacity handle normal taps
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > 5, // Instantly capture the gesture if the user swipes
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 15) {
            togglePayrollBar(false); // Swipe Down -> Collapse
          } else if (gestureState.dy < -15) {
            togglePayrollBar(true); // Swipe Up -> Expand
          }
        },
      }),
    [isPayrollExpanded],
  );

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
      const timeStr = selectedTime.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const newStart =
        activeTimePicker.type === "start"
          ? timeStr
          : activeTimePicker.existingStart;
      const newEnd =
        activeTimePicker.type === "end"
          ? timeStr
          : activeTimePicker.existingEnd;

      markAttendance(
        activeTimePicker.staffId,
        activeTimePicker.dateStr,
        "Hadir",
        newStart,
        newEnd,
        activeTimePicker.desc,
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
            startTime: record && record.start_time ? record.start_time : "-",
            endTime: record && record.end_time ? record.end_time : "-",
            status: record ? record.status : null,
            description: record ? record.description || "" : "",
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
    (
      employeeId: number,
      dateStr: string,
      status: string,
      startTime: string,
      endTime: string,
      desc: string,
    ) => {
      try {
        const existing: any = db.getFirstSync(
          "SELECT id FROM Attendance WHERE employee_id = ? AND date = ?",
          [employeeId, dateStr],
        );

        const finalStartTime = status === "Hadir" ? startTime : "-";
        const finalEndTime = status === "Hadir" ? endTime : "-";

        if (existing) {
          db.runSync(
            "UPDATE Attendance SET status = ?, start_time = ?, end_time = ?, description = ? WHERE id = ?",
            [status, finalStartTime, finalEndTime, desc, existing.id],
          );
        } else {
          db.runSync(
            "INSERT INTO Attendance (employee_id, date, start_time, end_time, status, description) VALUES (?, ?, ?, ?, ?, ?)",
            [employeeId, dateStr, finalStartTime, finalEndTime, status, desc],
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
    Alert.alert("Konfirmasi Hapus", `Apakah yakin ingin menghapus`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: () => {
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
        },
      },
    ]);
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

  const handlePayrollDateChange = (event: any, date?: Date) => {
    if (Platform.OS === "android") setActivePayrollPicker(null);
    if (date) {
      if (activePayrollPicker === "start") {
        setPayrollStartDate(date);
        if (date > payrollEndDate) setPayrollEndDate(date);
      } else if (activePayrollPicker === "end") {
        setPayrollEndDate(date);
        if (date < payrollStartDate) setPayrollStartDate(date);
      }
    }
  };

  const loadPayrollData = useCallback(() => {
    if (!selectedPayrollStaff) return;

    const startOfDay = new Date(payrollStartDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(payrollEndDate);
    endOfDay.setHours(23, 59, 59, 999);

    try {
      const rawTx = db.getAllSync(
        "SELECT * FROM Transactions WHERE timestamp >= ? AND timestamp <= ? AND status = 'completed'",
        [startOfDay.toISOString(), endOfDay.toISOString()],
      );

      const staffTxs: any[] = [];

      rawTx.forEach((tx: any) => {
        const cart = JSON.parse(tx.cart_json || "[]");

        // Filter the cart to find only items this specific staff member worked on
        const staffItems = cart.filter(
          (item: any) =>
            item.stylists && item.stylists.includes(selectedPayrollStaff.name),
        );

        if (staffItems.length > 0) {
          const txDate = new Date(tx.timestamp);
          staffTxs.push({
            id: tx.id,
            queue_number: tx.queue_number,
            trx_code: tx.trx_code,
            timestamp: tx.timestamp,
            dateStr: txDate.toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
            time: txDate.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }),
            staffItems: staffItems,
            parsedCart: cart,
            amount: tx.total_amount,
            paymentMethod: tx.payment_method,
            amountTendered: tx.amount_tendered || tx.total_amount,
            changeAmount: tx.change_amount || 0,
            stylist:
              staffList.find((s) => s.id === tx.employee_id)?.name || "Unknown",
          });
        }
      });

      setPayrollTransactions(staffTxs);

      // --- ATTENDANCE EARLY/LATE CALCULATION ---
      const formatDate = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      // Fetch standard operational hours
      const settings: any = db.getFirstSync(
        "SELECT open_time, close_time FROM Settings WHERE id = 1",
      ) || { open_time: "09:00", close_time: "20:00" };

      const attRecords = db.getAllSync(
        "SELECT * FROM Attendance WHERE employee_id = ? AND date >= ? AND date <= ? AND status = 'Hadir'",
        [
          selectedPayrollStaff.id,
          formatDate(payrollStartDate),
          formatDate(payrollEndDate),
        ],
      );

      const parseTime = (tStr: string) => {
        if (!tStr || tStr === "-") return null;
        const [h, m] = tStr.split(":");
        return parseInt(h, 10) * 60 + parseInt(m, 10);
      };

      const openMins = parseTime(settings.open_time);
      const closeMins = parseTime(settings.close_time);

      let totalExtraMins = 0;
      let totalPenaltyMins = 0;

      attRecords.forEach((rec: any) => {
        const sMins = parseTime(rec.start_time);
        const eMins = parseTime(rec.end_time);

        if (sMins !== null && openMins !== null) {
          if (sMins < openMins) totalExtraMins += openMins - sMins;
          if (sMins > openMins) totalPenaltyMins += sMins - openMins;
        }
        if (eMins !== null && closeMins !== null) {
          if (eMins > closeMins) totalExtraMins += eMins - closeMins;
          if (eMins < closeMins) totalPenaltyMins += closeMins - eMins;
        }
      });

      setAttendanceStats({
        extraMins: totalExtraMins,
        penaltyMins: totalPenaltyMins,
      });

      // Fetch MENU BONUSES (Linked to Transactions in the Date Range)
      const dbMenuBonuses = db.getAllSync(
        `SELECT sb.* FROM Staff_Bonuses sb
         JOIN Transactions t ON sb.transaction_id = t.id
         WHERE sb.employee_id = ? AND sb.transaction_id IS NOT NULL 
         AND t.timestamp >= ? AND t.timestamp <= ?`,
        [
          selectedPayrollStaff.id,
          startOfDay.toISOString(),
          endOfDay.toISOString(),
        ],
      );

      const loadedBonuses: any = {};
      let sumMenu = 0;
      dbMenuBonuses.forEach((b: any) => {
        const itemKey = `${b.transaction_id}-${b.cart_id}`;
        // Store method/value for UI rendering
        loadedBonuses[itemKey] = { method: b.method, value: b.value };
        sumMenu += b.amount;
      });
      setMenuBonuses(loadedBonuses);
      setMenuBonusesTotal(sumMenu);

      // Fetch EKSTRA / TELAT Manual Bonuses (Single value for the period)
      const dbManual: any = db.getFirstSync(
        "SELECT id, amount FROM Staff_Bonuses WHERE employee_id = ? AND transaction_id IS NULL AND method IS NULL AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC LIMIT 1",
        [
          selectedPayrollStaff.id,
          startOfDay.toISOString(),
          endOfDay.toISOString(),
        ],
      );
      setManualBonuses(dbManual?.amount || 0);
      setCurrentManualBonusId(dbManual?.id || null);

      // Fetch KASBON
      const dbKasbon: any = db.getFirstSync(
        "SELECT SUM(amount) as total FROM Staff_Bonuses WHERE employee_id = ? AND transaction_id IS NULL AND method = 'Kasbon' AND timestamp >= ? AND timestamp <= ?",
        [
          selectedPayrollStaff.id,
          startOfDay.toISOString(),
          endOfDay.toISOString(),
        ],
      );
      setTotalKasbon(dbKasbon?.total || 0);

      // Fetch UANG MAKAN
      const dbUangMakan: any = db.getFirstSync(
        "SELECT SUM(amount) as total FROM Staff_Bonuses WHERE employee_id = ? AND transaction_id IS NULL AND method = 'Uang Makan' AND timestamp >= ? AND timestamp <= ?",
        [
          selectedPayrollStaff.id,
          startOfDay.toISOString(),
          endOfDay.toISOString(),
        ],
      );
      setTotalUangMakan(dbUangMakan?.total || 0);

      const dbPenjualan: any = db.getFirstSync(
        "SELECT SUM(amount) as total FROM Staff_Bonuses WHERE employee_id = ? AND transaction_id IS NULL AND method = 'Penjualan' AND timestamp >= ? AND timestamp <= ?",
        [
          selectedPayrollStaff.id,
          startOfDay.toISOString(),
          endOfDay.toISOString(),
        ],
      );
      setTotalPenjualan(dbPenjualan?.total || 0);

      // Fetch LINKED RECAP EXPENSES
      const dbLinkedExpenses: any = db.getFirstSync(
        "SELECT SUM(amount) as total FROM Staff_Bonuses WHERE employee_id = ? AND transaction_id IS NULL AND method IS NOT NULL AND method != 'Kasbon' AND method != 'Uang Makan' AND method != 'Penjualan' AND timestamp >= ? AND timestamp <= ?",
        [
          selectedPayrollStaff.id,
          startOfDay.toISOString(),
          endOfDay.toISOString(),
        ],
      );
      setLinkedExpensesTotal(dbLinkedExpenses?.total || 0);

      // This fetches Kasbon, Uang Makan, Beli Bahan, and Ekstra/Telat for this specific staff
      const dbOtherTx = db.getAllSync(
        "SELECT * FROM Staff_Bonuses WHERE employee_id = ? AND transaction_id IS NULL AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC",
        [
          selectedPayrollStaff.id,
          startOfDay.toISOString(),
          endOfDay.toISOString(),
        ],
      );

      const formattedOther = dbOtherTx.map((b: any) => {
        const txDate = new Date(b.timestamp);
        return {
          id: `other-${b.id}`,
          type: "expense",
          title: b.method || "Manual (Ekstra / Telat)",
          dateStr: txDate.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
          time: txDate.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }),
          amount: b.amount,
          details: b.description,
          timestamp: b.timestamp,
        };
      });
      setStaffOtherTransactions(formattedOther);

      // Fetch base salary
      setBaseSalary(selectedPayrollStaff.base_salary || 0);
    } catch (e) {
      console.error("Error loading payroll tx:", e);
    }
  }, [payrollStartDate, payrollEndDate, selectedPayrollStaff, staffList]);

  React.useEffect(() => {
    loadPayrollData();
  }, [loadPayrollData, staffDashboardTab]);

  const sortedPayrollTransactions = [...payrollTransactions].sort((a, b) => {
    return payrollSortMode === "desc"
      ? new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      : new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  const sortedOtherTransactions = [...staffOtherTransactions].sort((a, b) => {
    return payrollSortMode === "desc"
      ? new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      : new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

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

  // GRAND TOTAL CALCULATION
  const grandTotalGaji =
    baseSalary +
    menuBonusesTotal +
    manualBonuses +
    totalKasbon +
    linkedExpensesTotal +
    totalUangMakan +
    totalPenjualan;

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
          } else if (selectedPayrollStaff) {
            setSelectedPayrollStaff(null);
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
                  {staffDashboardTab === "Bonus" && "Gaji & Bonus"}
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

                    {/* FOR RESETTING THE DATES TO TODAY */}
                    <TouchableOpacity
                      onPress={() => {
                        setAttStartDate(new Date());
                        setAttEndDate(new Date());
                      }}
                      style={{
                        backgroundColor: "#1C1C1E",
                        padding: 12,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: "#2C2C2E",
                        alignItems: "center",
                        paddingHorizontal: 15,
                        alignSelf: "flex-end",
                      }}
                    >
                      <MaterialCommunityIcons
                        name="restore"
                        size={22}
                        color="white"
                      />
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
                            style={[styles.tableHeaderText, styles.colTime]}
                          >
                            KELUAR
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
                          extraData={attendanceData}
                          keyExtractor={(row) => `${row.staffId}-${row.date}`}
                          showsVerticalScrollIndicator={true}
                          initialNumToRender={15}
                          maxToRenderPerBatch={20}
                          windowSize={5}
                          renderItem={({ item: row }) => (
                            <View
                              style={{
                                borderBottomWidth: 1,
                                borderColor: "#2C2C2E",
                              }}
                            >
                              {/* Standard Columns */}
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  padding: 15,
                                }}
                              >
                                {/* Name */}
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

                                {/* Date */}
                                <Text
                                  style={[
                                    styles.tableCellText,
                                    styles.colDate,
                                    { color: "#8E8E93", fontWeight: "normal" },
                                  ]}
                                >
                                  {row.displayDate}
                                </Text>

                                {/* Time Picker MULAI */}
                                <View style={styles.colTime}>
                                  <TouchableOpacity
                                    style={{
                                      width: 55,
                                      backgroundColor: "#121212",
                                      padding: 5,
                                      borderRadius: 4,
                                      alignItems: "center",
                                    }}
                                    onPress={() => {
                                      let initDate = new Date();
                                      if (
                                        row.startTime &&
                                        row.startTime !== "-"
                                      ) {
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
                                        desc: row.description || "",
                                        type: "start",
                                        existingStart: row.startTime,
                                        existingEnd: row.endTime,
                                      });
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color:
                                          row.startTime === "-"
                                            ? "#555"
                                            : "#FFF",
                                        fontWeight: "bold",
                                      }}
                                    >
                                      {row.startTime === "-"
                                        ? "09:00"
                                        : row.startTime}
                                    </Text>
                                  </TouchableOpacity>
                                </View>

                                {/* Time Picker KELUAR */}
                                <View style={styles.colTime}>
                                  <TouchableOpacity
                                    style={{
                                      width: 55,
                                      backgroundColor: "#121212",
                                      padding: 5,
                                      borderRadius: 4,
                                      alignItems: "center",
                                    }}
                                    onPress={() => {
                                      let initDate = new Date();
                                      if (row.endTime && row.endTime !== "-") {
                                        const [hours, minutes] =
                                          row.endTime.split(":");
                                        initDate.setHours(
                                          parseInt(hours, 10),
                                          parseInt(minutes, 10),
                                          0,
                                          0,
                                        );
                                      } else {
                                        initDate.setHours(17, 0, 0, 0); // Suggests 5:00 PM for checkout
                                      }
                                      setActiveTimePicker({
                                        staffId: row.staffId,
                                        dateStr: row.date,
                                        currentDate: initDate,
                                        desc: row.description || "",
                                        type: "end",
                                        existingStart: row.startTime,
                                        existingEnd: row.endTime,
                                      });
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color:
                                          row.endTime === "-" ? "#555" : "#FFF",
                                        fontWeight: "bold",
                                      }}
                                    >
                                      {row.endTime === "-"
                                        ? "17:00"
                                        : row.endTime}
                                    </Text>
                                  </TouchableOpacity>
                                </View>

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
                                        let endTimeToSave = row.endTime || "-";
                                        if (
                                          st === "Hadir" &&
                                          (timeToSave === "-" || !timeToSave)
                                        ) {
                                          timeToSave =
                                            new Date().toLocaleTimeString(
                                              "en-GB",
                                              {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                                hour12: false,
                                              },
                                            );
                                        }

                                        setAttendanceData((prevData) =>
                                          prevData.map((item) =>
                                            item.staffId === row.staffId &&
                                            item.date === row.date
                                              ? {
                                                  ...item,
                                                  status: st,
                                                  startTime: timeToSave,
                                                  endTime: endTimeToSave,
                                                }
                                              : item,
                                          ),
                                        );

                                        markAttendance(
                                          row.staffId,
                                          row.date,
                                          st,
                                          timeToSave,
                                          endTimeToSave,
                                          row.description || "",
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

                              {/* Description Input */}
                              <View
                                style={{
                                  paddingHorizontal: 15,
                                  paddingBottom: 15,
                                }}
                              >
                                <TextInput
                                  style={{
                                    backgroundColor: "#121212",
                                    color: "#FFF",
                                    padding: 10,
                                    borderRadius: 8,
                                    borderWidth: 1,
                                    borderColor: "#2C2C2E",
                                    fontSize: 12,
                                  }}
                                  placeholder="Keterangan (opsional)..."
                                  placeholderTextColor="#8E8E93"
                                  value={row.description}
                                  onChangeText={(text) => {
                                    setAttendanceData((prevData) =>
                                      prevData.map((item) =>
                                        item.staffId === row.staffId &&
                                        item.date === row.date
                                          ? { ...item, description: text }
                                          : item,
                                      ),
                                    );
                                  }}
                                  onEndEditing={(e) => {
                                    markAttendance(
                                      row.staffId,
                                      row.date,
                                      row.status || "Hadir",
                                      row.startTime || "-",
                                      row.endTime || "-",
                                      e.nativeEvent.text,
                                    );
                                  }}
                                />
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
                <View style={{ flex: 1 }}>
                  {/* Staff Selection List */}
                  {!selectedPayrollStaff ? (
                    <FlatList
                      contentContainerStyle={styles.listContainer}
                      data={staffList}
                      keyExtractor={(staff) => `payroll-${staff.id}`}
                      initialNumToRender={15}
                      ListHeaderComponent={
                        <Text
                          style={{
                            color: "#8E8E93",
                            fontSize: 12,
                            fontWeight: "bold",
                            marginBottom: 15,
                          }}
                        >
                          PILIH STAFF UNTUK PERHITUNGAN GAJI
                        </Text>
                      }
                      renderItem={({ item: staff }) => (
                        <TouchableOpacity
                          style={styles.listItem}
                          onPress={() => setSelectedPayrollStaff(staff)}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                            }}
                          >
                            <MaterialCommunityIcons
                              name="account-circle"
                              size={40}
                              color="#8E8E93"
                              style={{ marginRight: 15 }}
                            />
                            <View>
                              <Text style={styles.itemTitle}>{staff.name}</Text>
                              <Text style={styles.itemSubtitle}>
                                Posisi: {staff.role}
                              </Text>
                            </View>
                          </View>
                          <MaterialCommunityIcons
                            name="chevron-right"
                            size={24}
                            color="#8E8E93"
                          />
                        </TouchableOpacity>
                      )}
                    />
                  ) : (
                    <View style={{ flex: 1 }}>
                      {/* Detailed View Header */}
                      <View
                        style={{
                          padding: 15,
                          borderBottomWidth: 1,
                          borderColor: "#2C2C2E",
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 12,
                          }}
                        >
                          {/* Inline Back Button & Staff Name */}
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <TouchableOpacity
                              onPress={() => setSelectedPayrollStaff(null)}
                            >
                              <MaterialCommunityIcons
                                name="arrow-left"
                                size={22}
                                color="#0A84FF"
                              />
                            </TouchableOpacity>
                            <Text
                              style={{
                                color: "#FFF",
                                fontSize: 16,
                                fontWeight: "bold",
                              }}
                            >
                              {selectedPayrollStaff.name}
                            </Text>
                          </View>

                          <View
                            style={{
                              flexDirection: "row",
                              gap: 6,
                              flexWrap: "wrap",
                              justifyContent: "flex-end",
                            }}
                          >
                            <TouchableOpacity
                              style={[
                                styles.bonusStatBtn,
                                {
                                  backgroundColor:
                                    attendanceStats.extraMins > 0
                                      ? "rgba(52, 199, 89, 0.1)"
                                      : "#1C1C1E",
                                  borderColor:
                                    attendanceStats.extraMins > 0
                                      ? "#34C759"
                                      : "#2C2C2E",
                                  paddingHorizontal: 8,
                                  paddingVertical: 6, // Resized
                                },
                              ]}
                              onPress={() => {
                                setCustomBonusAmount(
                                  manualBonuses !== 0
                                    ? manualBonuses.toString()
                                    : "",
                                );
                                setShowBonusModal(true);
                              }}
                            >
                              <Text
                                style={{
                                  color: "#8E8E93",
                                  fontSize: 9,
                                  fontWeight: "bold",
                                }}
                              >
                                EKSTRA / TELAT
                              </Text>
                              <Text
                                style={{
                                  color: "#34C759",
                                  fontSize: 11,
                                  fontWeight: "bold",
                                }}
                              >
                                +{Math.floor(attendanceStats.extraMins / 60)}j{" "}
                                {attendanceStats.extraMins % 60}m
                                <Text style={{ color: "#FF453A" }}>
                                  {" "}
                                  / -
                                  {Math.floor(attendanceStats.penaltyMins / 60)}
                                  j {attendanceStats.penaltyMins % 60}m
                                </Text>
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={{
                                backgroundColor: "#2C2C2E",
                                paddingVertical: 6,
                                paddingHorizontal: 10,
                                borderRadius: 6,
                                justifyContent: "center",
                              }}
                              onPress={() => {
                                setBaseSalaryInput(baseSalary.toString());
                                setShowBaseSalaryModal(true);
                              }}
                            >
                              <Text
                                style={{
                                  color: "#FFF",
                                  fontWeight: "bold",
                                  fontSize: 11,
                                }}
                              >
                                + Gaji Dasar
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Compact Date Range Selectors */}
                        <View
                          style={[styles.dateRangeRow, { marginBottom: 0 }]}
                        >
                          <TouchableOpacity
                            onPress={() => setActivePayrollPicker("start")}
                            style={[styles.datePickerBox, { padding: 8 }]}
                          >
                            <Text style={styles.dateLabel}>DARI</Text>
                            <Text
                              style={[
                                styles.dateValue,
                                { fontSize: 12, marginTop: 2 },
                              ]}
                            >
                              {payrollStartDate.toLocaleDateString("id-ID")}
                            </Text>
                          </TouchableOpacity>

                          <Text style={styles.dateDivider}>-</Text>

                          <TouchableOpacity
                            onPress={() => setActivePayrollPicker("end")}
                            style={[styles.datePickerBox, { padding: 8 }]}
                          >
                            <Text style={styles.dateLabel}>SAMPAI</Text>
                            <Text
                              style={[
                                styles.dateValue,
                                { fontSize: 12, marginTop: 2 },
                              ]}
                            >
                              {payrollEndDate.toLocaleDateString("id-ID")}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => {
                              setPayrollStartDate(new Date());
                              setPayrollEndDate(new Date());
                            }}
                            style={{
                              backgroundColor: "#1C1C1E",
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: "#2C2C2E",
                              alignItems: "center",
                              justifyContent: "center",
                              paddingHorizontal: 12,
                              alignSelf: "stretch",
                            }}
                          >
                            <MaterialCommunityIcons
                              name="restore"
                              size={20}
                              color="white"
                            />
                          </TouchableOpacity>
                        </View>

                        {/* SUB-TABS */}
                        <View style={{ paddingTop: 15 }}>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: 8, paddingRight: 20 }}
                          >
                            {[
                              "Bonus",
                              "Penjualan",
                              "Kasbon",
                              "Uang Makan",
                              "Lainnya",
                            ].map((tab) => (
                              <TouchableOpacity
                                key={tab}
                                style={{
                                  paddingVertical: 6,
                                  paddingHorizontal: 12,
                                  alignItems: "center",
                                  borderRadius: 12,
                                  backgroundColor:
                                    payrollSubTab === tab
                                      ? "#0A84FF"
                                      : "#1C1C1E",
                                  borderWidth: 1,
                                  borderColor:
                                    payrollSubTab === tab
                                      ? "#0A84FF"
                                      : "#2C2C2E",
                                }}
                                onPress={() => setPayrollSubTab(tab as any)}
                              >
                                <Text
                                  style={{
                                    color:
                                      payrollSubTab === tab
                                        ? "#FFF"
                                        : "#8E8E93",
                                    fontSize: 11,
                                    fontWeight: "bold",
                                  }}
                                >
                                  {tab === "Bonus" ? "Riwayat Pekerjaan" : tab}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      </View>

                      {/* Native Pickers */}
                      {activePayrollPicker && (
                        <DateTimePicker
                          value={
                            activePayrollPicker === "start"
                              ? payrollStartDate
                              : payrollEndDate
                          }
                          mode="date"
                          display="default"
                          onChange={handlePayrollDateChange}
                        />
                      )}

                      {/* Filtered Transactions List */}
                      {/* TAB RIWAYAT PEKERJAAN (BONUS) */}
                      {payrollSubTab === "Bonus" && (
                        <FlatList
                          contentContainerStyle={styles.listContainer}
                          data={sortedPayrollTransactions}
                          keyExtractor={(tx) => `ptrx-${tx.id}`}
                          ListHeaderComponent={
                            <View style={{ marginBottom: 15 }}>
                              <Text
                                style={{
                                  color: "#8E8E93",
                                  fontSize: 12,
                                  fontWeight: "bold",
                                  marginBottom: 10,
                                }}
                              >
                                Bonus
                              </Text>
                              <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={{ flexDirection: "row" }}
                              >
                                {[
                                  { id: "desc", label: "↓ Terbaru" },
                                  { id: "asc", label: "↑ Terlama" },
                                ].map((sort) => (
                                  <TouchableOpacity
                                    key={sort.id}
                                    onPress={() =>
                                      setPayrollSortMode(sort.id as any)
                                    }
                                    style={{
                                      paddingHorizontal: 12,
                                      paddingVertical: 6,
                                      borderRadius: 15,
                                      marginRight: 8,
                                      borderWidth: 1,
                                      borderColor:
                                        payrollSortMode === sort.id
                                          ? "#0A84FF"
                                          : "#2C2C2E",
                                      backgroundColor:
                                        payrollSortMode === sort.id
                                          ? "rgba(10,132,255,0.2)"
                                          : "#1C1C1E",
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color:
                                          payrollSortMode === sort.id
                                            ? "#0A84FF"
                                            : "#8E8E93",
                                        fontSize: 12,
                                        fontWeight: "bold",
                                      }}
                                    >
                                      {sort.label}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </View>
                          }
                          ListEmptyComponent={
                            <Text
                              style={{
                                color: "#8E8E93",
                                textAlign: "center",
                                marginTop: 20,
                              }}
                            >
                              Belum ada pekerjaan di rentang tanggal ini.
                            </Text>
                          }
                          renderItem={({ item: tx }) => (
                            <View style={styles.listItem}>
                              <View style={{ flex: 1 }}>
                                <TouchableOpacity
                                  onPress={() => setSelectedTx(tx)}
                                >
                                  <Text style={styles.itemTitle}>
                                    {tx.trx_code}
                                  </Text>
                                  <Text style={styles.itemSubtitle}>
                                    {tx.dateStr} • Pukul {tx.time}
                                  </Text>
                                </TouchableOpacity>

                                <View
                                  style={{
                                    marginTop: 10,
                                    paddingLeft: 10,
                                    borderLeftWidth: 2,
                                    borderColor: "#2C2C2E",
                                    gap: 5,
                                  }}
                                >
                                  {tx.staffItems.map(
                                    (cartItem: any, idx: number) => {
                                      const addOnsTotal =
                                        cartItem.selectedAddOns?.reduce(
                                          (sum: number, addon: any) =>
                                            sum + addon.price,
                                          0,
                                        ) || 0;
                                      const base = cartItem.price + addOnsTotal;
                                      const discount = Math.round(
                                        base *
                                          cartItem.quantity *
                                          ((cartItem.discountPercent || 0) /
                                            100),
                                      );
                                      const finalValue =
                                        base * cartItem.quantity - discount;
                                      const itemKey = `${tx.id}-${cartItem.cartId || idx}`;
                                      const itemBonusConfig =
                                        menuBonuses[itemKey];
                                      let calculatedBonus = 0;
                                      if (
                                        itemBonusConfig &&
                                        itemBonusConfig.value
                                      ) {
                                        const val =
                                          Number(itemBonusConfig.value) || 0;
                                        calculatedBonus =
                                          itemBonusConfig.method === "percent"
                                            ? Math.round(
                                                finalValue * (val / 100),
                                              )
                                            : val;
                                      }
                                      return (
                                        <View
                                          key={idx}
                                          style={styles.itemBonusRowContainer}
                                        >
                                          <View style={{ flex: 1 }}>
                                            <Text
                                              style={{
                                                color: "#FFF",
                                                fontSize: 13,
                                              }}
                                            >
                                              {cartItem.quantity}x{" "}
                                              {cartItem.name}
                                            </Text>
                                            <Text
                                              style={{
                                                color: "#34C759",
                                                fontSize: 12,
                                                fontWeight: "bold",
                                                marginTop: 2,
                                              }}
                                            >
                                              Nilai Menu: Rp{" "}
                                              {finalValue.toLocaleString(
                                                "id-ID",
                                              )}
                                            </Text>
                                            {calculatedBonus > 0 && (
                                              <Text
                                                style={{
                                                  color: "#FF9F0A",
                                                  fontSize: 12,
                                                  fontWeight: "bold",
                                                  marginTop: 2,
                                                }}
                                              >
                                                Bonus Staff: Rp{" "}
                                                {calculatedBonus.toLocaleString(
                                                  "id-ID",
                                                )}
                                                {itemBonusConfig.method ===
                                                "percent"
                                                  ? ` (${itemBonusConfig.value}%)`
                                                  : ""}
                                              </Text>
                                            )}
                                          </View>
                                          <TouchableOpacity
                                            style={[
                                              styles.addBonusItemBtn,
                                              calculatedBonus > 0 &&
                                                styles.addBonusItemBtnActive,
                                            ]}
                                            onPress={() => {
                                              setSelectedBonusItem({
                                                key: itemKey,
                                                name: cartItem.name,
                                                quantity: cartItem.quantity,
                                                finalValue: finalValue,
                                                txId: tx.id,
                                                cartId: (
                                                  cartItem.cartId || idx
                                                ).toString(),
                                              });
                                              setBonusMethod(
                                                itemBonusConfig?.method ||
                                                  "percent",
                                              );
                                              setBonusValueInput(
                                                itemBonusConfig?.value || "",
                                              );
                                            }}
                                          >
                                            <Text
                                              style={styles.addBonusItemBtnText}
                                            >
                                              {calculatedBonus > 0
                                                ? "Edit Bonus"
                                                : "+ Bonus"}
                                            </Text>
                                          </TouchableOpacity>
                                        </View>
                                      );
                                    },
                                  )}
                                </View>
                              </View>
                            </View>
                          )}
                        />
                      )}

                      {/* TAB PENJUALAN */}
                      {payrollSubTab === "Penjualan" && (
                        <FlatList
                          contentContainerStyle={styles.listContainer}
                          data={sortedOtherTransactions.filter(
                            (tx) => tx.title === "Penjualan",
                          )}
                          keyExtractor={(tx) => tx.id}
                          ListHeaderComponent={
                            <View style={{ marginBottom: 15 }}>
                              <Text
                                style={{
                                  color: "#8E8E93",
                                  fontSize: 12,
                                  fontWeight: "bold",
                                  marginBottom: 10,
                                }}
                              >
                                RIWAYAT PENJUALAN
                              </Text>
                              <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={{ flexDirection: "row" }}
                              >
                                {[
                                  { id: "desc", label: "↓ Terbaru" },
                                  { id: "asc", label: "↑ Terlama" },
                                ].map((sort) => (
                                  <TouchableOpacity
                                    key={sort.id}
                                    onPress={() =>
                                      setPayrollSortMode(sort.id as any)
                                    }
                                    style={{
                                      paddingHorizontal: 12,
                                      paddingVertical: 6,
                                      borderRadius: 15,
                                      marginRight: 8,
                                      borderWidth: 1,
                                      borderColor:
                                        payrollSortMode === sort.id
                                          ? "#0A84FF"
                                          : "#2C2C2E",
                                      backgroundColor:
                                        payrollSortMode === sort.id
                                          ? "rgba(10,132,255,0.2)"
                                          : "#1C1C1E",
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color:
                                          payrollSortMode === sort.id
                                            ? "#0A84FF"
                                            : "#8E8E93",
                                        fontSize: 12,
                                        fontWeight: "bold",
                                      }}
                                    >
                                      {sort.label}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </View>
                          }
                          ListEmptyComponent={
                            <Text
                              style={{
                                color: "#8E8E93",
                                textAlign: "center",
                                marginTop: 20,
                              }}
                            >
                              Belum ada data penjualan.
                            </Text>
                          }
                          renderItem={({ item: tx }) => (
                            <TouchableOpacity
                              onPress={() => setSelectedTx(tx)}
                              style={styles.listItem}
                            >
                              <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={styles.itemTitle}>{tx.title}</Text>
                                <Text style={styles.itemSubtitle}>
                                  {tx.dateStr} • {tx.time}
                                </Text>
                                {tx.details ? (
                                  <Text
                                    style={{
                                      color: "#8E8E93",
                                      fontSize: 12,
                                      marginTop: 4,
                                    }}
                                  >
                                    {tx.details}
                                  </Text>
                                ) : null}
                              </View>
                              <Text
                                style={{
                                  color: tx.amount < 0 ? "#FF453A" : "#34C759",
                                  fontWeight: "bold",
                                  fontSize: 14,
                                }}
                              >
                                {tx.amount < 0 ? "-" : "+"} Rp{" "}
                                {Math.abs(tx.amount).toLocaleString("id-ID")}
                              </Text>
                            </TouchableOpacity>
                          )}
                        />
                      )}

                      {/* --- TAB KASBON --- */}
                      {payrollSubTab === "Kasbon" && (
                        <FlatList
                          contentContainerStyle={styles.listContainer}
                          data={sortedOtherTransactions.filter(
                            (tx) => tx.title === "Kasbon",
                          )}
                          keyExtractor={(tx) => tx.id}
                          ListHeaderComponent={
                            <View style={{ marginBottom: 15 }}>
                              <Text
                                style={{
                                  color: "#8E8E93",
                                  fontSize: 12,
                                  fontWeight: "bold",
                                  marginBottom: 10,
                                }}
                              >
                                RIWAYAT KASBON
                              </Text>
                              <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={{ flexDirection: "row" }}
                              >
                                {[
                                  { id: "desc", label: "↓ Terbaru" },
                                  { id: "asc", label: "↑ Terlama" },
                                ].map((sort) => (
                                  <TouchableOpacity
                                    key={sort.id}
                                    onPress={() =>
                                      setPayrollSortMode(sort.id as any)
                                    }
                                    style={{
                                      paddingHorizontal: 12,
                                      paddingVertical: 6,
                                      borderRadius: 15,
                                      marginRight: 8,
                                      borderWidth: 1,
                                      borderColor:
                                        payrollSortMode === sort.id
                                          ? "#0A84FF"
                                          : "#2C2C2E",
                                      backgroundColor:
                                        payrollSortMode === sort.id
                                          ? "rgba(10,132,255,0.2)"
                                          : "#1C1C1E",
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color:
                                          payrollSortMode === sort.id
                                            ? "#0A84FF"
                                            : "#8E8E93",
                                        fontSize: 12,
                                        fontWeight: "bold",
                                      }}
                                    >
                                      {sort.label}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </View>
                          }
                          ListEmptyComponent={
                            <Text
                              style={{
                                color: "#8E8E93",
                                textAlign: "center",
                                marginTop: 20,
                              }}
                            >
                              Belum ada data Kasbon.
                            </Text>
                          }
                          renderItem={({ item: tx }) => (
                            <TouchableOpacity
                              onPress={() => setSelectedTx(tx)}
                              style={styles.listItem}
                            >
                              <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={styles.itemTitle}>{tx.title}</Text>
                                <Text style={styles.itemSubtitle}>
                                  {tx.dateStr} • {tx.time}
                                </Text>
                                {tx.details ? (
                                  <Text
                                    style={{
                                      color: "#8E8E93",
                                      fontSize: 12,
                                      marginTop: 4,
                                    }}
                                  >
                                    {tx.details}
                                  </Text>
                                ) : null}
                              </View>
                              <Text
                                style={{
                                  color: tx.amount < 0 ? "#FF453A" : "#34C759",
                                  fontWeight: "bold",
                                  fontSize: 14,
                                }}
                              >
                                {tx.amount < 0 ? "-" : "+"} Rp{" "}
                                {Math.abs(tx.amount).toLocaleString("id-ID")}
                              </Text>
                            </TouchableOpacity>
                          )}
                        />
                      )}

                      {/* --- TAB UANG MAKAN --- */}
                      {payrollSubTab === "Uang Makan" && (
                        <FlatList
                          contentContainerStyle={styles.listContainer}
                          data={sortedOtherTransactions.filter(
                            (tx) => tx.title === "Uang Makan",
                          )}
                          keyExtractor={(tx) => tx.id}
                          ListHeaderComponent={
                            <View style={{ marginBottom: 15 }}>
                              <Text
                                style={{
                                  color: "#8E8E93",
                                  fontSize: 12,
                                  fontWeight: "bold",
                                  marginBottom: 10,
                                }}
                              >
                                RIWAYAT UANG MAKAN
                              </Text>
                              <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={{ flexDirection: "row" }}
                              >
                                {[
                                  { id: "desc", label: "↓ Terbaru" },
                                  { id: "asc", label: "↑ Terlama" },
                                ].map((sort) => (
                                  <TouchableOpacity
                                    key={sort.id}
                                    onPress={() =>
                                      setPayrollSortMode(sort.id as any)
                                    }
                                    style={{
                                      paddingHorizontal: 12,
                                      paddingVertical: 6,
                                      borderRadius: 15,
                                      marginRight: 8,
                                      borderWidth: 1,
                                      borderColor:
                                        payrollSortMode === sort.id
                                          ? "#0A84FF"
                                          : "#2C2C2E",
                                      backgroundColor:
                                        payrollSortMode === sort.id
                                          ? "rgba(10,132,255,0.2)"
                                          : "#1C1C1E",
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color:
                                          payrollSortMode === sort.id
                                            ? "#0A84FF"
                                            : "#8E8E93",
                                        fontSize: 12,
                                        fontWeight: "bold",
                                      }}
                                    >
                                      {sort.label}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </View>
                          }
                          ListEmptyComponent={
                            <Text
                              style={{
                                color: "#8E8E93",
                                textAlign: "center",
                                marginTop: 20,
                              }}
                            >
                              Belum ada data Uang Makan.
                            </Text>
                          }
                          renderItem={({ item: tx }) => (
                            <TouchableOpacity
                              onPress={() => setSelectedTx(tx)}
                              style={styles.listItem}
                            >
                              <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={styles.itemTitle}>{tx.title}</Text>
                                <Text style={styles.itemSubtitle}>
                                  {tx.dateStr} • {tx.time}
                                </Text>
                                {tx.details ? (
                                  <Text
                                    style={{
                                      color: "#8E8E93",
                                      fontSize: 12,
                                      marginTop: 4,
                                    }}
                                  >
                                    {tx.details}
                                  </Text>
                                ) : null}
                              </View>
                              <Text
                                style={{
                                  color: tx.amount < 0 ? "#FF453A" : "#34C759",
                                  fontWeight: "bold",
                                  fontSize: 14,
                                }}
                              >
                                {tx.amount < 0 ? "-" : "+"} Rp{" "}
                                {Math.abs(tx.amount).toLocaleString("id-ID")}
                              </Text>
                            </TouchableOpacity>
                          )}
                        />
                      )}

                      {/* TAB LAIN-LAIN */}
                      {payrollSubTab === "Lainnya" && (
                        <FlatList
                          contentContainerStyle={styles.listContainer}
                          data={sortedOtherTransactions.filter(
                            (tx) =>
                              tx.title !== "Penjualan" &&
                              tx.title !== "Kasbon" &&
                              tx.title !== "Uang Makan",
                          )}
                          keyExtractor={(tx) => tx.id}
                          ListHeaderComponent={
                            <View style={{ marginBottom: 15 }}>
                              <Text
                                style={{
                                  color: "#8E8E93",
                                  fontSize: 12,
                                  fontWeight: "bold",
                                  marginBottom: 10,
                                }}
                              >
                                PENGELUARAN & LAINNYA
                              </Text>
                              <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={{ flexDirection: "row" }}
                              >
                                {[
                                  { id: "desc", label: "↓ Terbaru" },
                                  { id: "asc", label: "↑ Terlama" },
                                ].map((sort) => (
                                  <TouchableOpacity
                                    key={sort.id}
                                    onPress={() =>
                                      setPayrollSortMode(sort.id as any)
                                    }
                                    style={{
                                      paddingHorizontal: 12,
                                      paddingVertical: 6,
                                      borderRadius: 15,
                                      marginRight: 8,
                                      borderWidth: 1,
                                      borderColor:
                                        payrollSortMode === sort.id
                                          ? "#0A84FF"
                                          : "#2C2C2E",
                                      backgroundColor:
                                        payrollSortMode === sort.id
                                          ? "rgba(10,132,255,0.2)"
                                          : "#1C1C1E",
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color:
                                          payrollSortMode === sort.id
                                            ? "#0A84FF"
                                            : "#8E8E93",
                                        fontSize: 12,
                                        fontWeight: "bold",
                                      }}
                                    >
                                      {sort.label}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </View>
                          }
                          ListEmptyComponent={
                            <Text
                              style={{
                                color: "#8E8E93",
                                textAlign: "center",
                                marginTop: 20,
                              }}
                            >
                              Belum ada data pengeluaran / kasbon.
                            </Text>
                          }
                          renderItem={({ item: tx }) => (
                            <TouchableOpacity
                              onPress={() => setSelectedTx(tx)}
                              style={styles.listItem}
                            >
                              <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={styles.itemTitle}>{tx.title}</Text>
                                <Text style={styles.itemSubtitle}>
                                  {tx.dateStr} • {tx.time}
                                </Text>
                                {tx.details ? (
                                  <Text
                                    style={{
                                      color: "#8E8E93",
                                      fontSize: 12,
                                      marginTop: 4,
                                    }}
                                  >
                                    {tx.details}
                                  </Text>
                                ) : null}
                              </View>
                              <Text
                                style={{
                                  color: tx.amount < 0 ? "#FF453A" : "#34C759",
                                  fontWeight: "bold",
                                  fontSize: 14,
                                }}
                              >
                                {tx.amount < 0 ? "-" : "+"} Rp{" "}
                                {Math.abs(tx.amount).toLocaleString("id-ID")}
                              </Text>
                            </TouchableOpacity>
                          )}
                        />
                      )}
                      {/* TOTAL GAJI BOTTOM BAR */}
                      <View
                        style={[
                          styles.payrollBottomBar,
                          {
                            padding: 15,
                            paddingBottom: Math.max(insets.bottom || 20, 20),
                          },
                        ]}
                        {...payrollPanResponder.panHandlers}
                      >
                        {/* DRAG HANDLE*/}
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => togglePayrollBar(!isPayrollExpanded)}
                          style={{
                            alignItems: "center",
                            paddingBottom: 15,
                            paddingTop: 5,
                            backgroundColor: "transparent",
                          }}
                        >
                          <View
                            style={{
                              width: 50,
                              height: 6,
                              backgroundColor: "#2C2C2E",
                              borderRadius: 3,
                            }}
                          />
                        </TouchableOpacity>

                        {/* COLLAPSIBLE DETAILS */}
                        <Animated.View
                          style={{
                            height: payrollDetailsHeight,
                            overflow: "hidden",
                          }}
                        >
                          <View
                            style={{
                              paddingBottom: 15,
                              borderBottomWidth: 1,
                              borderColor: "#2C2C2E",
                              marginBottom: 15,
                            }}
                          >
                            <View style={styles.payrollRow}>
                              <Text style={[styles.textGray, { fontSize: 12 }]}>
                                Gaji Dasar:
                              </Text>
                              <Text
                                style={[styles.textWhite, { fontSize: 12 }]}
                              >
                                Rp {baseSalary.toLocaleString("id-ID")}
                              </Text>
                            </View>
                            <View style={styles.payrollRow}>
                              <Text style={[styles.textGray, { fontSize: 12 }]}>
                                Total Bonus Menu:
                              </Text>
                              <Text style={{ color: "#34C759", fontSize: 12 }}>
                                + Rp {menuBonusesTotal.toLocaleString("id-ID")}
                              </Text>
                            </View>
                            <View style={styles.payrollRow}>
                              <Text style={[styles.textGray, { fontSize: 12 }]}>
                                Total Ekstra / Telat:
                              </Text>
                              <Text
                                style={{
                                  color:
                                    manualBonuses < 0 ? "#FF453A" : "#34C759",
                                  fontSize: 12,
                                }}
                              >
                                {manualBonuses < 0 ? "- " : "+ "}Rp{" "}
                                {Math.abs(manualBonuses).toLocaleString(
                                  "id-ID",
                                )}
                              </Text>
                            </View>
                            <View style={styles.payrollRow}>
                              <Text style={[styles.textGray, { fontSize: 12 }]}>
                                Total Kasbon:
                              </Text>
                              <Text
                                style={{
                                  color:
                                    totalKasbon < 0 ? "#FF453A" : "#34C759",
                                  fontSize: 12,
                                }}
                              >
                                {totalKasbon < 0 ? "- " : "+ "}Rp{" "}
                                {Math.abs(totalKasbon).toLocaleString("id-ID")}
                              </Text>
                            </View>
                            <View style={styles.payrollRow}>
                              <Text style={[styles.textGray, { fontSize: 12 }]}>
                                Total Uang Makan:
                              </Text>
                              <Text
                                style={{
                                  color:
                                    totalUangMakan < 0 ? "#FF453A" : "#34C759",
                                  fontSize: 12,
                                }}
                              >
                                {totalUangMakan < 0 ? "- " : "+ "}Rp{" "}
                                {Math.abs(totalUangMakan).toLocaleString(
                                  "id-ID",
                                )}
                              </Text>
                            </View>
                            <View style={styles.payrollRow}>
                              <Text style={[styles.textGray, { fontSize: 12 }]}>
                                Total Penjualan:
                              </Text>
                              <Text
                                style={{
                                  color:
                                    totalPenjualan < 0 ? "#FF453A" : "#34C759",
                                  fontSize: 12,
                                }}
                              >
                                {totalPenjualan < 0 ? "- " : "+ "}Rp{" "}
                                {Math.abs(totalPenjualan).toLocaleString(
                                  "id-ID",
                                )}
                              </Text>
                            </View>
                            <View
                              style={[styles.payrollRow, { marginBottom: 0 }]}
                            >
                              <Text style={[styles.textGray, { fontSize: 12 }]}>
                                Lain-Lain (Dari Recap):
                              </Text>
                              <Text
                                style={{
                                  color:
                                    linkedExpensesTotal < 0
                                      ? "#FF453A"
                                      : "#34C759",
                                  fontSize: 12,
                                }}
                              >
                                {linkedExpensesTotal < 0 ? "- " : "+ "}Rp{" "}
                                {Math.abs(linkedExpensesTotal).toLocaleString(
                                  "id-ID",
                                )}
                              </Text>
                            </View>
                          </View>
                        </Animated.View>

                        {/* ALWAYS VISIBLE TOTAL ROW */}
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => togglePayrollBar(!isPayrollExpanded)}
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <Text
                            style={{
                              color: "#FFF",
                              fontSize: 16,
                              fontWeight: "bold",
                            }}
                          >
                            TOTAL GAJI:
                          </Text>
                          <Text
                            style={{
                              color: "#0A84FF",
                              fontSize: 18,
                              fontWeight: "bold",
                            }}
                          >
                            Rp {grandTotalGaji.toLocaleString("id-ID")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
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
                            Gaji & Bonus
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

                {/* Move TextInput ABOVE the list for better flow */}
                <TextInput
                  style={{
                    backgroundColor: "#121212",
                    color: "#FFF",
                    padding: 15,
                    borderRadius: 8,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: "#2C2C2E",
                  }}
                  placeholder="Ketik kategori baru atau pilih di bawah..."
                  placeholderTextColor="#8E8E93"
                  value={newItemCategory}
                  onChangeText={setNewItemCategory}
                />

                {/* NEW Vertical Category Box */}
                {categories.length > 0 && (
                  <View
                    style={{
                      backgroundColor: "#121212",
                      borderWidth: 1,
                      borderColor: "#2C2C2E",
                      borderRadius: 8,
                      marginBottom: 15,
                      maxHeight: 150,
                      overflow: "hidden",
                    }}
                  >
                    <ScrollView
                      showsVerticalScrollIndicator={true}
                      nestedScrollEnabled={true}
                    >
                      {categories.map((cat, index) => {
                        const isSelected = newItemCategory === cat;
                        return (
                          <TouchableOpacity
                            key={cat}
                            onPress={() => setNewItemCategory(cat)}
                            style={{
                              padding: 15,
                              borderBottomWidth:
                                index === categories.length - 1 ? 0 : 1,
                              borderBottomColor: "#2C2C2E",
                              backgroundColor: isSelected
                                ? "rgba(10,132,255,0.15)"
                                : "transparent",
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <Text
                              style={{
                                color: isSelected ? "#0A84FF" : "#FFF",
                                fontWeight: isSelected ? "bold" : "normal",
                                fontSize: 14,
                              }}
                            >
                              {cat}
                            </Text>
                            {isSelected && (
                              <MaterialCommunityIcons
                                name="check"
                                size={18}
                                color="#0A84FF"
                              />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
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

      {/* RECEIPT PREVIEW MODAL */}
      <Modal
        visible={!!selectedTx}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSelectedTx(null)}
      >
        <View
          style={[
            styles.payrollModalOverlay,
            { paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
        >
          <ScrollView
            style={{ width: "100%", maxHeight: "80%" }}
            contentContainerStyle={{
              alignItems: "center",
              paddingVertical: 10,
            }}
            showsVerticalScrollIndicator={true}
          >
            <View style={styles.receiptPaper}>
              <Text style={styles.receiptTitle}>D'FFOND SALON</Text>
              <Text style={styles.receiptCenter}>Detail Transaksi</Text>

              <Text style={styles.receiptDivider}>
                --------------------------------
              </Text>
              <Text style={styles.receiptLine}>
                Tanggal:{" "}
                {selectedTx
                  ? new Date(selectedTx.timestamp).toLocaleDateString("en-GB")
                  : ""}
              </Text>
              <Text style={styles.receiptLine}>Waktu: {selectedTx?.time}</Text>

              {/* Only show Cashier if it is a transaction */}
              {selectedTx?.type !== "expense" && (
                <Text style={styles.receiptLine}>
                  Cashier: {selectedTx?.stylist}
                </Text>
              )}

              <Text style={styles.receiptDivider}>
                --------------------------------
              </Text>

              {/* DYNAMIC RECEIPT TOGGLE */}
              {selectedTx?.type !== "expense" ? (
                <View>
                  {/* ORIGINAL 'RIWAYAT PEKERJAAN' RENDERER */}
                  {selectedTx?.parsedCart?.map(
                    (cartItem: any, index: number) => {
                      const addOnsTotal =
                        cartItem.selectedAddOns?.reduce(
                          (sum: number, addon: any) => sum + addon.price,
                          0,
                        ) || 0;
                      const basePriceWithAddons = cartItem.price + addOnsTotal;
                      const discountNominal = Math.round(
                        basePriceWithAddons *
                          cartItem.quantity *
                          ((cartItem.discountPercent || 0) / 100),
                      );

                      const isStaffItem =
                        cartItem.stylists &&
                        cartItem.stylists.includes(selectedPayrollStaff.name);

                      return (
                        <View
                          key={index}
                          style={{
                            marginBottom: 12,
                            paddingBottom: 8,
                            borderBottomWidth: 1,
                            borderBottomColor: "#F2F2F7",
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                            }}
                          >
                            <Text
                              style={[
                                styles.receiptLine,
                                {
                                  flex: 1,
                                  fontWeight: "bold",
                                  color: isStaffItem ? "#0A84FF" : "#000",
                                },
                              ]}
                            >
                              {cartItem.name} {isStaffItem ? "★" : ""}
                            </Text>
                          </View>

                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              marginTop: 4,
                            }}
                          >
                            <Text style={styles.receiptLine}>
                              {cartItem.quantity}x Rp{" "}
                              {cartItem.price.toLocaleString("id-ID")}
                            </Text>
                            <Text style={styles.receiptLine}>
                              Rp{" "}
                              {(
                                cartItem.quantity * cartItem.price
                              ).toLocaleString("id-ID")}
                            </Text>
                          </View>

                          {cartItem.stylists &&
                            cartItem.stylists.length > 0 && (
                              <View style={styles.receiptRowWrap}>
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

                          {cartItem.selectedAddOns?.map(
                            (addon: any, idx: number) => {
                              const totalAddonQty =
                                (addon.quantity || 1) * cartItem.quantity;
                              const totalAddonPrice =
                                addon.price * totalAddonQty;
                              return (
                                <View
                                  key={idx}
                                  style={{
                                    flexDirection: "row",
                                    justifyContent: "space-between",
                                    marginVertical: 2,
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: "#555",
                                      fontSize: 12,
                                      flex: 1,
                                    }}
                                  >
                                    + {addon.name}{" "}
                                    {totalAddonQty > 1
                                      ? `(${totalAddonQty}x)`
                                      : ""}
                                  </Text>
                                  <Text style={{ color: "#555", fontSize: 12 }}>
                                    Rp {totalAddonPrice.toLocaleString("id-ID")}
                                  </Text>
                                </View>
                              );
                            },
                          )}

                          {cartItem.discountPercent > 0 && (
                            <View style={styles.receiptRowWrap}>
                              <Text
                                style={[
                                  styles.receiptDiscountLeftWrap,
                                  { paddingLeft: 10 },
                                ]}
                              >
                                Disc {cartItem.discountPercent}%
                              </Text>
                              <Text style={styles.receiptDiscountRight}>
                                -Rp {discountNominal.toLocaleString("id-ID")}
                              </Text>
                            </View>
                          )}

                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "flex-end",
                              marginTop: 2,
                            }}
                          >
                            <Text
                              style={[
                                styles.receiptLine,
                                { fontWeight: "bold" },
                              ]}
                            >
                              Subtotal: Rp{" "}
                              {cartItem.itemTotal.toLocaleString("id-ID")}
                            </Text>
                          </View>
                        </View>
                      );
                    },
                  )}

                  <Text style={styles.receiptDivider}>
                    --------------------------------
                  </Text>

                  <View style={styles.receiptRowWrap}>
                    <Text style={styles.receiptLine}>PEMBAYARAN:</Text>
                    <Text style={styles.receiptLine}>
                      {selectedTx?.paymentMethod}
                    </Text>
                  </View>

                  <View>
                    <View style={[styles.receiptRowWrap, { marginTop: 4 }]}>
                      <Text style={styles.receiptLine}>UANG TUNAI:</Text>
                      <Text style={styles.receiptLine}>
                        Rp {selectedTx?.amountTendered?.toLocaleString("id-ID")}
                      </Text>
                    </View>
                    <View style={[styles.receiptRowWrap, { marginTop: 4 }]}>
                      <Text
                        style={[
                          styles.receiptLine,
                          { fontWeight: "bold", color: "#cf2d18" },
                        ]}
                      >
                        KEMBALIAN:
                      </Text>
                      <Text
                        style={[
                          styles.receiptLine,
                          { fontWeight: "bold", color: "#cf2d18" },
                        ]}
                      >
                        Rp {selectedTx?.changeAmount?.toLocaleString("id-ID")}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.receiptDivider}>
                    --------------------------------
                  </Text>

                  <View style={styles.receiptRowWrap}>
                    <Text
                      style={{
                        color: "#000",
                        fontSize: 14,
                        fontWeight: "bold",
                      }}
                    >
                      TOTAL TRANSAKSI:
                    </Text>
                    <Text
                      style={{
                        color: "#000",
                        fontSize: 14,
                        fontWeight: "bold",
                      }}
                    >
                      Rp {selectedTx?.amount?.toLocaleString("id-ID")}
                    </Text>
                  </View>
                </View>
              ) : (
                <View>
                  <Text
                    style={{
                      color: "#000",
                      fontSize: 14,
                      fontWeight: "bold",
                      textAlign: "center",
                      marginVertical: 10,
                    }}
                  >
                    {selectedTx?.title?.toUpperCase() || "PENGELUARAN"}
                  </Text>
                  <Text style={styles.receiptLine}>{selectedTx?.details}</Text>
                  <Text
                    style={{
                      color: "#000",
                      fontSize: 14,
                      fontWeight: "bold",
                      textAlign: "center",
                      marginVertical: 10,
                    }}
                  >
                    TOTAL: {selectedTx?.amount < 0 ? "- Rp " : "+ Rp "}
                    {Math.abs(selectedTx?.amount || 0).toLocaleString("id-ID")}
                  </Text>
                </View>
              )}

              <Text style={styles.receiptDivider}>
                --------------------------------
              </Text>
            </View>
          </ScrollView>

          <View style={styles.modalActionsCenter}>
            <TouchableOpacity
              onPress={() => setSelectedTx(null)}
              style={styles.closeBtnPill}
            >
              <Text style={styles.textWhiteBold}>Tutup Preview</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* BONUS INPUT MODAL */}
      <Modal
        visible={showBonusModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowBonusModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "center" }}
        >
          <SafeAreaView style={styles.payrollModalOverlay}>
            <View style={styles.bonusModalContainer}>
              <Text style={styles.bonusModalTitle}>Input Bonus Staff</Text>

              <View style={styles.bonusStatsRow}>
                <View style={styles.bonusStatBox}>
                  <Text style={styles.bonusStatLabel}>Total Ekstra</Text>
                  <Text style={[styles.bonusStatValue, { color: "#34C759" }]}>
                    {Math.floor(attendanceStats.extraMins / 60)} Jam{" "}
                    {attendanceStats.extraMins % 60} Min
                  </Text>
                </View>
                <View style={styles.bonusStatBox}>
                  <Text style={styles.bonusStatLabel}>Total Telat</Text>
                  <Text style={[styles.bonusStatValue, { color: "#FF453A" }]}>
                    {Math.floor(attendanceStats.penaltyMins / 60)} Jam{" "}
                    {attendanceStats.penaltyMins % 60} Min
                  </Text>
                </View>
              </View>

              <Text style={styles.bonusInputLabel}>
                NOMINAL BONUS / POTONGAN (Rp)
              </Text>
              <TextInput
                style={styles.bonusInput}
                placeholder="e.g. 50000 (Gunakan - untuk potongan)"
                placeholderTextColor="#8E8E93"
                keyboardType="numbers-and-punctuation"
                value={customBonusAmount}
                onChangeText={(text) => {
                  const cleanText = text
                    .replace(/[^0-9-]/g, "")
                    .replace(/(?!^)-/g, "");
                  setCustomBonusAmount(cleanText);
                }}
              />

              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  style={[styles.closeBtnPill, { flex: 1, borderRadius: 8 }]}
                  onPress={() => setShowBonusModal(false)}
                >
                  <Text style={styles.textWhiteBold}>Batal</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.closeBtnPill,
                    { flex: 1, borderRadius: 8, backgroundColor: "#0A84FF" },
                  ]}
                  onPress={() => {
                    const amount = Number(customBonusAmount);
                    if (!customBonusAmount || isNaN(amount)) {
                      return alert("Masukkan nominal yang valid!");
                    }

                    try {
                      const timestamp = new Date().toISOString();
                      const desc = `Bonus/Potongan Staff (Periode: ${payrollStartDate.toLocaleDateString("id-ID")} - ${payrollEndDate.toLocaleDateString("id-ID")})`;

                      if (currentManualBonusId) {
                        // UPDATE the existing record
                        db.runSync(
                          "UPDATE Staff_Bonuses SET amount = ?, timestamp = ? WHERE id = ?",
                          [amount, timestamp, currentManualBonusId],
                        );
                      } else {
                        // INSERT a brand new record
                        db.runSync(
                          "INSERT INTO Staff_Bonuses (employee_id, timestamp, amount, description) VALUES (?, ?, ?, ?)",
                          [selectedPayrollStaff.id, timestamp, amount, desc],
                        );
                      }

                      alert(
                        `Data Rp ${amount.toLocaleString("id-ID")} berhasil disimpan!`,
                      );
                      setShowBonusModal(false);
                      setCustomBonusAmount("");
                      loadPayrollData();
                    } catch (e) {
                      console.error("Error saving bonus:", e);
                      alert("Gagal menyimpan data ke database.");
                    }
                  }}
                >
                  <Text style={styles.textWhiteBold}>Simpan</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
      {/* BONUS MODAL */}
      <Modal
        visible={!!selectedBonusItem}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSelectedBonusItem(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <SafeAreaView
            style={[
              styles.payrollModalOverlay,
              { flex: 1, justifyContent: "center" },
            ]}
          >
            <View style={styles.bonusModalContainer}>
              <Text style={styles.bonusModalTitle}>Hitung Bonus Menu</Text>

              {/* Item Info Summary */}
              <View style={styles.bonusItemSummaryBox}>
                <Text
                  style={{ color: "#FFF", fontSize: 14, fontWeight: "bold" }}
                >
                  {selectedBonusItem?.quantity}x {selectedBonusItem?.name}
                </Text>
                <Text
                  style={{
                    color: "#34C759",
                    fontSize: 13,
                    fontWeight: "bold",
                    marginTop: 4,
                  }}
                >
                  Nilai Menu: Rp{" "}
                  {selectedBonusItem?.finalValue?.toLocaleString("id-ID")}
                </Text>
              </View>

              {/* Method Selector (Persentase vs Nominal) */}
              <Text style={styles.bonusInputLabel}>METODE PERHITUNGAN</Text>
              <View style={styles.methodSelectorRow}>
                <TouchableOpacity
                  style={[
                    styles.methodBtn,
                    bonusMethod === "percent" && styles.methodBtnActive,
                  ]}
                  onPress={() => setBonusMethod("percent")}
                >
                  <Text
                    style={
                      bonusMethod === "percent"
                        ? styles.textWhiteBold
                        : styles.textGray
                    }
                  >
                    Persentase (%)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.methodBtn,
                    bonusMethod === "nominal" && styles.methodBtnActive,
                  ]}
                  onPress={() => setBonusMethod("nominal")}
                >
                  <Text
                    style={
                      bonusMethod === "nominal"
                        ? styles.textWhiteBold
                        : styles.textGray
                    }
                  >
                    Nominal (Rp)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Value Input Box */}
              <Text style={styles.bonusInputLabel}>
                {bonusMethod === "percent"
                  ? "PERSENTASE BONUS (%)"
                  : "NOMINAL BONUS (Rp)"}
              </Text>
              <TextInput
                style={styles.bonusInput}
                placeholder={
                  bonusMethod === "percent" ? "e.g. 10" : "e.g. 15000"
                }
                placeholderTextColor="#8E8E93"
                keyboardType="numeric"
                value={bonusValueInput}
                onChangeText={(text) => {
                  // Number only filter
                  const cleanText = text.replace(/[^0-9]/g, "");
                  setBonusValueInput(cleanText);
                }}
              />

              {/* Live Preview Result */}
              {selectedBonusItem && bonusValueInput.length > 0 && (
                <View style={styles.liveBonusPreviewBox}>
                  <Text
                    style={{
                      color: "#8E8E93",
                      fontSize: 11,
                      fontWeight: "bold",
                    }}
                  >
                    HASIL BONUS:
                  </Text>
                  <Text
                    style={{
                      color: "#FF9F0A",
                      fontSize: 16,
                      fontWeight: "bold",
                      marginTop: 2,
                    }}
                  >
                    Rp{" "}
                    {(bonusMethod === "percent"
                      ? Math.round(
                          selectedBonusItem.finalValue *
                            ((Number(bonusValueInput) || 0) / 100),
                        )
                      : Number(bonusValueInput) || 0
                    ).toLocaleString("id-ID")}
                  </Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 15 }}>
                <TouchableOpacity
                  style={[styles.closeBtnPill, { flex: 1, borderRadius: 8 }]}
                  onPress={() => setSelectedBonusItem(null)}
                >
                  <Text style={styles.textWhiteBold}>Batal</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.closeBtnPill,
                    { flex: 1, borderRadius: 8, backgroundColor: "#0A84FF" },
                  ]}
                  onPress={() => {
                    if (selectedBonusItem) {
                      const amount =
                        bonusMethod === "percent"
                          ? Math.round(
                              selectedBonusItem.finalValue *
                                ((Number(bonusValueInput) || 0) / 100),
                            )
                          : Number(bonusValueInput) || 0;

                      const timestamp = new Date().toISOString();
                      const desc = `Bonus Menu: ${selectedBonusItem.name}`;
                      const cartIdStr =
                        selectedBonusItem.cartId?.toString() || "0";

                      try {
                        // Check if a bonus for this exact item already exists
                        const existing: any = db.getFirstSync(
                          "SELECT id FROM Staff_Bonuses WHERE employee_id = ? AND transaction_id = ? AND cart_id = ?",
                          [
                            selectedPayrollStaff.id,
                            selectedBonusItem.txId,
                            cartIdStr,
                          ],
                        );

                        if (existing) {
                          db.runSync(
                            "UPDATE Staff_Bonuses SET method = ?, value = ?, amount = ? WHERE id = ?",
                            [bonusMethod, bonusValueInput, amount, existing.id],
                          );
                        } else {
                          db.runSync(
                            "INSERT INTO Staff_Bonuses (employee_id, transaction_id, cart_id, method, value, timestamp, amount, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                            [
                              selectedPayrollStaff.id,
                              selectedBonusItem.txId,
                              cartIdStr,
                              bonusMethod,
                              bonusValueInput,
                              timestamp,
                              amount,
                              desc,
                            ],
                          );
                        }

                        // Refresh all calculations!
                        loadPayrollData();
                      } catch (e) {
                        console.error("Error saving menu bonus to db:", e);
                      }
                    }
                    setSelectedBonusItem(null);
                  }}
                >
                  <Text style={styles.textWhiteBold}>Simpan</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* BASE SALARY MODAL */}
      <Modal
        visible={showBaseSalaryModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowBaseSalaryModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "center" }}
        >
          <SafeAreaView style={styles.payrollModalOverlay}>
            <View style={styles.bonusModalContainer}>
              <Text style={styles.bonusModalTitle}>Atur Gaji Dasar</Text>
              <Text style={styles.bonusInputLabel}>GAJI POKOK STAFF (Rp)</Text>
              <TextInput
                style={styles.bonusInput}
                placeholder="e.g. 2000000"
                placeholderTextColor="#8E8E93"
                keyboardType="numeric"
                value={baseSalaryInput}
                onChangeText={(text) =>
                  setBaseSalaryInput(text.replace(/[^0-9]/g, ""))
                }
              />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  style={[styles.closeBtnPill, { flex: 1, borderRadius: 8 }]}
                  onPress={() => setShowBaseSalaryModal(false)}
                >
                  <Text style={styles.textWhiteBold}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.closeBtnPill,
                    { flex: 1, borderRadius: 8, backgroundColor: "#0A84FF" },
                  ]}
                  onPress={() => {
                    const cleanVal = Number(baseSalaryInput) || 0;
                    try {
                      db.runSync(
                        "UPDATE Employees SET base_salary = ? WHERE id = ?",
                        [cleanVal, selectedPayrollStaff.id],
                      );
                      setBaseSalary(cleanVal);
                      setSelectedPayrollStaff({
                        ...selectedPayrollStaff,
                        base_salary: cleanVal,
                      });
                      setShowBaseSalaryModal(false);
                    } catch (e) {
                      console.error("Error saving base salary:", e);
                    }
                  }}
                >
                  <Text style={styles.textWhiteBold}>Simpan</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
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

  textWhite: {
    color: "#FFF",
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
  colName: { width: 130 },
  colDate: { width: 90 },
  colTime: { width: 70 },
  colStatus: { width: 190 },

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

  payrollModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    padding: 20,
  },
  receiptPaper: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 8,
    width: "100%",
    maxWidth: 350,
    alignSelf: "center",
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
  receiptLine: { color: "#000", fontSize: 12, marginVertical: 2 },
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
  receiptDiscountLeftWrap: {
    color: "#FF453A",
    fontSize: 12,
    flex: 1,
    flexShrink: 1,
    paddingRight: 15,
  },
  receiptDiscountRight: { color: "#FF453A", fontSize: 12, textAlign: "right" },
  modalActionsCenter: {
    flexDirection: "row",
    justifyContent: "center",
    width: "100%",
    marginTop: 20,
  },
  closeBtnPill: {
    backgroundColor: "#2C2C2E",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
  },

  // Bonus Modal & Stats Styles
  bonusStatBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
  },
  bonusModalContainer: {
    backgroundColor: "#1C1C1E",
    padding: 20,
    borderRadius: 15,
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  bonusModalTitle: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  bonusStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  bonusStatBox: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2C2C2E",
    alignItems: "center",
  },
  bonusStatLabel: {
    color: "#8E8E93",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 5,
  },
  bonusStatValue: {
    fontSize: 16,
    fontWeight: "bold",
  },
  bonusInputLabel: {
    color: "#8E8E93",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 10,
  },
  bonusInput: {
    backgroundColor: "#121212",
    color: "#FFF",
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0A84FF",
    fontSize: 16,
    marginBottom: 25,
  },

  // Menu Item Bonus Styles
  itemBonusRowContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  addBonusItemBtn: {
    backgroundColor: "#2C2C2E",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#3A3A3C",
    marginLeft: 10,
  },
  addBonusItemBtnActive: {
    backgroundColor: "rgba(255, 159, 10, 0.15)",
    borderColor: "#FF9F0A",
  },
  addBonusItemBtnText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "bold",
  },
  bonusItemSummaryBox: {
    backgroundColor: "#121212",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  methodSelectorRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  methodBtn: {
    flex: 1,
    backgroundColor: "#121212",
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  methodBtnActive: {
    backgroundColor: "rgba(10, 132, 255, 0.2)",
    borderColor: "#0A84FF",
  },
  liveBonusPreviewBox: {
    backgroundColor: "#121212",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  payrollBottomBar: {
    backgroundColor: "#121212",
    borderTopWidth: 1,
    borderColor: "#2C2C2E",
    padding: 20,
  },
  payrollRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
});
