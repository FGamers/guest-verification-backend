import mysql from "mysql2/promise"

// Fungsi untuk membuat koneksi ke database
async function createConnection() {
  try {
    // Ganti dengan kredensial Railway MySQL Anda
    const connection = await mysql.createConnection({
      host: process.env.RAILWAY_MYSQL_HOST,
      user: process.env.RAILWAY_MYSQL_USER,
      password: process.env.RAILWAY_MYSQL_PASSWORD,
      database: process.env.RAILWAY_MYSQL_DATABASE,
      port: process.env.RAILWAY_MYSQL_PORT || 3306,
      ssl: {
        rejectUnauthorized: true,
      },
    })

    console.log("Berhasil terhubung ke database MySQL di Railway!")
    return connection
  } catch (error) {
    console.error("Gagal terhubung ke database:", error)
    throw error
  }
}

// Fungsi untuk membuat tabel yang diperlukan
async function setupDatabase() {
  let connection

  try {
    connection = await createConnection()

    // Buat tabel admin
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log("Tabel admin_users berhasil dibuat atau sudah ada")

    // Buat tabel tamu
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS guests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) NOT NULL UNIQUE,
        verified BOOLEAN DEFAULT FALSE,
        verified_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log("Tabel guests berhasil dibuat atau sudah ada")

    // Tambahkan admin default jika belum ada
    const [adminRows] = await connection.execute("SELECT * FROM admin_users")
    if (adminRows.length === 0) {
      // Dalam produksi, gunakan bcrypt untuk hash password
      await connection.execute(
        "INSERT INTO admin_users (username, password) VALUES (?, ?)",
        ["sma9user", "sma9admin"], // Gunakan password yang sama dengan yang ada di kode asli
      )
      console.log("Admin default berhasil ditambahkan")
    }

    console.log("Setup database selesai!")
  } catch (error) {
    console.error("Error saat setup database:", error)
  } finally {
    if (connection) {
      await connection.end()
      console.log("Koneksi database ditutup")
    }
  }
}

// Jalankan setup database
setupDatabase()
