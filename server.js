import express from "express"
import cors from "cors"
import mysql from "mysql2/promise"
import dotenv from "dotenv"
import multer from "multer"
import xlsx from "xlsx"

// Konfigurasi dotenv
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Konfigurasi multer untuk upload file
const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

// Fungsi untuk membuat koneksi ke database
async function createConnection() {
  return await mysql.createConnection({
    host: process.env.RAILWAY_MYSQL_HOST,
    user: process.env.RAILWAY_MYSQL_USER,
    password: process.env.RAILWAY_MYSQL_PASSWORD,
    database: process.env.RAILWAY_MYSQL_DATABASE,
    port: process.env.RAILWAY_MYSQL_PORT || 3306,
    ssl:
      process.env.NODE_ENV === "production"
        ? {
            rejectUnauthorized: true,
          }
        : undefined,
  })
}

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

// API Routes

// Login admin
app.post("/api/admin/login", async (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username dan password diperlukan" })
  }

  let connection

  try {
    connection = await createConnection()

    const [rows] = await connection.execute("SELECT * FROM admin_users WHERE username = ? AND password = ?", [
      username,
      password,
    ])

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: "Username atau password salah" })
    }

    // Dalam implementasi nyata, gunakan JWT untuk autentikasi
    res.json({
      success: true,
      message: "Login berhasil",
      user: { id: rows[0].id, username: rows[0].username },
    })
  } catch (error) {
    console.error("Error saat login:", error)
    res.status(500).json({ success: false, message: "Terjadi kesalahan server" })
  } finally {
    if (connection) await connection.end()
  }
})

// Mendapatkan semua tamu
app.get("/api/guests", async (req, res) => {
  let connection

  try {
    connection = await createConnection()

    const [rows] = await connection.execute("SELECT * FROM guests ORDER BY id DESC")

    res.json({ success: true, data: rows })
  } catch (error) {
    console.error("Error saat mengambil data tamu:", error)
    res.status(500).json({ success: false, message: "Terjadi kesalahan server" })
  } finally {
    if (connection) await connection.end()
  }
})

// Menambahkan tamu baru
app.post("/api/guests", async (req, res) => {
  const { name, phone } = req.body

  if (!name || !phone) {
    return res.status(400).json({ success: false, message: "Nama dan nomor telepon diperlukan" })
  }

  const cleanedPhone = cleanPhoneNumber(phone)
  let connection

  try {
    connection = await createConnection()

    // Cek apakah nomor telepon sudah ada
    const [existingGuests] = await connection.execute("SELECT * FROM guests WHERE phone = ?", [cleanedPhone])

    if (existingGuests.length > 0) {
      return res.status(400).json({ success: false, message: "Nomor telepon sudah terdaftar" })
    }

    // Tambahkan tamu baru
    const [result] = await connection.execute(
      "INSERT INTO guests (name, phone, verified, verified_at) VALUES (?, ?, ?, ?)",
      [name, cleanedPhone, false, null],
    )

    res.json({
      success: true,
      message: "Tamu berhasil ditambahkan",
      data: { id: result.insertId, name, phone: cleanedPhone, verified: false, verified_at: null },
    })
  } catch (error) {
    console.error("Error saat menambahkan tamu:", error)
    res.status(500).json({ success: false, message: "Terjadi kesalahan server" })
  } finally {
    if (connection) await connection.end()
  }
})

// Memperbarui data tamu
app.put("/api/guests/:id", async (req, res) => {
  const { id } = req.params
  const { name, phone, verified } = req.body

  if (!name || !phone) {
    return res.status(400).json({ success: false, message: "Nama dan nomor telepon diperlukan" })
  }

  const cleanedPhone = cleanPhoneNumber(phone)
  let connection

  try {
    connection = await createConnection()

    // Cek apakah nomor telepon sudah ada pada tamu lain
    const [existingGuests] = await connection.execute("SELECT * FROM guests WHERE phone = ? AND id != ?", [
      cleanedPhone,
      id,
    ])

    if (existingGuests.length > 0) {
      return res.status(400).json({ success: false, message: "Nomor telepon sudah digunakan oleh tamu lain" })
    }

    // Update data tamu
    const verifiedAt = verified ? req.body.verified_at || new Date() : null

    await connection.execute("UPDATE guests SET name = ?, phone = ?, verified = ?, verified_at = ? WHERE id = ?", [
      name,
      cleanedPhone,
      verified ? 1 : 0,
      verifiedAt,
      id,
    ])

    res.json({
      success: true,
      message: "Data tamu berhasil diperbarui",
      data: { id, name, phone: cleanedPhone, verified, verified_at: verifiedAt },
    })
  } catch (error) {
    console.error("Error saat memperbarui tamu:", error)
    res.status(500).json({ success: false, message: "Terjadi kesalahan server" })
  } finally {
    if (connection) await connection.end()
  }
})

