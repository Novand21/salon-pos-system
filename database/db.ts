import * as SQLite from "expo-sqlite";

export const db = SQLite.openDatabaseSync("salonpos.db");

try {
  db.execSync("PRAGMA foreign_keys = ON;");
} catch (e) {
  console.error("Failed to enable foreign keys:", e);
}

export const initDB = () => {
  try {
    db.execSync(`
            -- TABLE 1: the main menu (Haircuts, Coffee, Products)
            CREATE TABLE IF NOT EXISTS Services_Products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                base_price INTEGER NOT NULL,
                description TEXT,
                is_stock_enabled BOOLEAN DEFAULT 0,
                stock_quantity INTEGER DEFAULT 0,
                add_ons TEXT,
                image_uri TEXT
            );

            -- TABLE 2: Optional add-ons
            CREATE TABLE IF NOT EXISTS Add_Ons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                service_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                additional_price INTEGER NOT NULL,
                is_stock_enabled BOOLEAN DEFAULT 0,
                stock_quantity INTEGER DEFAULT 0,
                FOREIGN KEY(service_id) REFERENCES Services_Products(id) ON DELETE CASCADE
            );
            -- TABLE 3: Staff and Employees
            CREATE TABLE IF NOT EXISTS Employees (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                role TEXT NOT NULL,
                commision_rate REAL DEFAULT 0,
                is_active BOOLEAN DEFAULT 1 -- Added here so new installs create it instantly
            );

            -- TABLE 4: Receipts
            CREATE TABLE IF NOT EXISTS Transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER,
                timestamp TEXT NOT NULL,
                total_amount INTEGER NOT NULL,
                payment_method TEXT NOT NULL,
                discount_amount INTEGER DEFAULT 0,
                status TEXT DEFAULT 'completed',
                cart_json TEXT,
                queue_number INTEGER,
                trx_code TEXT,
                amount_tendered INTEGER DEFAULT 0,
                change_amount INTEGER DEFAULT 0,
                FOREIGN KEY (employee_id) REFERENCES Employees(id)
            );

            -- TABLE 5: The individual items inside a receipt
            CREATE TABLE IF NOT EXISTS Transaction_Items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id INTEGER NOT NULL,
                item_name TEXT NOT NULL,
                add_ons_list TEXT,
                stylists TEXT,
                discount_percent INTEGER,
                discount_desc TEXT,
                final_price INTEGER NOT NULL,
                FOREIGN KEY(transaction_id) REFERENCES Transactions(id)
            );

            -- TABLE 6: Expenses
            CREATE TABLE IF NOT EXISTS Expenditures (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                description TEXT NOT NULL,
                amount INTEGER NOT NULL
            );

            -- TABLE 7: Attendance
            CREATE TABLE IF NOT EXISTS Attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER,
                date TEXT,
                start_time TEXT,
                end_time TEXT,
                status TEXT,
                description TEXT,
                FOREIGN KEY (employee_id) REFERENCES Employees (id)
            );
            `);
    // Check the current version of the installed database
    const result: any = db.getFirstSync("PRAGMA user_version");
    let currentVersion = result.user_version;

    // Apply updates sequentially
    if (currentVersion === 0) {
      console.log(
        "Migrating database to version 1: Adding Staff active status...",
      );

      try {
        // ALTER the existing table to add the new feature safely
        db.execSync(`
          ALTER TABLE Employees ADD COLUMN is_active BOOLEAN DEFAULT 1;
        `);
      } catch (error) {
        // If the column already exists, just skip
        console.log("Column is_active already exists, skipping alter...");
      }

      // Update the version tracker so this only runs once
      db.execSync("PRAGMA user_version = 1;");
      currentVersion = 1;
    }

    // VERSION 2: ADDED TWO NEW COLUMNS FOR THE TRANSACTIONS TABLE -> AMOUNT_TENDERED AND CHANGE_AMOUNT
    if (currentVersion === 1) {
      console.log("Migrating database to version 2");
      try {
        db.execSync(`
          ALTER TABLE Transactions ADD COLUMN amount_tendered INTEGER DEFAULT 0;
          ALTER TABLE Transactions ADD COLUMN change_amount INTEGER DEFAULT 0;
        `);
      } catch (e) {
        console.error("Failed executing Version 2 migration", e);
      }
      db.execSync("PRAGMA user_version = 2;");
      currentVersion = 2;
      console.log("Database migrated to version 2 succesfully");
    }

    // VERSION 3: ADDED TWO NEW COLUMNS FOR THE Services_Products Table -> Invetory Tracking
    if (currentVersion === 2) {
      console.log("Migrating database to version 3: Adding Inventory Stock...");
      try {
        db.execSync(`
          ALTER TABLE Services_Products ADD COLUMN is_stock_enabled BOOLEAN DEFAULT 0;
          ALTER TABLE Services_Products ADD COLUMN stock_quantity INTEGER DEFAULT 0;
        `);
      } catch (e) {
        console.log("Stock columns already exist, skipping alter...");
      }

      db.execSync("PRAGMA user_version = 3;");
      currentVersion = 3;
      console.log("Database migrated to version 3 successfully");
    }

    console.log("Database ready at version:", currentVersion);

    // VERSION 4: ADDED MENU IMAGES COLUMN IN Services_Products TABLE
    if (currentVersion === 3) {
      console.log("Migrating database to version 4: Adding Image URI...");
      try {
        db.execSync(`ALTER TABLE Services_Products ADD COLUMN image_uri TEXT;`);
      } catch (e) {
        console.log("Image column already exists, skipping alter...");
      }

      db.execSync("PRAGMA user_version = 4;");
      currentVersion = 4;
      console.log("Database migrated to version 4 successfully");
    }

    // VERSION 5: ADDED ADD-ON INVENTORY SYSTEM
    if (currentVersion === 4) {
      console.log(
        "Migrating database to version 5: Adding Add-On Inventory...",
      );
      try {
        db.execSync(`
          ALTER TABLE Add_Ons ADD COLUMN is_stock_enabled BOOLEAN DEFAULT 0;
          ALTER TABLE Add_Ons ADD COLUMN stock_quantity INTEGER DEFAULT 0;
        `);
      } catch (e) {
        console.log("Add-on stock columns already exist, skipping alter...");
      }
      db.execSync("PRAGMA user_version = 5;");
      currentVersion = 5;
      console.log("Database migrated to version 5 successfully");
    }
  } catch (e) {
    console.error("Error initializing database:", e);
  }
};

