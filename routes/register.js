const express = require('express');
const bcrypt  = require('bcryptjs');
const router  = express.Router();
const prisma = require('../prisma');

// ─── Helper: normalize nomor HP ───────────────────────────
// "0812-3456-7890" → "081234567890"
// "+6281234567890" → "081234567890"
function normalizePhone(phone) {
  let p = phone.replace(/[\s\-().]/g, '');
  if (p.startsWith('+62')) p = '0' + p.slice(3);
  if (p.startsWith('62'))  p = '0' + p.slice(2);
  return p;
}

// ══════════════════════════════════════════════════════════════
// GET /api/register/validate-phone?phone=08xxx
// Cek apakah no. HP ada di CustomerRegistry dan belum dipakai
// ══════════════════════════════════════════════════════════════
router.get('/validate-phone', async (req, res) => {
  try {
    const rawPhone = (req.query.phone || '').trim();
    if (!rawPhone) {
      return res.status(400).json({ error: 'No. Handphone wajib diisi' });
    }

    const phone = normalizePhone(rawPhone);

    // Cari di CustomerRegistry
    const entry = await prisma.customerRegistry.findUnique({
      where: { phone }
    });

    if (!entry) {
      return res.status(404).json({
        error: 'Nomor HP tidak terdaftar sebagai pelanggan Jagonet. '
             + 'Hubungi admin untuk mendaftarkan nomor Anda.'
      });
    }

    if (entry.isUsed) {
      return res.status(409).json({
        error: 'Nomor HP ini sudah digunakan untuk membuat akun. '
             + 'Silakan login atau hubungi admin jika lupa password.'
      });
    }

    // Lolos validasi — kembalikan info dari registry (untuk auto-fill form)
    return res.json({
      valid  : true,
      name   : entry.name,
      address: entry.address || ''
    });

  } catch (err) {
    console.error('[validate-phone]', err);
    return res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/register
// Buat akun pelanggan baru (sudah divalidasi via no. HP)
// Body: { phone, username, name, address, password }
// ══════════════════════════════════════════════════════════════
router.post('/', async (req, res) => {
  try {
    const { phone: rawPhone, username, name, address, password } = req.body;

    // ── Validasi input ──
    if (!rawPhone || !username || !name || !password) {
      return res.status(400).json({
        error: 'No. HP, username, nama, dan password wajib diisi'
      });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password minimal 6 karakter' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({
        error: 'Username hanya boleh huruf, angka, dan underscore'
      });
    }
    if (username.length < 4) {
      return res.status(400).json({ error: 'Username minimal 4 karakter' });
    }

    const phone = normalizePhone(rawPhone);

    // ── Validasi CustomerRegistry (double-check) ──
    const entry = await prisma.customerRegistry.findUnique({ where: { phone } });
    if (!entry) {
      return res.status(403).json({
        error: 'Nomor HP tidak terdaftar. Pendaftaran ditolak.'
      });
    }
    if (entry.isUsed) {
      return res.status(409).json({
        error: 'Nomor HP sudah digunakan untuk akun lain.'
      });
    }

    // ── Cek username tidak duplikat ──
    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      return res.status(409).json({ error: 'Username sudah digunakan, pilih username lain.' });
    }

    // ── Hash password & buat user ──
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        name    : name.trim() || entry.name,
        phone,
        address : (address || entry.address || '').trim() || null,
        password: hashedPassword,
        role    : 'customer',
        status  : 'active',  // langsung aktif karena no. HP sudah terverifikasi admin
      }
    });

    // ── Tandai registry sebagai sudah digunakan ──
    await prisma.customerRegistry.update({
      where: { phone },
      data : {
        isUsed      : true,
        usedByUserId: user.id,
        usedAt      : new Date()
      }
    });

    console.log(`[Register] ✅ User baru: ${username} (${phone})`);

    return res.status(201).json({
      success: true,
      message: 'Registrasi berhasil! Silakan login.'
    });

  } catch (err) {
    console.error('[register]', err);
    if (err.code === 'P2002') {
      const field = err.meta?.target?.includes('username') ? 'Username' : 'No. HP';
      return res.status(409).json({ error: `${field} sudah terdaftar.` });
    }
    return res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

module.exports = router;