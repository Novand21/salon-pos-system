import { BLEPrinter } from "react-native-thermal-receipt-printer-image-qr";
import { LOGO_BASE64 } from "./logo";

export const fetchPairedPrinters = async () => {
  try {
    // Natively start the printer engine (this triggers Android's internal systems automatically)
    await BLEPrinter.init();
    const devices = await BLEPrinter.getDeviceList();

    return devices.map((device: any) => ({
      name: device.device_name || "Unknown Printer",
      address: device.inner_mac_address || device.address,
    }));
  } catch (error) {
    console.error("Error fetching printers: ", error);
    alert("Tolong pastikan bluetooth aktif!");
    return [];
  }
};

export const connectToPrinter = async (macAddress: string) => {
  try {
    await BLEPrinter.connectPrinter(macAddress);
    return true;
  } catch (error) {
    console.error("Failed to connect to printer: ", error);
    return false;
  }
};

export const printReceiptRaw = async (text: string) => {
  try {
    // Attempt to wake up the Bluetooth engine first.
    // If Bluetooth is turned off, this will fail safely and trigger the catch block.
    try {
      await BLEPrinter.init();
    } catch (initError) {
      console.error(
        "Bluetooth is off or printer engine failed to start: ",
        initError,
      );
      return false; // Abort immediately so it doesn't crash!
    }

    // Print the Image First
    // This library's Java side will handle the chunking safely!
    await BLEPrinter.printImageBase64(LOGO_BASE64, { imageWidth: 200 });

    // Print the Receipt Text directly underneath it
    await BLEPrinter.printText(text);

    return true;
  } catch (error) {
    console.error("Failed to print: ", error);
    return false;
  }
};
