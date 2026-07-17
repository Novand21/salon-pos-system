// 1. The Word Wrap Engine
const chunkText = (text: string, maxLength: number): string[] => {
  if (!text) return [];
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word) => {
    // Force-split single words that are longer than the entire paper
    if (word.length > maxLength) {
      if (currentLine) lines.push(currentLine.trim());
      for (let i = 0; i < word.length; i += maxLength) {
        lines.push(word.substring(i, i + maxLength));
      }
      currentLine = "";
    } else if ((currentLine + word).length > maxLength) {
      // Line is full, push it and start a new one
      lines.push(currentLine.trim());
      currentLine = word + " ";
    } else {
      // Keep adding words to the current line
      currentLine += word + " ";
    }
  });

  if (currentLine.trim()) lines.push(currentLine.trim());
  return lines;
};

// 2. Upgraded Centering (Now supports wrapping)
const centerText = (text: string): string => {
  const lines = chunkText(text, 32);
  let result = "";
  lines.forEach((line) => {
    const padding = Math.floor((32 - line.length) / 2);
    result += " ".repeat(Math.max(0, padding)) + line + "\n";
  });
  return result;
};

// 3. Upgraded Left/Right alignment (Wraps the left text automatically)
const leftRightText = (left: string, right: string): string => {
  const maxLeftLength = 32 - right.length - 1; // Leave 1 space gap
  const leftLines = chunkText(left, maxLeftLength);

  if (leftLines.length === 0) {
    const spaces = 32 - right.length;
    return " ".repeat(Math.max(1, spaces)) + right + "\n";
  }

  let result = "";
  for (let i = 0; i < leftLines.length; i++) {
    if (i === leftLines.length - 1) {
      // The final line gets the price attached to the right edge
      const spaces = 32 - leftLines[i].length - right.length;
      result += leftLines[i] + " ".repeat(Math.max(1, spaces)) + right + "\n";
    } else {
      // The preceding lines print normally on the left
      result += leftLines[i] + "\n";
    }
  }
  return result;
};

// Helper to align text to the right for a 32-character line
export const rightAlign = (text: string): string => {
  const width = 32;
  // If the text is longer than the line, just return it (or truncate it if you prefer)
  if (text.length >= width) return text.substring(0, width) + "\n";

  const padding = width - text.length;
  return " ".repeat(padding) + text + "\n";
};

// Currency Formatter Helper
const formatRp = (num: number | string): string => {
  const val = Number(num);
  return isNaN(val) ? "0" : val.toLocaleString("id-ID");
};

// Helper function to force the printer to draw a QR code natively
const getQRCodeCommand = (url: string, size: number = 4) => {
  const storeLen = url.length + 3;
  const pL = String.fromCharCode(storeLen % 256);
  const pH = String.fromCharCode(Math.floor(storeLen / 256));

  // Convert the size number into a raw byte character (Valid range: 1 to 16)
  const sizeChar = String.fromCharCode(size);

  let qrCmd = "";

  // 1. Select QR Model (\x41)
  qrCmd += "\x1D\x28\x6B\x04\x00\x31\x41\x32\x00";

  // 2. Set Module Size (\x43)
  qrCmd += "\x1D\x28\x6B\x03\x00\x31\x43" + sizeChar;

  // 3. Set Error Correction Level (\x45)
  qrCmd += "\x1D\x28\x6B\x03\x00\x31\x45\x32";

  // 4. Store the URL data (\x50)
  qrCmd += "\x1D\x28\x6B" + pL + pH + "\x31\x50\x30" + url;

  // 5. Print the QR code (\x51)
  qrCmd += "\x1D\x28\x6B\x03\x00\x31\x51\x30";

  return qrCmd;
};

