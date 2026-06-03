const express = require('express');
const router  = express.Router();
const prisma = require('../prisma');

// ── Middleware: pastikan user adalah admin ──────────────────
// Sesuaikan dengan middleware auth yang sudah ada di project kamu
// Contoh: const { authMiddleware, adminOnly } = require('../middleware/auth');
// router.use(authMiddleware, adminOnly);

// ─── Helper normalize no. HP ───────────────────────────────
function normalizePhone(phone) {
  let p = (phone || '').toString().replace(/[\s\-().]/g, '');
  if (p.startsWith('+62')) p = '0' + p.slice(3);
  if (p.startsWith('62') && p.length > 10) p = '0' + p.slice(2);
  return p;
}

// ══════════════════════════════════════════════════════════════
// GET /api/admin/customer-registry
// List semua registri, beserta statistik
// ══════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const { search, status } = req.query;

    const where = {};
    if (search) {
      where.OR = [
        { name : { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } }
      ];
    }
    if (status === 'used')   where.isUsed = true;
    if (status === 'unused') where.isUsed = false;

    const [registry, total, used, unused] = await Promise.all([
      prisma.customerRegistry.findMany({
        where,
        orderBy: { importedAt: 'desc' }
      }),
      prisma.customerRegistry.count(),
      prisma.customerRegistry.count({ where: { isUsed: true  } }),
      prisma.customerRegistry.count({ where: { isUsed: false } })
    ]);

    return res.json({ registry, total, used, unused });
  } catch (err) {
    console.error('[registry GET]', err);
    return res.status(500).json({ error: 'Gagal memuat data registri' });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/admin/customer-registry
// Tambah satu entri manual
// Body: { name, phone, address?, note? }
// ══════════════════════════════════════════════════════════════
router.post('/', async (req, res) => {
  try {
    const { name, phone: rawPhone, address, note } = req.body;

    if (!name || !rawPhone) {
      return res.status(400).json({ error: 'Nama dan No. HP wajib diisi' });
    }

    const phone = normalizePhone(rawPhone);

    if (!/^0[0-9]{8,13}$/.test(phone)) {
      return res.status(400).json({ error: 'Format No. HP tidak valid' });
    }

    const entry = await prisma.customerRegistry.create({
      data: {
        name   : name.trim(),
        phone,
        address: address?.trim() || null,
        note   : note?.trim()    || null
      }
    });

    return res.status(201).json({
      success: true,
      message: `Registri "${name}" berhasil ditambahkan`,
      entry
    });

  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'No. HP sudah ada di registri' });
    }
    console.error('[registry POST]', err);
    return res.status(500).json({ error: 'Gagal menambah registri' });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/admin/customer-registry/import
// Import batch dari CSV (sudah diparse di frontend)
// Body: { rows: [{ name, phone, address }] }
// ══════════════════════════════════════════════════════════════
router.post('/import', async (req, res) => {
  try {
    const { rows } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Tidak ada data yang dikirim' });
    }
    if (rows.length > 500) {
      return res.status(400).json({ error: 'Maksimal 500 baris per import' });
    }

    let imported = 0;
    let updated  = 0;
    let failed   = 0;
    const failedRows = [];

    for (const row of rows) {
      try {
        if (!row.name || !row.phone) { failed++; continue; }

        const phone = normalizePhone(row.phone);
        if (!/^0[0-9]{8,13}$/.test(phone)) { failed++; continue; }

        // Upsert: jika no. HP sudah ada → update nama & alamat
        // jika belum → insert baru
        const existing = await prisma.customerRegistry.findUnique({ where: { phone } });

        if (existing) {
          if (!existing.isUsed) {
            // Hanya update jika belum dipakai (jangan overwrite yang sudah daftar)
            await prisma.customerRegistry.update({
              where: { phone },
              data : { name: row.name.trim(), address: row.address?.trim() || null }
            });
            updated++;
          } else {
            // Sudah dipakai, lewati
            updated++;
          }
        } else {
          await prisma.customerRegistry.create({
            data: {
              name   : row.name.trim(),
              phone,
              address: row.address?.trim() || null
            }
          });
          imported++;
        }
      } catch (rowErr) {
        failed++;
        failedRows.push({ phone: row.phone, error: rowErr.message });
      }
    }

    console.log(`[Registry Import] ✅ imported=${imported} updated=${updated} failed=${failed}`);

    return res.json({
      success : true,
      imported,
      updated,
      failed,
      failedRows: failedRows.slice(0, 20),
      message : `${imported} data baru, ${updated} diperbarui, ${failed} gagal.`
    });

  } catch (err) {
    console.error('[registry import]', err);
    return res.status(500).json({ error: 'Gagal mengimport data' });
  }
});

// ══════════════════════════════════════════════════════════════
// PATCH /api/admin/customer-registry/:id
// Update entri (hanya yang belum dipakai)
// Body: { name?, phone?, address?, note? }
// ══════════════════════════════════════════════════════════════
router.patch('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, phone: rawPhone, address, note } = req.body;

    const existing = await prisma.customerRegistry.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Registri tidak ditemukan' });
    }
    if (existing.isUsed) {
      return res.status(403).json({
        error: 'Tidak bisa mengedit registri yang sudah digunakan pelanggan'
      });
    }

    const updateData = {};
    if (name)     updateData.name    = name.trim();
    if (rawPhone) updateData.phone   = normalizePhone(rawPhone);
    if (address !== undefined) updateData.address = address?.trim() || null;
    if (note    !== undefined) updateData.note    = note?.trim()    || null;

    const updated = await prisma.customerRegistry.update({
      where: { id },
      data : updateData
    });

    return res.json({ success: true, message: 'Registri berhasil diperbarui', entry: updated });

  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'No. HP sudah ada di registri lain' });
    }
    console.error('[registry PATCH]', err);
    return res.status(500).json({ error: 'Gagal memperbarui registri' });
  }
});

// ══════════════════════════════════════════════════════════════
// DELETE /api/admin/customer-registry/:id
// Hapus entri (hanya yang belum dipakai)
// ══════════════════════════════════════════════════════════════
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const existing = await prisma.customerRegistry.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Registri tidak ditemukan' });
    }
    if (existing.isUsed) {
      return res.status(403).json({
        error: 'Tidak bisa menghapus registri yang sudah digunakan pelanggan'
      });
    }

    await prisma.customerRegistry.delete({ where: { id } });
    return res.json({ success: true, message: `Registri "${existing.name}" berhasil dihapus` });

  } catch (err) {
    console.error('[registry DELETE]', err);
    return res.status(500).json({ error: 'Gagal menghapus registri' });
  }
});

module.exports = router;