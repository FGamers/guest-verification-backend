import mysql from "mysql2/promise"
import fs from "fs"

// Fungsi untuk membersihkan format nomor telepon
function cleanPhoneNumber(phone) {
  // Menghapus semua karakter non-digit
  phone = phone.replace(/\D/g, "")

  // Jika nomor dimulai dengan '62', ganti dengan '0'
  if (phone.startsWith("62")) {
    phone = "0" + phone.substring(2)
  }

  return phone
}

// Fungsi untuk mengimpor data dari localStorage ke database
async function importDataFromJson() {
  let connection

  try {
    // Baca file JSON (misalnya dari export localStorage)
    // Ganti path file sesuai dengan lokasi file Anda
    const jsonData = fs.readFileSync("./guest-data.json", "utf8")
    const guestData = JSON.parse(jsonData)

    // Buat koneksi ke database
    connection = await mysql.createConnection({
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

    // Impor data tamu
    for (const guest of guestData) {
      const cleanedPhone = cleanPhoneNumber(guest.phone)

      // Cek apakah tamu sudah ada di database
      const [existingGuests] = await connection.execute("SELECT * FROM guests WHERE phone = ?", [cleanedPhone])

      if (existingGuests.length === 0) {
        // Tambahkan tamu baru
        await connection.execute("INSERT INTO guests (name, phone, verified, verified_at) VALUES (?, ?, ?, ?)", [
          guest.name,
          cleanedPhone,
          guest.verified ? 1 : 0,
          guest.verifiedAt ? new Date(guest.verifiedAt) : null,
        ])
        console.log(`Tamu ${guest.name} berhasil ditambahkan`)
      } else {
        console.log(`Tamu dengan nomor ${cleanedPhone} sudah ada di database`)
      }
    }

    console.log("Import data selesai!")
  } catch (error) {
    console.error("Error saat mengimpor data:", error)
  } finally {
    if (connection) {
      await connection.end()
      console.log("Koneksi database ditutup")
    }
  }
}

// Contoh data hardcoded jika tidak ada file JSON
const sampleData = [
  { id: 1, phone: "08123456789", name: "Budi Santoso", verified: false, verifiedAt: null },
  { id: 2, phone: "081234567890", name: "Siti Rahayu", verified: false, verifiedAt: null },
  { id: 3, phone: "08987654321", name: "Ahmad Hidayat", verified: false, verifiedAt: null },
  { id: 4, phone: "085726918964", name: "Dewi Lestari", verified: false, verifiedAt: null },
  { id: 5, phone: "088238639490", name: "Joko Widodo", verified: false, verifiedAt: null },
]

// Fungsi untuk mengimpor data sample
async function importSampleData() {
  let connection

  try {
    // Buat koneksi ke database
    connection = await mysql.createConnection({
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

    // Cek apakah tabel sudah berisi data
    const [existingGuests] = await connection.execute("SELECT * FROM guests")

    if (existingGuests.length === 0) {
      // Impor data sample
      for (const guest of sampleData) {
        const cleanedPhone = cleanPhoneNumber(guest.phone)

        await connection.execute("INSERT INTO guests (name, phone, verified, verified_at) VALUES (?, ?, ?, ?)", [
          guest.name,
          cleanedPhone,
          guest.verified ? 1 : 0,
          guest.verifiedAt ? new Date(guest.verifiedAt) : null,
        ])
      }

      console.log(`${sampleData.length} data sample berhasil ditambahkan`)
    } else {
      console.log("Database sudah berisi data, tidak perlu menambahkan data sample")
    }
  } catch (error) {
    console.error("Error saat mengimpor data sample:", error)
  } finally {
    if (connection) {
      await connection.end()
      console.log("Koneksi database ditutup")
    }
  }
}

// Coba impor dari file JSON, jika gagal gunakan data sample
try {
  if (fs.existsSync("./guest-data.json")) {
    importDataFromJson()
  } else {
    console.log("File guest-data.json tidak ditemukan, menggunakan data sample")
    importSampleData()
  }
} catch (error) {
  console.error("Error:", error)
  importSampleData()
}