// Menghapus tamu
app.delete("/api/guests/:id", async (req, res) => {
  const { id } = req.params
  let connection

  try {
    connection = await createConnection()

    await connection.execute("DELETE FROM guests WHERE id = ?", [id])

    res.json({ success: true, message: "Tamu berhasil dihapus" })
  } catch (error) {
    console.error("Error saat menghapus tamu:", error)
    res.status(500).json({ success: false, message: "Terjadi kesalahan server" })
  } finally {
    if (connection) await connection.end()
  }
})

// Verifikasi tamu
app.post("/api/verify", async (req, res) => {
  const { name, phone } = req.body

  if (!name || !phone) {
    return res.status(400).json({ success: false, message: "Nama dan nomor telepon diperlukan" })
  }

  const cleanedPhone = cleanPhoneNumber(phone)
  let connection

  try {
    connection = await createConnection()

    // Cek apakah nomor telepon terdaftar
    const [guests] = await connection.execute("SELECT * FROM guests WHERE phone = ?", [cleanedPhone])

    if (guests.length === 0) {
      return res.json({
        success: false,
        message: "Nomor telepon tidak terdaftar dalam daftar tamu undangan",
      })
    }

    const guest = guests[0]

    // Cek apakah sudah terverifikasi
    if (guest.verified) {
      return res.json({
        success: false,
        message: "Nomor telepon ini sudah terverifikasi sebelumnya",
        alreadyVerified: true,
      })
    }

    // Update status verifikasi
    await connection.execute("UPDATE guests SET verified = 1, verified_at = ?, name = ? WHERE id = ?", [
      new Date(),
      name,
      guest.id,
    ])

    res.json({
      success: true,
      message: "Verifikasi berhasil",
      data: {
        id: guest.id,
        name,
        phone: cleanedPhone,
        verified: true,
        verified_at: new Date(),
      },
    })
  } catch (error) {
    console.error("Error saat verifikasi tamu:", error)
    res.status(500).json({ success: false, message: "Terjadi kesalahan server" })
  } finally {
    if (connection) await connection.end()
  }
})

// Import Excel
app.post("/api/import-excel", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "File tidak ditemukan" })
  }

  let connection

  try {
    // Baca file Excel
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = xlsx.utils.sheet_to_json(worksheet)

    if (jsonData.length === 0) {
      return res.status(400).json({ success: false, message: "File Excel tidak berisi data" })
    }

    connection = await createConnection()

    // Proses data
    const results = {
      added: 0,
      skipped: 0,
    }

    for (const row of jsonData) {
      // Cek apakah row memiliki field yang diperlukan
      if (!row["Nomor Telepon"] || !row["Nama"]) {
        results.skipped++
        continue
      }

      const phone = cleanPhoneNumber(row["Nomor Telepon"].toString())
      const name = row["Nama"]
      const verified = row["Status"] === "Terverifikasi"
      const verifiedAt = verified ? new Date() : null

      // Cek apakah nomor telepon sudah ada
      const [existingGuests] = await connection.execute("SELECT * FROM guests WHERE phone = ?", [phone])

      if (existingGuests.length > 0) {
        results.skipped++
        continue
      }

      // Tambahkan tamu baru
      await connection.execute("INSERT INTO guests (name, phone, verified, verified_at) VALUES (?, ?, ?, ?)", [
        name,
        phone,
        verified ? 1 : 0,
        verifiedAt,
      ])

      results.added++
    }

    res.json({
      success: true,
      message: `Import berhasil! ${results.added} tamu ditambahkan, ${results.skipped} tamu dilewati.`,
      data: results,
    })
  } catch (error) {
    console.error("Error saat mengimpor Excel:", error)
    res.status(500).json({ success: false, message: "Terjadi kesalahan saat mengimpor file Excel" })
  } finally {
    if (connection) await connection.end()
  }
})

// Export Excel
app.get("/api/export-excel", async (req, res) => {
  let connection

  try {
    connection = await createConnection()

    const [guests] = await connection.execute("SELECT * FROM guests")

    // Format data untuk Excel
    const excelData = guests.map((guest) => {
      // Format verification time
      let verificationTime = ""
      if (guest.verified_at) {
        const date = new Date(guest.verified_at)
        verificationTime = `${date.toLocaleDateString("id-ID")} ${date.toLocaleTimeString("id-ID")}`
      }

      return {
        "Nomor Telepon": guest.phone,
        Nama: guest.name,
        Status: guest.verified ? "Terverifikasi" : "Belum Terverifikasi",
        "Waktu Verifikasi": verificationTime,
      }
    })

    // Buat workbook
    const worksheet = xlsx.utils.json_to_sheet(excelData)
    const workbook = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(workbook, worksheet, "Tamu Undangan")

    // Generate Excel file
    const excelBuffer = xlsx.write(workbook, { bookType: "xlsx", type: "buffer" })

    // Set headers
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    res.setHeader("Content-Disposition", "attachment; filename=Daftar_Tamu_Undangan.xlsx")

    // Kirim file
    res.send(Buffer.from(excelBuffer))
  } catch (error) {
    console.error("Error saat mengekspor Excel:", error)
    res.status(500).json({ success: false, message: "Terjadi kesalahan saat mengekspor file Excel" })
  } finally {
    if (connection) await connection.end()
  }
})

// Jalankan server
app.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT}`)
})
