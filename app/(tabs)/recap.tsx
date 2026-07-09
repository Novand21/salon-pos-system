import React, { useCallback, useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { db } from "@/database/db";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { printReceiptRaw } from "../../utils/bluetooth";
import { generateThermalReceiptString } from "../../utils/printer";

export default function RecapScreen() {
  const insets = useSafeAreaInsets();
  // --- NEW DATE RANGE STATES ---
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [activePicker, setActivePicker] = useState<"start" | "end" | null>(
    null,
  );

  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [ledgerData, setLedgerData] = useState<any[]>([]);
  const [receiptItems, setReceiptItems] = useState<any[]>([]);

  const [staffList, setStaffList] = useState<any[]>([]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseStaff, setExpenseStaff] = useState("");

  // ==========================================
  // DATE RANGE NAVIGATION FUNCTIONS
  // ==========================================
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

  // ==========================================
  // EXPENSE & TRANSACTION LOGIC
  // ==========================================
  const handleSaveExpense = () => {
    if (!expenseDesc || !expenseAmount || !expenseStaff)
      return alert("Tolong isi seluruh deskripsi!");

    try {
      // Expenses are now logged at the exact current time they are entered
      const timestamp = new Date();
      const finalDescription = `${expenseDesc} (by ${expenseStaff})`;

      db.runSync(
        "INSERT INTO Expenditures (timestamp, description, amount) VALUES (?, ?, ?)",
        [timestamp.toISOString(), finalDescription, Number(expenseAmount)],
      );

      fetchDayData();

      setExpenseDesc("");
      setExpenseAmount("");
      setExpenseStaff("");
      setShowExpenseModal(false);
    } catch (error) {
      console.error("Error saving expense:", error);
    }
  };

  const openTransactionDetails = (tx: any) => {
    setSelectedTx(tx);
    if (tx.type === "sale") {
      try {
        const items = db.getAllSync(
          "SELECT * FROM Transaction_Items WHERE transaction_id = ?",
          [tx.dbId],
        );
        setReceiptItems(items);
      } catch (error) {
        console.error("Error fetching transaction items:", error);
      }
    } else {
      setReceiptItems([]);
    }
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
            cart_json: tx.cart_json,
          };
        });

      const expenses = db
        .getAllSync(
          "SELECT * FROM Expenditures WHERE timestamp >= ? AND timestamp <= ?",
          [startOfDay.toISOString(), endOfDay.toISOString()],
        )
        .map((exp: any) => {
          const expDate = new Date(exp.timestamp);
          return {
            id: `exp-${exp.id}`,
            type: "expense",
            title: exp.description,
            dateStr: expDate.toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
            time: expDate.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            amount: -exp.amount,
            details: exp.description,
            timestamp: exp.timestamp,
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
      fetchDayData();
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

  const handleReprint = async () => {
    if (!selectedTx || selectedTx.type !== "sale") return;

    if (!selectedTx.cart_json) {
      alert("Transaksi lama dengan data yang telah dihapus.");
      return;
    }

    try {
      const cartItems = JSON.parse(selectedTx.cart_json);
      const rawPrinterText = generateThermalReceiptString(
        selectedTx.trx_code,
        selectedTx.queue_number,
        cartItems,
        selectedTx.amount,
        selectedTx.paymentMethod,
        selectedTx.stylist,
        selectedTx.amount,
        0,
      );

      const printed = await printReceiptRaw(rawPrinterText);
      if (!printed) alert("Tidak ada printer aktif! ");
    } catch (error) {
      console.error(error);
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

        <TouchableOpacity
          style={styles.addExpenseBtn}
          onPress={() => setShowExpenseModal(true)}
        >
          <Text style={styles.textWhite}>+ Keluaran</Text>
        </TouchableOpacity>
      </View>

      {/* NATIVE CALENDAR MODAL (Forces correct minimum/maximum parameters dynamically) */}
      {activePicker && (
        <DateTimePicker
          value={activePicker === "start" ? startDate : endDate}
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

      <ScrollView contentContainerStyle={styles.listContainer}>
        <Text style={styles.sectionLabel}>BUKU KAS</Text>

        {ledgerData.length === 0 ? (
          <Text style={styles.textGrayCenter}>
            Tidak ada data transaksi pada rentang tanggal ini.
          </Text>
        ) : (
          ledgerData.map((tx) => (
            <TouchableOpacity
              key={tx.id}
              onPress={() => openTransactionDetails(tx)}
              style={styles.ledgerCard}
            >
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.ledgerTitle}>
                  <Text
                    style={
                      tx.type === "expense" ? styles.textRed : styles.textGreen
                    }
                  >
                    {tx.type === "expense" ? "↓ " : "↑ "}
                  </Text>
                  {tx.title}
                </Text>
                <Text style={styles.ledgerSubtitle}>
                  {tx.dateStr} {tx.stylist ? `• Cashier: ${tx.stylist}` : ""}
                </Text>
              </View>

              <Text
                style={[
                  styles.ledgerAmount,
                  tx.type === "expense" ? styles.textRed : styles.textGreen,
                ]}
              >
                {tx.type === "expense" ? "- Rp " : "+ Rp "}
                {Math.abs(tx.amount).toLocaleString("id-ID")}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

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
        <View style={styles.netBox}>
          <Text style={styles.netBoxLabel}>Total Penghasilan</Text>
          <Text style={styles.netBoxValue}>
            Rp {netEarning.toLocaleString("id-ID")}
          </Text>
        </View>
      </View>

      <Modal
        visible={!!selectedTx}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSelectedTx(null)}
      >
        <View
          style={[
            styles.modalOverlay,
            { paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
        >
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
                ? new Date(selectedTx.timestamp).toLocaleDateString("en-GB")
                : ""}
            </Text>
            <Text style={styles.receiptLine}>Waktu: {selectedTx?.time}</Text>
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
                {receiptItems.map((item: any) => (
                  <View
                    key={item.id}
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
                        alignItems: "flex-start",
                      }}
                    >
                      <Text
                        style={[
                          styles.receiptLine,
                          { flex: 1, fontWeight: "bold" },
                        ]}
                      >
                        {item.item_name}
                      </Text>
                    </View>

                    {item.stylists && item.stylists.length > 0 && (
                      <View style={styles.receiptRowWrap}>
                        <Text
                          style={[
                            styles.receiptTextLeftWrap,
                            { fontStyle: "italic", paddingLeft: 0 },
                          ]}
                        >
                          {item.stylists
                            .split(",")
                            .map((s: string) => `@${s.trim()}`)
                            .join(", ")}
                        </Text>
                      </View>
                    )}

                    {item.add_ons_list ? (
                      <View style={styles.receiptRowWrap}>
                        <Text
                          style={[
                            styles.receiptTextLeftWrap,
                            { paddingLeft: 10 },
                          ]}
                        >
                          + {item.add_ons_list}
                        </Text>
                      </View>
                    ) : null}

                    {item.discount_percent > 0 && (
                      <View style={styles.receiptRowWrap}>
                        <Text
                          style={[
                            styles.receiptDiscountLeftWrap,
                            { paddingLeft: 10 },
                          ]}
                        >
                          Disc {item.discount_percent}%{" "}
                          {item.discount_desc ? `(${item.discount_desc})` : ""}
                        </Text>
                      </View>
                    )}

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
                        Subtotal: Rp {item.final_price.toLocaleString("id-ID")}
                      </Text>
                    </View>
                  </View>
                ))}

                <Text style={styles.receiptDivider}>
                  --------------------------------
                </Text>
                <View style={styles.receiptRowWrap}>
                  <Text
                    style={{ color: "#000", fontSize: 14, fontWeight: "bold" }}
                  >
                    TOTAL:
                  </Text>
                  <Text
                    style={{ color: "#000", fontSize: 14, fontWeight: "bold" }}
                  >
                    Rp {selectedTx?.amount.toLocaleString("id-ID")}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginTop: 5,
                  }}
                >
                  <Text style={styles.receiptLine}>PEMBAYARAN:</Text>
                  <Text style={styles.receiptLine}>
                    {selectedTx?.paymentMethod}
                  </Text>
                </View>
              </View>
            ) : (
              <View>
                <Text style={styles.receiptBold}>PENGELUARAN</Text>
                <Text style={styles.receiptLine}>{selectedTx?.details}</Text>
                <Text style={styles.receiptBold}>
                  TOTAL: - Rp{" "}
                  {Math.abs(selectedTx?.amount || 0).toLocaleString("id-ID")}
                </Text>
              </View>
            )}

            <Text style={styles.receiptDivider}>
              --------------------------------
            </Text>
          </View>

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
          </View>
        </View>
      </Modal>

      <Modal
        visible={showExpenseModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowExpenseModal(false)}
      >
        <View
          style={[
            styles.modalOverlay,
            { paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
        >
          <View
            style={{
              backgroundColor: "#1C1C1E",
              padding: 20,
              borderRadius: 15,
              width: "90%",
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
              Tambah Pengeluaran
            </Text>

            <Text
              style={{
                color: "#8E8E93",
                fontSize: 12,
                fontWeight: "bold",
                marginBottom: 10,
              }}
            >
              NAMA
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexDirection: "row", marginBottom: 20 }}
            >
              {staffList.map((employee) => (
                <TouchableOpacity
                  key={employee.id}
                  onPress={() => setExpenseStaff(employee.name)}
                  style={{
                    padding: 10,
                    paddingHorizontal: 20,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor:
                      expenseStaff === employee.name ? "#0A84FF" : "#2C2C2E",
                    backgroundColor:
                      expenseStaff === employee.name
                        ? "rgba(10,132,255,0.2)"
                        : "#1C1C1E",
                    marginRight: 10,
                  }}
                >
                  <Text
                    style={
                      expenseStaff === employee.name
                        ? styles.textWhiteBold
                        : styles.textGray
                    }
                  >
                    {employee.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text
              style={{
                color: "#8E8E93",
                fontSize: 12,
                fontWeight: "bold",
                marginBottom: 10,
              }}
            >
              DESKRIPSI
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
              placeholder="e.g., Beli Kopi..."
              placeholderTextColor="#8E8E93"
              value={expenseDesc}
              onChangeText={setExpenseDesc}
            />

            <Text
              style={{
                color: "#8E8E93",
                fontSize: 12,
                fontWeight: "bold",
                marginBottom: 10,
              }}
            >
              JUMLAH (Rp)
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
              placeholder="0"
              placeholderTextColor="#8E8E93"
              keyboardType="numeric"
              value={expenseAmount}
              onChangeText={setExpenseAmount}
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
                onPress={() => setShowExpenseModal(false)}
              >
                <Text style={styles.textWhiteBold}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  padding: 15,
                  borderRadius: 8,
                  backgroundColor: "#37bb0e",
                  alignItems: "center",
                }}
                onPress={handleSaveExpense}
              >
                <Text style={styles.textWhiteBold}>Simpan</Text>
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
  netBoxValue: { color: "#34C759", fontSize: 24, fontWeight: "bold" },
  textWhite: { color: "#FFF" },
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
    gap: 15,
    marginTop: 30,
  },
  closeBtn: {
    backgroundColor: "#2C2C2E",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 30,
  },
  reprintBtn: {
    backgroundColor: "#34C759",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 30,
  },
});