export const seedDB = () => {
  try {
    const staffCount: any = db.getFirstSync(
      "SELECT COUNT(*) as count FROM Employees",
    );
    if (staffCount.count === 0) {
      console.log("Database empty, Seeding initial data... ");

      // inserting dummy data for testing
      db.execSync(`
                INSERT INTO Employees (name, role)
                VALUES
                ('Andre', 'Stylist'),
                ('Arlina', 'Stylist'),
                ('Wieta', 'Stylist'),
                ('Ani', 'Stylist'),
                ('Imah', 'Stylist');
            `);
      // initial salon menus
      db.execSync(`
                INSERT INTO Services_Products (id, name, category, base_price, description) VALUES
                (1, "Potong Rambut (Laki - Laki)", "Salon Menu", 50000, "-"),
                (2, "Potong Rambut (Perempuan)", "Salon Menu", 70000, "-"),
                (3, "Creambath", "Salon Menu", 90000, "-"),
                (4, "Cat Rambut", "Salon Menu", 150000, "-"),
                (5, "Coca - Cola", "Minuman", 7000, "-"),
                (6, "Pomade", "List Produk", 40000, "-"),
                (7, "Cuci Catok", "Salon Menu", 40000, "-"),
                (8, "Highlight", "Salon Menu", 40000, "-");
            `);
      // initial add ons
      db.execSync(`
                INSERT INTO Add_Ons (service_id, name, additional_price) VALUES
                (1, 'Cuci Rambut', 10000),
                (1, 'Styling', 5000),
                (2, 'Cuci Rambut', 10000),
                (2, 'Styling', 5000);
            `);

      console.log("Seeding complete! ");
    } else {
      console.log("Database already has data. Skipping...");
    }
  } catch (e) {
    console.error("Error seeding database: ", e);
  }
};
