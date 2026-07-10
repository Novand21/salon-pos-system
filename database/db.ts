import * as SQLite from "expo-sqlite";

// This creates a file called 'salonpos.db' hidden on the device.
// If it already exists, it just opens it.
export const db = SQLite.openDatabaseSync("salonpos.db");

try {
  db.execSync("PRAGMA foreign_keys = ON;");
} catch (e) {
  console.error("Failed to enable foreign keys:", e);
}

// we run this function when the app starts to ensure our table exists

export const initDB = () => {
  // anonymous function to initialize table
  try {
    // db.execSync(`
    //             DROP TABLE IF EXISTS Employees;
    //             DROP TABLE IF EXISTS Services_Products;
    //             DROP TABLE IF EXISTS Add_Ons;
    //             DROP TABLE IF EXISTS Transactions;
    //             DROP TABLE IF EXISTS Transaction_Items;
    //             DROP TABLE IF EXISTS Expenditures;
    //     `);
    db.execSync(`
            -- TABLE 1: the main menu (Haircuts, Coffee, Products)
            CREATE TABLE IF NOT EXISTS Services_Products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                base_price INTEGER NOT NULL,
                description TEXT,
                add_ons TEXT
            );

            -- TABLE 2: Optional add-ons
            CREATE TABLE IF NOT EXISTS Add_Ons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                service_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                additional_price INTEGER NOT NULL,
                FOREIGN KEY(service_id) REFERENCES Services_Products(id) ON DELETE CASCADE
            );
            -- TABLE 3: Staff and Employees
            CREATE TABLE IF NOT EXISTS Employees (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                role TEXT NOT NULL,
                commision_rate REAL DEFAULT 0.10,
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

    // new version
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

    console.log("Database ready at version:", currentVersion);
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