// The Main Engine
export const generateThermalReceiptString = (
  transactionId: number | string,
  queueNumber: number,
  cart: any[],
  cartTotal: number,
  paymentMethod: string,
  cashier: string,
  amountTendered: string | number,
  change: string | number,
  transactionTimestamp?: string,
): string => {
  let receipt = "";
  const solidDivider = "================================\n";
  const dashedDivider = "- - - - - - - - - - - - - - - -\n";
  const receiptDate = transactionTimestamp
    ? new Date(transactionTimestamp)
    : new Date();

  receipt += centerText("D'FFOND SALON");
  receipt += centerText("Jl. Dago Pojok No.16, Dago");
  receipt += centerText("Kec. Coblong, Kota Bandung");
  receipt += centerText("Jawa Barat 40135");
  receipt += centerText("+6281320522282");
  receipt += solidDivider;

  receipt += `No Urut : ${queueNumber}\n`;
  receipt += `Trx ID  : ${transactionId}\n`;
  receipt += `Kasir   : ${cashier}\n`;
  receipt += `Waktu   : ${receiptDate.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}\n`;
  receipt += solidDivider;

  cart.forEach((item, index) => {
    // 1. Item Name and Base Price quantity
    const nameLines = chunkText(item.name, 32);
    const addOnsTotal = 0;
    nameLines.forEach((line) => (receipt += `${line}\n`));
    const qtyText = rightAlign(`${item.quantity} x Rp${formatRp(item.price)}`);
    receipt += qtyText;

    // 2. Stylists
    if (item.stylists && item.stylists.length > 0) {
      const stylistText = `  @${item.stylists.join(", ")}`;
      const stylistLines = chunkText(stylistText, 32);
      stylistLines.forEach((line) => (receipt += `${line}\n`));
    }

    // 3. Add-ons (Indented deeper with 4 spaces)
    if (item.selectedAddOns && item.selectedAddOns.length > 0) {
      item.selectedAddOns.forEach((addon: any) => {
        receipt += leftRightText(
          `    + ${addon.name}`,
          addon.price <= 0 ? "" : `Rp${formatRp(addon.price)}`,
        );
      });
    }

    // 4. Discounts (Shows percentage and exact amount deducted)
    if (item.discountPercent > 0) {
      const desc = item.discountDesc ? ` (${item.discountDesc})` : "";
      const discText = `  Disc ${item.discountPercent}%${desc}`;

      // 1. Sum up all add-ons for this item
      const addOnsTotal =
        item.selectedAddOns && item.selectedAddOns.length > 0
          ? item.selectedAddOns.reduce(
              (sum: number, addon: any) => sum + addon.price,
              0,
            )
          : 0;

      // 2. Combine base price + add-ons
      const basePriceWithAddons = item.price + addOnsTotal;

      // 3. Calculate exact nominal discount subtracted
      const discountNominal = Math.round(
        basePriceWithAddons * item.quantity * (item.discountPercent / 100),
      );

      receipt += leftRightText(discText, `-Rp${formatRp(discountNominal)}`);
    }

    if (item.customerNote) {
      const noteLines = chunkText(`Catatan: ${item.customerNote}`, 32);
      noteLines.forEach((line) => (receipt += `${line}\n`));
    }

    // 5. Subtotal

    const subtotalText = `Subtotal: Rp${formatRp(item.itemTotal)}`;
    receipt += "\n";
    receipt += rightAlign(subtotalText);

    // 6. Straight Line Separator between items (but not at the very end)
    if (index < cart.length - 1) {
      receipt += dashedDivider;
    }
  });

  receipt += solidDivider;
  receipt += leftRightText("TOTAL:", `Rp${formatRp(cartTotal)}`);
  receipt += leftRightText(
    `Bayar (${paymentMethod}):`,
    `Rp${formatRp(amountTendered)}`,
  );

  if (Number(change) > 0) {
    receipt += leftRightText("Kembali:", `Rp${formatRp(change)}`);
  }
  receipt += solidDivider;

  receipt += "\x1B\x61\x01"; // Center align
  // Trigger the built-in QR Code!
  receipt += getQRCodeCommand("https://www.instagram.com/dffondsalon");
  receipt += "\n" + centerText("Kritik dan Saran");
  receipt += centerText("@dffondsalon");
  receipt += centerText("Terima Kasih Atas");
  receipt += centerText("Kunjungan Anda!");
  receipt += "\n\n";

  return receipt;
};
