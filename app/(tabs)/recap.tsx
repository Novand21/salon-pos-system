import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";



import ZoomableReceipt from "@/components/ZoomableReceipt";
import { db } from "@/database/db";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "expo-router";
import {
  GestureHandlerRootView,
  ScrollView,
} from "react-native-gesture-handler";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { printReceiptRaw } from "../../utils/bluetooth";
import { generateThermalReceiptString } from "../../utils/printer";

// pdf generating monthly reports for recap
import * as FileSystem from "expo-file-system/legacy";
import { printToFileAsync } from "expo-print";
import * as Sharing from "expo-sharing";

// pass
import { OWNER_PASSWORD } from "@/utils/pass";

// icons
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function RecapScreen() {
  const insets = useSafeAreaInsets();
  // DATE RANGE STATES
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [activePicker, setActivePicker] = useState<
    "start" | "end" | "expense" | null
  >(null);
  const [expenseDate, setExpenseDate] = useState<Date>(new Date());

  // SORTING STATE
  const [sortMode, setSortMode] = useState<"desc" | "asc">("desc");

  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [ledgerData, setLedgerData] = useState<any[]>([]);

  const [staffList, setStaffList] = useState<any[]>([]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseStaffs, setExpenseStaffs] = useState<string[]>([]);
  const [expenseCategory, setExpenseCategory] = useState("Operasional");
  const [ownerEffect, setOwnerEffect] = useState<"none" | "subtract">(
    "subtract",
  );
  const [salaryEffect, setSalaryEffect] = useState<"none" | "add" | "subtract">(
    "none",
  );
  const defaultExpenseCategories = ["Operasional", "Kasbon", "Uang Makan"];

  // passwords
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // RECEIPT ZOOM
  const [isZoomed, setIsZoomed] = useState(false);

  // DATE RANGE NAVIGATION FUNCTIONS
  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === "android") {
      setActivePicker(null);
    }

    if (date) {
      if (activePicker === "start") {
        setStartDate(date);
        // If the chosen start date is ahead of the end date, force the end date to match it
        if (date > endDate) {
          setEndDate(date);
        }
      } else if (activePicker === "end") {
        setEndDate(date);
        // If the chosen end date is behind the start date, force the start date to match it
        if (date < startDate) {
          setStartDate(date);
        }
      } else if (activePicker === "expense") {
        const newDate = new Date(date);
        const now = new Date();
        newDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
        setExpenseDate(newDate);
      }
    }
  };

  const formatDateLabel = (date: Date) => {
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // EXPENSE & TRANSACTION LOGIC
  const handleSaveExpense = () => {
    if (!expenseDesc || !expenseAmount)
      return alert("Tolong isi seluruh deskripsi dan jumlah pengeluaran!");

    try {
      const timestamp = expenseDate.toISOString();
      const staffString =
        expenseStaffs.length > 0 ? ` (by ${expenseStaffs.join(", ")})` : "";

      // Inject category into the description for the Recap list
      const finalDescription = `${expenseDesc}${staffString}`;
      const amountNum = Number(expenseAmount);

      const finalCategory =
        ownerEffect === "none" ? `${expenseCategory}__IGNORE` : expenseCategory;

      db.runSync(
        "INSERT INTO Expenditures (timestamp, description, amount, category) VALUES (?, ?, ?, ?)",
        [timestamp, finalDescription, amountNum, finalCategory],
      );

      // Cross-link to Staff Bonuses if the owner applied a modifier
      if (salaryEffect !== "none" && expenseStaffs.length > 0) {
        // Apply the FULL amount to each selected staff member (No longer dividing)
        const finalBonusAmount =
          salaryEffect === "subtract" ? -amountNum : amountNum;

        // Use the selected category as the "method" so manage.tsx can filter it
        const methodToSave = expenseCategory;

        expenseStaffs.forEach((staffName) => {
          const staffObj = staffList.find((s) => s.name === staffName);
          if (staffObj) {
            db.runSync(
              "INSERT INTO Staff_Bonuses (employee_id, method, timestamp, amount, description) VALUES (?, ?, ?, ?, ?)",
              [
                staffObj.id,
                methodToSave,
                timestamp,
                finalBonusAmount,
                `Deskripsi: ${expenseDesc}`,
              ],
            );
          }
        });
      }

      fetchDayData();
      setExpenseDesc("");
      setExpenseAmount("");
      setExpenseStaffs([]);
      setExpenseCategory("Operasional");
      setSalaryEffect("none");
      setOwnerEffect("subtract");
      setShowExpenseModal(false);
    } catch (error) {
      console.error("Error saving expense:", error);
    }
  };

  const openTransactionDetails = (tx: any) => {
    setSelectedTx(tx);
  };

  // Main data gathering isolated to a re-runnable function
  const fetchDayData = useCallback(() => {
    try {
      // Create boundaries spanning from the start date to the end date
      const startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);

      const employees = db.getAllSync("SELECT * FROM Employees");
      setStaffList(employees);
      const getStylistName = (id: number) =>
        (employees.find((e: any) => e.id === id) as any)?.name || "Unknown";

      const sales = db
        .getAllSync(
          "SELECT * FROM Transactions WHERE timestamp >= ? AND timestamp <= ? AND status = 'completed'",
          [startOfDay.toISOString(), endOfDay.toISOString()],
        )
        .map((tx: any) => {
          const txDate = new Date(tx.timestamp);
          return {
            id: `tx-${tx.id}`,
            dbId: tx.id,
            type: "sale",
            title: `No. Urut #${tx.queue_number}`,
            queue_number: tx.queue_number,
            trx_code: tx.trx_code,
            dateStr: txDate.toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
            time: txDate.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            stylist: getStylistName(tx.employee_id),
            amount: tx.total_amount,
            paymentMethod: tx.payment_method,
            timestamp: tx.timestamp,

            parsedCart: JSON.parse(tx.cart_json || "[]"),
            amountTendered: tx.amount_tendered || tx.total_amount,
            changeAmount: tx.change_amount || 0,
          };
        });

      const expenses = db
        .getAllSync(
          "SELECT * FROM Expenditures WHERE timestamp >= ? AND timestamp <= ?",
          [startOfDay.toISOString(), endOfDay.toISOString()],
        )
        .map((exp: any) => {
          const expDate = new Date(exp.timestamp);

          const staffMatch = exp.description.match(/\(by .+\)/);
          const staffString = staffMatch ? ` ${staffMatch[0]}` : "";

          const isIgnored = exp.category && exp.category.endsWith("__IGNORE");
          const cleanCategory = isIgnored
            ? exp.category.replace("__IGNORE", "")
            : exp.category || "Operasional";

          return {
            id: `exp-${exp.id}`,
            dbId: exp.id,
            type: "expense",
            title: `${cleanCategory}${staffString}`,
            dateStr: expDate.toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
            time: expDate.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            amount: isIgnored ? 0 : -exp.amount,
            displayAmount: exp.amount,
            isIgnored: isIgnored,
            details: exp.description,
            timestamp: exp.timestamp,
            category: cleanCategory,
          };
        });

      const combined = [...sales, ...expenses].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      setLedgerData(combined);
    } catch (e) {
      console.error("Failed accessing data:", e);
    }
  }, [startDate, endDate]);

  useFocusEffect(
    useCallback(() => {
      const handle = requestIdleCallback(
        () => {
          fetchDayData();
        },
        { timeout: 1000 },
      );

      return () => cancelIdleCallback(handle);
    }, [fetchDayData]),
  );

  const totalEarnings = ledgerData
    .filter((d) => d.type === "sale")
    .reduce((sum, d) => sum + d.amount, 0);

  const totalCash = ledgerData
    .filter((d) => d.type === "sale" && d.paymentMethod === "Cash")
    .reduce((sum, d) => sum + d.amount, 0);

  const totalNonCash = ledgerData
    .filter(
      (d) =>
        d.type === "sale" &&
        (d.paymentMethod === "QRIS" || d.paymentMethod === "Transfer"),
    )
    .reduce((sum, d) => sum + d.amount, 0);

  const totalExpenses = ledgerData
    .filter((d) => d.type === "expense")
    .reduce((sum, d) => sum + Math.abs(d.amount), 0);

  const netEarning = totalEarnings - totalExpenses;

  const sortedLedgerData = [...ledgerData].sort((a, b) => {
    // 1Get the pure Date (Midnight) to group days together
    const dateA = new Date(a.timestamp).setHours(0, 0, 0, 0);
    const dateB = new Date(b.timestamp).setHours(0, 0, 0, 0);

    // Primary Sort: By Date
    if (dateA !== dateB) {
      return sortMode === "desc" ? dateB - dateA : dateA - dateB;
    }

    // Secondary Sort: If they are on the SAME day, separate Sales and Expenses
    if (a.type === "expense" && b.type === "sale") return 1; // Push expenses down
    if (a.type === "sale" && b.type === "expense") return -1; // Keep sales up top

    // Tertiary Sort: If both are Sales, sort by No. Urut
    if (a.type === "sale" && b.type === "sale") {
      return sortMode === "desc"
        ? (b.queue_number || 0) - (a.queue_number || 0)
        : (a.queue_number || 0) - (b.queue_number || 0);
    }

    // If both are Expenses, just sort them by exact time
    return sortMode === "desc"
      ? new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      : new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  const handleDeleteTransaction = () => {
    if (!selectedTx) return;
    setDeletePassword("");
    setIsPasswordVisible(false);
    setShowPasswordModal(true);
  };

  const confirmDelete = () => {
    const ownerPassword = OWNER_PASSWORD || "admin123";
    if (deletePassword !== ownerPassword) {
      alert("Password salah! Hanya Owner yang dapat menghapus data.");
      return;
    }

    try {
      if (selectedTx.type === "sale") {
        // revert stock before deleting
        (selectedTx.parsedCart || []).forEach((item: any) => {
          if (item.is_stock_enabled) {
            db.runSync(
              "UPDATE Services_Products SET stock_quantity = stock_quantity + ? WHERE id = ?",
              [item.quantity, item.id],
            );
          }
          (item.selectedAddOns || []).forEach((addon: any) => {
            db.runSync(
              "UPDATE Services_Products SET stock_quantity = stock_quantity + ? WHERE lower(name) = lower(?) AND is_stock_enabled = 1",
              [(addon.quantity || 1) * item.quantity, addon.name],
            );
          });
        });
        // Delete associated items from Staff Bonuses
        db.runSync("DELETE FROM Staff_Bonuses WHERE transaction_id = ?", [
          selectedTx.dbId,
        ]);
        // Delete associated items first to satisfy Foreign Key constraints
        db.runSync("DELETE FROM Transaction_Items WHERE transaction_id = ?", [
          selectedTx.dbId,
        ]);
        // Delete the main transaction
        db.runSync("DELETE FROM Transactions WHERE id = ?", [selectedTx.dbId]);
      } else if (selectedTx.type === "expense") {
        // Delete associated items from Staff Bonuses
        db.runSync("DELETE FROM Staff_Bonuses WHERE timestamp = ?", [
          selectedTx.timestamp,
        ]);
        // Expenses have no child tables, so just delete them directly
        db.runSync("DELETE FROM Expenditures WHERE id = ?", [selectedTx.dbId]);
      }

      alert("Data berhasil dihapus!");
      setShowPasswordModal(false);
      setSelectedTx(null);
      fetchDayData();
    } catch (error) {
      console.error("Error deleting record:", error);
      alert("Gagal menghapus data.");
    }
  };

  const handleReprint = async () => {
    Alert.alert(
      "Konfirmasi Cetak Ulang",
      "Apakah Anda yakin ingin mencetak ulang struk ini?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Cetak",
          onPress: async () => {
            if (!selectedTx || selectedTx.type !== "sale") return;

            if (!selectedTx.parsedCart || selectedTx.parsedCart.length === 0) {
              alert("Transaksi lama dengan data yang telah dihapus.");
              return;
            }

            try {
              const cartItems = selectedTx.parsedCart;

              const rawPrinterText = generateThermalReceiptString(
                selectedTx.trx_code,
                selectedTx.queue_number,
                cartItems,
                selectedTx.amount,
                selectedTx.paymentMethod,
                selectedTx.stylist,
                selectedTx.amountTendered,
                selectedTx.changeAmount,
                selectedTx.timestamp,
              );

              const printed = await printReceiptRaw(rawPrinterText);
              if (!printed) alert("Tidak ada printer aktif! ");
            } catch (error) {
              console.error(error);
            }
          },
        },
      ],
    );
  };

  // pdf report generator

  const handleExportPDF = async () => {
    try {
      const sales = ledgerData.filter((d) => d.type === "sale");
      const expenses = ledgerData.filter(
        (d) => d.type === "expense" && !d.isIgnored,
      );

      let opExp = 0,
        staffExp = 0;
      expenses.forEach((e) => {
        const amt = Math.abs(e.amount);
        if (e.category === "Operasional") opExp += amt;
        else staffExp += amt;
      });

      // daily ledger table
      const dailyMap: { [key: string]: { in: number; out: number } } = {};
      ledgerData.forEach((d) => {
        if (d.isIgnored) return;
        const dateStr = d.dateStr;
        if (!dailyMap[dateStr]) dailyMap[dateStr] = { in: 0, out: 0 };
        if (d.type === "sale") dailyMap[dateStr].in += d.amount;
        if (d.type === "expense") dailyMap[dateStr].out += Math.abs(d.amount);
      });

      const dailyRows = Object.keys(dailyMap)
        .map((date) => {
          const row = dailyMap[date];
          const laba = row.in - row.out;
          return `
            <tr>
              <td>${date}</td>
              <td style="color: green;">Rp ${row.in.toLocaleString("id-ID")}</td>
              <td style="color: red;">Rp ${row.out.toLocaleString("id-ID")}</td>
              <td style="font-weight: bold;">Rp ${laba.toLocaleString("id-ID")}</td>
            </tr>
          `;
        })
        .join("");

      // Inject Data into HTML Template
      const htmlTemplate = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
              h1 { text-align: center; color: #111; font-size: 28px; margin-bottom: 5px; letter-spacing: 2px;}
              .subtitle { text-align: center; color: #666; font-size: 14px; margin-bottom: 40px; }
              .section { margin-bottom: 35px; }
              .section-title { font-size: 16px; font-weight: bold; border-bottom: 2px solid #0A84FF; padding-bottom: 8px; margin-bottom: 15px; color: #111; }
              .row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 15px; }
              .row-title { color: #555; }
              .row-value { font-weight: bold; }
              .net-profit { font-size: 20px; color: #0A84FF; border-top: 1px dashed #ccc; padding-top: 15px; margin-top: 10px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
              th, td { border: 1px solid #ddd; padding: 12px 8px; text-align: left; }
              th { background-color: #f2f2f7; color: #333; }
              .footer { text-align: center; margin-top: 50px; font-size: 11px; color: #999; }
            </style>
          </head>
          <body>
            <h1>D'FFOND SALON</h1>
            <div class="subtitle">Laporan Keuangan (${formatDateLabel(startDate)} - ${formatDateLabel(endDate)})</div>
            <div class="section">
              <div class="section-title">1. RIWAYAT TRANSAKSI HARIAN</div>
              <table>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Pemasukan</th>
                    <th>Pengeluaran</th>
                    <th>Laba Bersih</th>
                  </tr>
                </thead>
                <tbody>
                  ${dailyRows || `<tr><td colspan="4" style="text-align: center;">Tidak ada transaksi</td></tr>`}
                </tbody>
              </table>
            </div>

            
            <div class="section">
              <div class="section-title">2. RINCIAN PENDAPATAN</div>
              <div class="row"><span class="row-title">Pembayaran Tunai (Cash)</span><span class="row-value">Rp ${totalCash.toLocaleString("id-ID")}</span></div>
              <div class="row"><span class="row-title">Pembayaran Non-Tunai (QRIS/Transfer)</span><span class="row-value">Rp ${totalNonCash.toLocaleString("id-ID")}</span></div>
            </div>
            
            <div class="section">
              <div class="section-title">3. RINCIAN PENGELUARAN</div>
              <div class="row"><span class="row-title">Operasional Salon</span><span class="row-value">Rp ${opExp.toLocaleString("id-ID")}</span></div>
              <div class="row"><span class="row-title">Pengeluaran Staff</span><span class="row-value">Rp ${staffExp.toLocaleString("id-ID")}</span></div>
            </div>
            <div class="section">
              <div class="section-title">4. RINGKASAN</div>
              <div class="row"><span class="row-title">Total Pendapatan (Gross)</span><span class="row-value" style="color: green;">Rp ${totalEarnings.toLocaleString("id-ID")}</span></div>
              <div class="row"><span class="row-title">Total Pengeluaran</span><span class="row-value" style="color: red;">- Rp ${totalExpenses.toLocaleString("id-ID")}</span></div>
              <div class="row net-profit"><span class="row-title" style="color: #111;">Laba Bersih (Net Profit)</span><span class="row-value">Rp ${netEarning.toLocaleString("id-ID")}</span></div>
            </div>
          </body>
        </html>
      `;
      const { uri } = await printToFileAsync({
        html: htmlTemplate,
        base64: false,
      });

      const startString = startDate
        .toLocaleDateString("id-ID", {
          month: "short",
          year: "numeric",
        })
        .replace(/[^a-zA-Z0-9]/g, "_");

      const endString = endDate
        .toLocaleDateString("id-ID", {
          month: "short",
          year: "numeric",
        })
        .replace(/[^a-zA-Z0-9]/g, "_");

      const dateRangeStr =
        startString === endString
          ? startString
          : `${startString}_to_${endString}`;

      // Add Date.now() to guarantee a 100% unique file name every single time
      const customFileName = `Laporan_Keuangan_${dateRangeStr}_${Date.now()}.pdf`;

      const newUri = `${FileSystem.documentDirectory}${customFileName}`;

      // Delete any existing file with this exact name just to be safe
      const fileInfo = await FileSystem.getInfoAsync(newUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(newUri);
      }

      await FileSystem.copyAsync({
        from: uri,
        to: newUri,
      });

      await Sharing.shareAsync(newUri, {
        UTI: ".pdf",
        mimeType: "application/pdf",
        dialogTitle: "Laporan Keuangan DFFOND",
      });
    } catch (err) {
      console.error("PDF Export Error:", err);
      alert("Gagal membuat PDF.");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerMainBlock}>
          <Text style={styles.headerTitle}>Recap Keuangan</Text>

          {/* Balanced Date Range Selector Grid */}
          <View style={styles.dateRangeContainer}>
            <TouchableOpacity
              onPress={() => setActivePicker("start")}
              style={styles.datePickerBtn}
            >
              <Text style={styles.dateLabelText}>DARI</Text>
              <Text
                style={styles.dateValueText}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatDateLabel(startDate)}
              </Text>
            </TouchableOpacity>

            <Text style={styles.dateDividerText}>-</Text>

            <TouchableOpacity
              onPress={() => setActivePicker("end")}
              style={styles.datePickerBtn}
            >
              <Text style={styles.dateLabelText}>SAMPAI</Text>
              <Text
                style={styles.dateValueText}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatDateLabel(endDate)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View
          style={{
            flexDirection: "column",
            gap: 10,
            alignItems: "flex-end",
            flexShrink: 0,
          }}
        >
          <TouchableOpacity
            style={[
              styles.addExpenseBtn,
              {
                backgroundColor: "rgba(10,132,255,0.15)",
                borderColor: "#0A84FF",
                borderWidth: 1,
              },
            ]}
            onPress={handleExportPDF}
          >
            <Text
              style={[
                styles.textWhite,
                { color: "#0A84FF", fontWeight: "bold" },
              ]}
            >
              📄 Export
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addExpenseBtn}
            onPress={() => {
              setShowExpenseModal(true);
              setExpenseDate(new Date());
            }}
          >
            <Text style={styles.textWhite}>Kelola</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* NATIVE CALENDAR MODAL */}
      {activePicker && (
        <DateTimePicker
          value={
            activePicker === "start"
              ? startDate
              : activePicker === "end"
                ? endDate
                : expenseDate
          }
          mode="date"
          display="default"
          minimumDate={activePicker === "end" ? startDate : undefined}
          maximumDate={activePicker === "start" ? endDate : undefined}
          onChange={handleDateChange}
        />
      )}

      {/* FOR IOS ONLY: A close button if the calendar is inline */}
      {Platform.OS === "ios" && activePicker && (
        <View
          style={{
            backgroundColor: "#1C1C1E",
            alignItems: "flex-end",
            padding: 10,
          }}
        >
          <TouchableOpacity onPress={() => setActivePicker(null)}>
            <Text style={{ color: "#0A84FF", fontWeight: "bold" }}>
              Selesai
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        contentContainerStyle={styles.listContainer}
        data={sortedLedgerData}
        keyExtractor={(tx) => tx.id.toString()}
        initialNumToRender={15}
        maxToRenderPerBatch={20}
        windowSize={10}
        ListHeaderComponent={
          <>
            <Text style={styles.sectionLabel}>BUKU KAS</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 15, flexDirection: "row" }}
            >
              {[
                { id: "desc", label: "↓ Terbaru" },
                { id: "asc", label: "↑ Terlama" },
              ].map((sort) => (
                <TouchableOpacity
                  key={sort.id}
                  onPress={() => setSortMode(sort.id as any)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 15,
                    marginRight: 8,
                    borderWidth: 1,
                    borderColor: sortMode === sort.id ? "#0A84FF" : "#2C2C2E",
                    backgroundColor:
                      sortMode === sort.id ? "rgba(10,132,255,0.2)" : "#1C1C1E",
                  }}
                >
                  <Text
                    style={{
                      color: sortMode === sort.id ? "#0A84FF" : "#8E8E93",
                      fontSize: 12,
                      fontWeight: "bold",
                    }}
                  >
                    {sort.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        }
        ListEmptyComponent={
          <Text style={styles.textGrayCenter}>
            Tidak ada data transaksi pada rentang tanggal ini.
          </Text>
        }
        renderItem={({ item: tx }) => (
          <TouchableOpacity
            onPress={() => openTransactionDetails(tx)}
            style={styles.ledgerCard}
          >
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.ledgerTitle}>
                <Text
                  style={
                    tx.isIgnored
                      ? { color: "#8E8E93" }
                      : tx.type === "expense"
                        ? styles.textRed
                        : styles.textGreen
                  }
                >
                  {tx.type === "expense" ? "↓ " : "↑ "}
                </Text>
                {tx.title}

                {tx.type === "sale" && (
                  <Text
                    style={{
                      color: "#8E8E93",
                      fontSize: 14,
                      fontWeight: "normal",
                    }}
                  >
                    {"  "}•{" "}
                    {tx.parsedCart?.reduce(
                      (sum: number, item: any) => sum + (item.quantity || 1),
                      0,
                    )}{" "}
                    items
                  </Text>
                )}
              </Text>
              <Text style={styles.ledgerSubtitle}>
                {tx.type === "expense"
                  ? `${tx.dateStr} • Pukul ${tx.time}`
                  : `${tx.dateStr} • Kasir: ${tx.stylist}`}
              </Text>
            </View>

            <Text
              style={[
                styles.ledgerAmount,
                tx.isIgnored
                  ? { color: "#8E8E93" }
                  : tx.type === "expense"
                    ? styles.textRed
                    : styles.textGreen,
              ]}
            >
              {tx.type === "expense" ? "- Rp " : "+ Rp "}
              {tx.isIgnored
                ? tx.displayAmount.toLocaleString("id-ID")
                : Math.abs(tx.amount).toLocaleString("id-ID")}
            </Text>
          </TouchableOpacity>
        )}
      />

      <View style={styles.bottomBar}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 8,
            paddingHorizontal: 5,
          }}
        >
          <Text style={{ color: "#0A84FF", fontSize: 12, fontWeight: "bold" }}>
            Cash: Rp {totalCash.toLocaleString("id-ID")}
          </Text>
          <Text style={{ color: "#0A84FF", fontSize: 12, fontWeight: "bold" }}>
            Non-Cash: Rp {totalNonCash.toLocaleString("id-ID")}
          </Text>
        </View>
        <View style={styles.grossRow}>
          <Text style={styles.textGray}>
            Gross: Rp {totalEarnings.toLocaleString("id-ID")}
          </Text>
          <Text style={styles.textGray}>
            Pengeluaran: Rp {totalExpenses.toLocaleString("id-ID")}
          </Text>
        </View>
        <View
          style={[
            styles.netBox,
            netEarning < 0 && { borderColor: "rgba(221, 57, 48, 0.83)" },
          ]}
        >
          <Text style={styles.netBoxLabel}>Total Penghasilan</Text>
          <Text
            style={[styles.netBoxValue, netEarning < 0 && { color: "#FF453A" }]}
          >
            {netEarning < 0 ? "- Rp " : "Rp "}
            {Math.abs(netEarning).toLocaleString("id-ID")}
          </Text>
        </View>
      </View>

      <Modal
        visible={!!selectedTx}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSelectedTx(null)}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View
            style={[
              styles.modalOverlay,
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
              scrollEnabled={!isZoomed}
            >
              <ZoomableReceipt onZoomChange={(zoomed) => setIsZoomed(zoomed)}>
                <View style={styles.receiptPaper}>
                  <Text style={styles.receiptTitle}>D'FFOND SALON</Text>
                  <Text style={styles.receiptCenter}>
                    Jl. Dagopojok No.16, Kota Bandung
                  </Text>

                  <Text style={styles.receiptDivider}>
                    --------------------------------
                  </Text>
                  <Text style={styles.receiptLine}>
                    Tanggal:{" "}
                    {selectedTx
                      ? new Date(selectedTx.timestamp).toLocaleDateString(
                          "en-GB",
                        )
                      : ""}
                  </Text>
                  <Text style={styles.receiptLine}>
                    Waktu: {selectedTx?.time}
                  </Text>
                  {selectedTx?.type === "sale" && (
                    <Text style={styles.receiptLine}>
                      Cashier: {selectedTx?.stylist}
                    </Text>
                  )}
                  <Text style={styles.receiptDivider}>
                    --------------------------------
                  </Text>

                  {selectedTx?.type === "sale" ? (
                    <View>
                      {/* USE THE FULL CART JSON INSTEAD OF THE FLATTENED TRANSACTION ITEMS */}
                      {(selectedTx.parsedCart || []).map(
                        (cartItem: any, index: number) => {
                          const addOnsTotal =
                            cartItem.selectedAddOns &&
                            cartItem.selectedAddOns.length > 0
                              ? cartItem.selectedAddOns.reduce(
                                  (sum: number, addon: any) =>
                                    sum + addon.price,
                                  0,
                                )
                              : 0;
                          const basePriceWithAddons =
                            cartItem.price + addOnsTotal;
                          const discountNominal = Math.round(
                            basePriceWithAddons *
                              cartItem.quantity *
                              (cartItem.discountPercent / 100),
                          );

                          return (
                            <View
                              key={cartItem.cartId || index}
                              style={{
                                marginBottom: 12,
                                paddingBottom: 8,
                                borderBottomWidth: 1,
                                borderBottomColor: "#F2F2F7",
                              }}
                            >
                              {/* 1. JUST THE ITEM NAME (Removed quantity from here) */}
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
                              </View>

                              {/* QUANTITY & BASE TOTAL ROW */}
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

                              {/* Stylists */}
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

                              {/* Add-ons List */}
                              {cartItem.selectedAddOns.map(
                                (addon: any, idx: number) => {
                                  const totalAddonQty =
                                    (addon.quantity || 1) * cartItem.quantity;
                                  const totalAddonPrice =
                                    addon.price * totalAddonQty;

                                  if (totalAddonQty === 1) {
                                    return (
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
                                          Rp{" "}
                                          {totalAddonPrice.toLocaleString(
                                            "id-ID",
                                          )}
                                        </Text>
                                      </View>
                                    );
                                  } else {
                                    return (
                                      <View
                                        key={idx}
                                        style={{ marginVertical: 2 }}
                                      >
                                        <Text
                                          style={{
                                            color: "#555",
                                            fontSize: 12,
                                          }}
                                        >
                                          + {addon.name}
                                        </Text>

                                        <View
                                          style={{
                                            flexDirection: "row",
                                            justifyContent: "space-between",
                                            alignItems: "flex-start",
                                            paddingLeft: 14,
                                            marginTop: 2,
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
                                            ({totalAddonQty}x Rp{" "}
                                            {addon.price.toLocaleString(
                                              "id-ID",
                                            )}
                                            )
                                          </Text>
                                          <Text
                                            style={{
                                              color: "#555",
                                              fontSize: 12,
                                              textAlign: "right",
                                            }}
                                          >
                                            Rp{" "}
                                            {totalAddonPrice.toLocaleString(
                                              "id-ID",
                                            )}
                                          </Text>
                                        </View>
                                      </View>
                                    );
                                  }
                                },
                              )}

                              {/* Discount Info */}
                              {cartItem.discountPercent > 0 && (
                                <View style={styles.receiptRowWrap}>
                                  <Text
                                    style={[
                                      styles.receiptDiscountLeftWrap,
                                      { paddingLeft: 10 },
                                    ]}
                                  >
                                    Disc {cartItem.discountPercent}%{" "}
                                    {cartItem.discountDesc
                                      ? `(${cartItem.discountDesc})`
                                      : ""}
                                  </Text>
                                  <Text style={styles.receiptDiscountRight}>
                                    -Rp{" "}
                                    {discountNominal.toLocaleString("id-ID")}
                                  </Text>
                                </View>
                              )}

                              {/* SUBTOTAL ROW */}
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
                              {/* DISPLAY CUSTOM NOTE IN RECAP */}
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
                        },
                      )}

                      <Text style={styles.receiptDivider}>
                        --------------------------------
                      </Text>

                      {/* Payment Method Details */}
                      <View style={styles.receiptRowWrap}>
                        <Text style={styles.receiptLine}>PEMBAYARAN:</Text>
                        <Text style={styles.receiptLine}>
                          {selectedTx?.paymentMethod}
                        </Text>
                      </View>

                      {/* 3. TOTAL CHANGE FOR CUSTOMER (IF CASH) */}

                      <View>
                        <View style={[styles.receiptRowWrap, { marginTop: 4 }]}>
                          <Text style={styles.receiptLine}>UANG TUNAI:</Text>
                          <Text style={styles.receiptLine}>
                            Rp{" "}
                            {selectedTx?.amountTendered.toLocaleString("id-ID")}
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
                            Rp{" "}
                            {selectedTx?.changeAmount.toLocaleString("id-ID")}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.receiptDivider}>
                        --------------------------------
                      </Text>
                      {/* Grand Total Row */}
                      <View style={styles.receiptRowWrap}>
                        <Text
                          style={{
                            color: "#000",
                            fontSize: 14,
                            fontWeight: "bold",
                          }}
                        >
                          TOTAL:
                        </Text>
                        <Text
                          style={{
                            color: "#000",
                            fontSize: 14,
                            fontWeight: "bold",
                          }}
                        >
                          Rp {selectedTx?.amount.toLocaleString("id-ID")}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={{ paddingVertical: 10 }}>
                      <Text style={styles.receiptBold}>
                        {selectedTx?.category?.toUpperCase() || "PENGELUARAN"}
                      </Text>
                      <Text
                        style={[
                          styles.receiptLine,
                          { textAlign: "center", marginBottom: 15 },
                        ]}
                      >
                        {selectedTx?.details}
                      </Text>

                      <View style={styles.receiptRowWrap}>
                        <Text
                          style={{
                            color: "#000",
                            fontSize: 14,
                            fontWeight: "bold",
                          }}
                        >
                          TOTAL:
                        </Text>
                        <Text
                          style={{
                            color: selectedTx?.isIgnored ? "#8E8E93" : "#000",
                            fontSize: 14,
                            fontWeight: "bold",
                          }}
                        >
                          - Rp{" "}
                          {(selectedTx?.isIgnored
                            ? selectedTx?.displayAmount
                            : Math.abs(selectedTx?.amount || 0)
                          ).toLocaleString("id-ID")}
                        </Text>
                      </View>
                      {selectedTx?.isIgnored && (
                        <Text
                          style={{
                            color: "#8E8E93",
                            fontSize: 12,
                            textAlign: "right",
                            marginTop: 5,
                            fontStyle: "italic",
                          }}
                        >
                          (Tidak Memotong Saldo Owner)
                        </Text>
                      )}
                    </View>
                  )}
                  <Text style={styles.receiptDivider}>
                    --------------------------------
                  </Text>
                </View>
              </ZoomableReceipt>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setSelectedTx(null)}
                style={styles.closeBtn}
              >
                <Text style={styles.textWhiteBold}>Tutup</Text>
              </TouchableOpacity>

              {selectedTx?.type === "sale" && (
                <TouchableOpacity
                  style={styles.reprintBtn}
                  onPress={handleReprint}
                >
                  <Text style={styles.textWhiteBold}>🖨️ Reprint</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleDeleteTransaction}
              >
                <Text style={styles.textWhiteBold}>🗑️ Hapus</Text>
              </TouchableOpacity>
            </View>
          </View>
        </GestureHandlerRootView>
      </Modal>

      {/* EXPENSE MODAL */}
      <Modal
        visible={showExpenseModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowExpenseModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.8)",
              justifyContent: "center",
              paddingHorizontal: 20,
              paddingTop: insets.top || 20,
              paddingBottom: (insets.bottom || 20) + 20, // Extra padding to clear Android buttons
            }}
          >
            <View style={styles.expenseModalBox}>
              <Text style={styles.expenseModalTitle}>Tambah Pengeluaran</Text>

              {/* --- SCROLLABLE INPUTS AREA --- */}
              <ScrollView
                style={{ marginBottom: 20 }}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.inputLabel}>TANGGAL</Text>
                <TouchableOpacity
                  style={styles.datePickerInput}
                  onPress={() => setActivePicker("expense")}
                >
                  <Text style={{ color: "#FFF", fontSize: 16 }}>
                    {formatDateLabel(expenseDate)}
                  </Text>
                  <MaterialCommunityIcons
                    name="calendar"
                    size={20}
                    color="white"
                  />
                </TouchableOpacity>

                <Text style={styles.inputLabel}>NAMA STAFF</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ flexDirection: "row", marginBottom: 20 }}
                >
                  {staffList.map((employee) => {
                    const isSelected = expenseStaffs.includes(employee.name);
                    return (
                      <TouchableOpacity
                        key={employee.id}
                        onPress={() => {
                          if (isSelected) {
                            setExpenseStaffs(
                              expenseStaffs.filter(
                                (name) => name !== employee.name,
                              ),
                            );
                          } else {
                            setExpenseStaffs([...expenseStaffs, employee.name]);
                          }
                        }}
                        style={[
                          styles.pillBtn,
                          isSelected && styles.pillBtnActive,
                        ]}
                      >
                        <Text
                          style={
                            isSelected ? styles.textWhiteBold : styles.textGray
                          }
                        >
                          {employee.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <Text style={styles.inputLabel}>KATEGORI</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ flexDirection: "row", marginBottom: 10 }}
                >
                  {defaultExpenseCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setExpenseCategory(cat)}
                      style={[
                        styles.pillBtn,
                        expenseCategory === cat && styles.pillBtnActive,
                      ]}
                    >
                      <Text
                        style={
                          expenseCategory === cat
                            ? styles.textWhiteBold
                            : styles.textGray
                        }
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TextInput
                  style={styles.textInputBox}
                  placeholder="Atau ketik kategori lain..."
                  placeholderTextColor="#8E8E93"
                  value={expenseCategory}
                  onChangeText={setExpenseCategory}
                />

                <Text style={styles.inputLabel}>DESKRIPSI</Text>
                <TextInput
                  style={styles.textInputBox}
                  placeholder="e.g., Beli Kopi..."
                  placeholderTextColor="#8E8E93"
                  value={expenseDesc}
                  onChangeText={setExpenseDesc}
                />

                <Text style={styles.inputLabel}>JUMLAH (Rp)</Text>
                <TextInput
                  style={styles.textInputBox}
                  placeholder="0"
                  placeholderTextColor="#8E8E93"
                  keyboardType="numeric"
                  value={expenseAmount}
                  onChangeText={setExpenseAmount}
                />

                <Text style={styles.inputLabel}>PENGARUH KE OWNER</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    onPress={() => setOwnerEffect("none")}
                    style={[
                      styles.toggleBtn,
                      {
                        borderColor:
                          ownerEffect === "none" ? "#8E8E93" : "#2C2C2E",
                        backgroundColor:
                          ownerEffect === "none"
                            ? "rgba(142,142,147,0.2)"
                            : "#1C1C1E",
                      },
                    ]}
                  >
                    <Text
                      style={
                        ownerEffect === "none"
                          ? styles.textWhiteBold
                          : styles.textGray
                      }
                    >
                      Tidak ada
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setOwnerEffect("subtract")}
                    style={[
                      styles.toggleBtn,
                      {
                        borderColor:
                          ownerEffect === "subtract" ? "#FF453A" : "#2C2C2E",
                        backgroundColor:
                          ownerEffect === "subtract"
                            ? "rgba(255,69,58,0.2)"
                            : "#1C1C1E",
                      },
                    ]}
                  >
                    <Text
                      style={
                        ownerEffect === "subtract"
                          ? { color: "#FF453A", fontWeight: "bold" }
                          : styles.textGray
                      }
                    >
                      - Potong
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>
                  PENGARUH KE GAJI STAFF (Opsional)
                </Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    onPress={() => setSalaryEffect("none")}
                    style={[
                      styles.toggleBtn,
                      {
                        borderColor:
                          salaryEffect === "none" ? "#0A84FF" : "#2C2C2E",
                        backgroundColor:
                          salaryEffect === "none"
                            ? "rgba(10,132,255,0.2)"
                            : "#1C1C1E",
                      },
                    ]}
                  >
                    <Text
                      style={
                        salaryEffect === "none"
                          ? styles.textWhiteBold
                          : styles.textGray
                      }
                    >
                      Tidak Ada
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setSalaryEffect("subtract")}
                    style={[
                      styles.toggleBtn,
                      {
                        borderColor:
                          salaryEffect === "subtract" ? "#FF453A" : "#2C2C2E",
                        backgroundColor:
                          salaryEffect === "subtract"
                            ? "rgba(255,69,58,0.2)"
                            : "#1C1C1E",
                      },
                    ]}
                  >
                    <Text
                      style={
                        salaryEffect === "subtract"
                          ? { color: "#FF453A", fontWeight: "bold" }
                          : styles.textGray
                      }
                    >
                      - Potong
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setSalaryEffect("add")}
                    style={[
                      styles.toggleBtn,
                      {
                        borderColor:
                          salaryEffect === "add" ? "#34C759" : "#2C2C2E",
                        backgroundColor:
                          salaryEffect === "add"
                            ? "rgba(52,199,89,0.2)"
                            : "#1C1C1E",
                      },
                    ]}
                  >
                    <Text
                      style={
                        salaryEffect === "add"
                          ? { color: "#34C759", fontWeight: "bold" }
                          : styles.textGray
                      }
                    >
                      + Tambah
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>

              {/* --- PINNED BOTTOM BUTTONS --- */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.actionBtnCancel}
                  onPress={() => setShowExpenseModal(false)}
                >
                  <Text style={styles.textWhiteBold}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtnSave}
                  onPress={handleSaveExpense}
                >
                  <Text style={styles.textWhiteBold}>Simpan</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* PASSWORD MODAL FOR DELETION */}
      <Modal
        visible={showPasswordModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1, justifyContent: "center" }}
          >
            <View style={styles.passwordModalContainer}>
              <Text style={styles.passwordModalTitle}>Izin Owner</Text>
              <Text style={styles.passwordModalSubtitle}>
                Masukkan password untuk menghapus data ini.
              </Text>

              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInputInner}
                  placeholder="Password..."
                  placeholderTextColor="#8E8E93"
                  secureTextEntry={!isPasswordVisible}
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                  autoFocus={true}
                />
                <TouchableOpacity
                  onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                  style={{ padding: 10 }}
                >
                  <MaterialCommunityIcons
                    name={isPasswordVisible ? "eye" : "eye-off"}
                    size={20}
                    color="#8E8E93"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.passwordBtnRow}>
                <TouchableOpacity
                  style={styles.passwordCancelBtn}
                  onPress={() => setShowPasswordModal(false)}
                >
                  <Text style={styles.textWhiteBold}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.passwordDeleteBtn}
                  onPress={confirmDelete}
                >
                  <Text style={styles.textWhiteBold}>Hapus Data</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  header: {
    flexWrap: "wrap",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end", // Aligns the button cleanly with the bottom of the date boxes
    padding: 20,
    backgroundColor: "#121212",
    borderBottomWidth: 1,
    borderBottomColor: "#2C2C2E",
  },
  headerMainBlock: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFF",
  },
  dateRangeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  datePickerBtn: {
    backgroundColor: "#1C1C1E",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2C2C2E",
    flex: 1,
    minWidth: 95, // Prevents total compression on ultra-small displays
  },
  dateLabelText: {
    color: "#8E8E93",
    fontSize: 9,
    fontWeight: "bold",
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  dateValueText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  dateDividerText: {
    color: "#8E8E93",
    fontWeight: "bold",
    paddingHorizontal: 6,
    fontSize: 16,
  },
  addExpenseBtn: {
    backgroundColor: "#2C2C2E",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignSelf: "flex-end", // Safely locks button to the lower right corner
    flexShrink: 0,
  },
  listContainer: { padding: 15, gap: 10, paddingBottom: 120 },
  sectionLabel: {
    color: "#8E8E93",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 5,
  },
  textGrayCenter: {
    color: "#8E8E93",
    textAlign: "center",
    marginTop: 30,
    fontSize: 14,
  },
  ledgerCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
    padding: 16,
    borderRadius: 12,
  },
  ledgerTitle: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
  ledgerSubtitle: { color: "#8E8E93", fontSize: 14, marginTop: 4 },
  ledgerAmount: { fontSize: 16, fontWeight: "bold" },
  bottomBar: {
    backgroundColor: "#121212",
    borderTopWidth: 1,
    borderTopColor: "#2C2C2E",
    padding: 15,
    paddingBottom: 25,
  },
  grossRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 5,
  },
  netBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(52, 199, 89, 0.3)",
  },
  netBoxLabel: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  netBoxValue: { color: "#34C759", fontSize: 20, fontWeight: "bold" },
  textWhite: { color: "#FFF", fontSize: 12 },
  textWhiteBold: { color: "#FFF", fontWeight: "bold", fontSize: 16 },
  textGray: { color: "#8E8E93" },
  textGreen: { color: "#34C759" },
  textRed: { color: "#FF453A" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    padding: 20,
  },
  receiptPaper: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 4,
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

  receiptBold: {
    color: "#000",
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 10,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: 20,
    gap: 15,
    marginTop: 30,
  },
  closeBtn: {
    backgroundColor: "#2C2C2E",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
  },
  reprintBtn: {
    backgroundColor: "#34C759",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
  },
  deleteBtn: {
    backgroundColor: "#FF453A",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
  },
  passwordModalContainer: {
    backgroundColor: "#1C1C1E",
    padding: 20,
    borderRadius: 15,
    width: "90%",
    maxWidth: 400,
    alignSelf: "center",
  },
  passwordModalTitle: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  passwordModalSubtitle: {
    color: "#8E8E93",
    fontSize: 14,
    marginBottom: 20,
  },
  passwordInput: {
    backgroundColor: "#121212",
    color: "#FFF",
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FF453A",
    marginBottom: 25,
  },
  passwordBtnRow: {
    flexDirection: "row",
    gap: 10,
  },
  passwordCancelBtn: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    backgroundColor: "#2C2C2E",
    alignItems: "center",
  },
  passwordDeleteBtn: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    backgroundColor: "#FF453A",
    alignItems: "center",
  },
  passwordInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121212",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FF453A",
    marginBottom: 25,
    paddingHorizontal: 15,
    height: 55,
  },
  passwordInputInner: {
    flex: 1,
    color: "#FFF",
    height: "100%",
    fontSize: 16,
  },
  sidePanel: {
    width: "80%",
    maxWidth: 400,
    backgroundColor: "#1C1C1E",
    height: "100%",
    borderLeftWidth: 1,
    borderColor: "#2C2C2E",
  },

  // --- EXPENSE MODAL STYLES ---
  expenseModalBox: {
    backgroundColor: "#1C1C1E",
    padding: 20,
    borderRadius: 15,
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    maxHeight: "90%",
  },
  expenseModalTitle: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },
  inputLabel: {
    color: "#8E8E93",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 10,
  },
  textInputBox: {
    backgroundColor: "#121212",
    color: "#FFF",
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#2C2C2E",
  },
  datePickerInput: {
    backgroundColor: "#121212",
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#2C2C2E",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pillBtn: {
    padding: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: 10,
    borderColor: "#2C2C2E",
    backgroundColor: "#1C1C1E",
  },
  pillBtnActive: {
    borderColor: "#0A84FF",
    backgroundColor: "rgba(10,132,255,0.2)",
  },
  toggleRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 15,
  },
  toggleBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtnCancel: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    backgroundColor: "#2C2C2E",
    alignItems: "center",
  },
  actionBtnSave: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    backgroundColor: "#37bb0e",
    alignItems: "center",
  },
});
