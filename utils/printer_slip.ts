// The Word Wrap Engine
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

// Centering
const centerText = (text: string): string => {
  const lines = chunkText(text, 32);
  let result = "";
  lines.forEach((line) => {
    const padding = Math.floor((32 - line.length) / 2);
    result += " ".repeat(Math.max(0, padding)) + line + "\n";
  });
  return result;
};

// Upgraded Left/Right alignment (Wraps the left text automatically)
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
  // If the text is longer than the line, just return it
  if (text.length >= width) return text.substring(0, width) + "\n";

  const padding = width - text.length;
  return " ".repeat(padding) + text + "\n";
};

// Currency Formatter Helper
const formatRp = (num: number | string): string => {
  const val = Number(num);
  return isNaN(val) ? "0" : val.toLocaleString("id-ID");
};

// The Main Engine
export const generateSalarySlipString = (
  staffName: string,
  baseSalary: number,
  menuBonus: number,
  uangMakan: number,
  uangMakanDays: number,
  ekstraTelat: number,
  netLemburMins: number,
  penjualan: number,
  izinDays: number,
  kasbon: number,
  dateStart?: Date,
  dateEnd?: Date,
): string => {
  let receipt = "";
  const solidDivider = "================================\n";
  const dashedDivider = "- - - - - - - - - - - - - - - -\n";

  // Header
  receipt += centerText("D'FFOND SALON");
  receipt += centerText("Jl. Dago Pojok No.16, Dago");
  receipt += centerText("Kec. Coblong, Kota Bandung");
  receipt += centerText("Jawa Barat 40135");
  receipt += centerText("+6281320522282");
  receipt += solidDivider;

  // Title & Period
  receipt += centerText("SLIP GAJI");
  if (dateStart && dateEnd) {
    receipt += centerText(
      `${dateStart.toLocaleDateString("id-ID")} - ${dateEnd.toLocaleDateString("id-ID")}`,
    );
  }
  receipt += solidDivider;

  // Ensure Kasbon is treated as a positive absolute number for subtraction display
  const absKasbon = Math.abs(Number(kasbon) || 0);

  // Calculate the intermediate Total (Everything before Kasbon)
  const totalPendapatan =
    Number(baseSalary || 0) +
    Number(menuBonus || 0) +
    Number(uangMakan || 0) +
    Number(ekstraTelat || 0) +
    Number(penjualan || 0);

  // Calculate Final Take-Home Pay (Sisa)
  const sisa = totalPendapatan - absKasbon;

  // Body Details
  receipt += leftRightText("NAMA:", staffName);
  receipt += dashedDivider;
  receipt += leftRightText("GAJI:", `Rp${formatRp(baseSalary)}`);
  receipt += leftRightText("BONUS:", `Rp${formatRp(menuBonus)}`);
  receipt += leftRightText(
    `UM (${uangMakanDays} Hari):`,
    `Rp${formatRp(uangMakan)}`,
  );

  // Format Ekstra/Telat carefully in case it's a negative penalty
  const absLemburMins = Math.abs(netLemburMins);
  const lemburHours = Math.floor(absLemburMins / 60);
  const lemburMinsStr = absLemburMins % 60;
  const timeLabel = `${lemburHours}j ${lemburMinsStr}m`;
  if (ekstraTelat < 0) {
    receipt += leftRightText(
      `Telat (-${timeLabel}):`,
      `-Rp${formatRp(Math.abs(ekstraTelat))}`,
    );
  } else {
    receipt += leftRightText(
      `Lembur (+${timeLabel}):`,
      `Rp${formatRp(ekstraTelat)}`,
    );
  }

  receipt += leftRightText("Penjualan:", `Rp${formatRp(penjualan)}`);

  if (izinDays > 0) {
    leftRightText("Izin:", `${izinDays} Hari`);
  }

  receipt += dashedDivider;

  // Totals
  receipt += leftRightText("TOTAL:", `Rp${formatRp(totalPendapatan)}`);
  receipt += leftRightText("KASBON:", `-Rp${formatRp(absKasbon)}`);

  receipt += solidDivider;
  receipt += leftRightText("SISA:", `Rp${formatRp(sisa)}`);
  receipt += solidDivider;
  receipt += "\n\n";

  // Footer
  // receipt += "\n" + centerText("Terima Kasih Atas");
  // receipt += centerText("Kerja Keras Anda!");
  // receipt += "\n\n\n";

  return receipt;
};
