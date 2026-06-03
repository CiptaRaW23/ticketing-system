require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-if-env-not-set';

// ==================== DATABASE ====================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
  adapter,
  log: ['warn', 'error'],
});

// ==================== EXPRESS & SOCKET.IO ====================

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE'] }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Serve uploaded photos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==================== MULTER ====================

const uploadDir = path.join(__dirname, 'uploads', 'ticket-photos');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ticketId = req.params?.id || "x";
    cb(null, `ticket-${ticketId}-${unique}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  allowed.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error('Hanya file gambar yang diizinkan'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ==================== ENUM MAPPING ====================

const STATUS_TO_PRISMA = {
  'open':        'open',
  'assigned':    'assigned',
  'in-progress': 'in_progress',
  'in_progress': 'in_progress',
  'closed':      'closed'
};

const STATUS_TO_DISPLAY = {
  'open':        'open',
  'assigned':    'assigned',
  'in_progress': 'in-progress',
  'in-progress': 'in-progress',
  'closed':      'closed'
};

const PRIORITY_TO_PRISMA = {
  'low': 'low', 'medium': 'medium', 'high': 'high'
};

const VALID_STATUSES   = Object.keys(STATUS_TO_PRISMA);
const VALID_PRIORITIES = ['low', 'medium', 'high'];

function formatTicket(ticket) {
  if (!ticket) return ticket;
  return { ...ticket, status: STATUS_TO_DISPLAY[ticket.status] || ticket.status };
}

function formatTickets(tickets) {
  return tickets.map(formatTicket);
}

// ==================== TICKET INCLUDE HELPER ====================
// [FIX #1] Centralized include — tambah currentTechnician, hapus assignedTo (tidak dipakai frontend)

const TICKET_INCLUDE_LIST = {
  messages: { orderBy: { createdAt: 'asc' } },
  user: { select: { id: true, name: true, username: true, address: true, phone: true } },
  // [FIX #5] Hapus assignedTo — tidak dirender di frontend, hanya bikin payload besar
  // assignedTo: { select: { id: true, name: true } },

  // [FIX #1] Tambah currentTechnician — data teknisi yang sedang aktif handle ticket
  currentTechnician: { select: { id: true, name: true, phone: true } },

  photos: {
    select: { id: true, url: true, caption: true, createdAt: true },
    orderBy: { createdAt: 'desc' }
  },
  visitSchedule: {
    include: { technician: { select: { id: true, name: true, phone: true } } }
  },
  assignments: {
    orderBy: { assignedAt: 'desc' },
    take: 1,
    include: { technician: { select: { id: true, name: true, phone: true } } }
  }
};

// Include lengkap untuk single ticket (GET /api/tickets/:id)
const TICKET_INCLUDE_SINGLE = {
  messages: { orderBy: { createdAt: 'asc' } },
  user: { select: { id: true, name: true, username: true, address: true, phone: true } },
  // [FIX #1] currentTechnician di single view juga
  currentTechnician: { select: { id: true, name: true, phone: true } },
  photos: {
    orderBy: { createdAt: 'asc' },
    include: { uploadedBy: { select: { id: true, name: true } } }
  },
  visitSchedule: {
    include: { technician: { select: { id: true, name: true, phone: true } } }
  },
  assignments: {
    orderBy: { assignedAt: 'desc' },
    include: { technician: { select: { id: true, name: true, phone: true } } }
  }
};

// ==================== STATIC ROUTING ====================

app.get('/', (req, res) => res.redirect('/login.html'));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html')));
app.get('/api/health', (req, res) => res.json({
  status: 'OK',
  message: 'Ticketing Server Running! 🚀',
  timestamp: new Date().toISOString()
}));

// ==================== AUTH MIDDLEWARE ====================

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token diperlukan' });
  }
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token tidak valid atau kadaluarsa' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Akses ditolak. Admin only.' });
  next();
};

const technicianOnly = (req, res, next) => {
  if (req.user.role !== 'technician')
    return res.status(403).json({ error: 'Akses ditolak. Teknisi only.' });
  next();
};

const adminOrTechnician = (req, res, next) => {
  if (!['admin', 'technician'].includes(req.user.role))
    return res.status(403).json({ error: 'Akses ditolak.' });
  next();
};

// ==================== REGISTER & REGISTRY ROUTES ====================

const registerRoute  = require('./routes/register');
const registryRoute  = require('./routes/admin.customerRegistry');

app.use('/api/register',                registerRoute);
app.use('/api/admin/customer-registry', authMiddleware, adminOnly, registryRoute);

app.post('/api/admin/customers', authMiddleware, adminOnly, async (req, res) => {
  const { username, name, password, address, phone, email, role } = req.body;
  if (!username || !password || !name)
    return res.status(400).json({ error: 'Username, nama, dan password wajib' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password minimal 6 karakter' });

  const allowedRoles = ['customer', 'technician'];
  const userRole = allowedRoles.includes(role) ? role : 'customer';

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, name, password: hashedPassword, address: address || null,
              phone: phone || null, email: email || null, role: userRole, status: 'active' },
      select: { id: true, username: true, name: true, role: true, status: true, createdAt: true }
    });
    res.status(201).json({ success: true, message: `Akun berhasil ditambahkan`, user });
  } catch (error) {
    if (error.code === 'P2002')
      return res.status(400).json({ error: 'Username sudah digunakan' });
    res.status(500).json({ error: 'Gagal tambah pelanggan' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: 'Username dan password wajib diisi' });

  try {
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user)
      return res.status(401).json({ error: 'Username atau password salah' });
    if (user.status !== 'active')
      return res.status(401).json({ error: 'Akun Anda tidak aktif. Hubungi administrator.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ error: 'Username atau password salah' });

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    }).catch(err => console.log('Failed to update lastLoginAt:', err));

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        address: user.address
      }
    });
  } catch (error) {
    console.error('Error login:', error);
    res.status(500).json({ error: 'Gagal login' });
  }
});

// ==================== USER PROFILE ROUTES ====================

app.get('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true, username: true, name: true, address: true,
        phone: true, email: true, role: true, status: true, createdAt: true
      }
    });
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data profile' });
  }
});

app.patch('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const { name, address, phone, email } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: updateData,
      select: {
        id: true, username: true, name: true,
        address: true, phone: true, email: true, role: true
      }
    });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: 'Gagal update profile' });
  }
});

app.post('/api/user/change-password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword)
      return res.status(400).json({ error: 'Password lama dan baru wajib diisi' });
    if (newPassword.length < 6)
      return res.status(400).json({ error: 'Password baru minimal 6 karakter' });

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Password lama salah' });

    await prisma.user.update({
      where: { id: req.user.userId },
      data: { password: await bcrypt.hash(newPassword, 10) }
    });
    res.json({ success: true, message: 'Password berhasil diubah' });
  } catch (error) {
    res.status(500).json({ error: 'Gagal ganti password' });
  }
});

// ==================== TICKET ROUTES ====================

app.post('/api/tickets', authMiddleware, async (req, res) => {
  try {
    const { title, description, address: inputAddress } = req.body;
    const userId = req.user.userId;

    if (!title || !description)
      return res.status(400).json({ error: 'Judul dan deskripsi wajib diisi' });

    let address = inputAddress?.trim() || null;
    if (!address) {
      const user = await prisma.user.findUnique({
        where: { id: userId }, select: { address: true }
      });
      address = user?.address || null;
    }

    let mapsLink = null;
    if (address) {
      mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
    }

    const ticket = await prisma.ticket.create({
      data: { title, description, userId, address, mapsLink, status: 'open' },
      include: {
        user: { select: { id: true, name: true, username: true, address: true } }
      }
    });

    const formatted = formatTicket(ticket);
    io.to('admin-room').emit('newTicket', formatted);
    res.status(201).json(formatted);
  } catch (error) {
    console.error('❌ Error create ticket:', error);
    res.status(500).json({ error: 'Gagal buat ticket', details: error.message });
  }
});

app.get('/api/tickets', authMiddleware, async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 50, search } = req.query;

    let whereClause = {};

    if (req.user.role === 'customer') {
      whereClause.userId = req.user.userId;
    } else if (req.user.role === 'technician') {
      whereClause.currentTechnicianId = req.user.userId;
    }

    if (status && STATUS_TO_PRISMA[status]) whereClause.status = STATUS_TO_PRISMA[status];
    if (priority && VALID_PRIORITIES.includes(priority)) whereClause.priority = priority;
    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { ticketNumber: { contains: search, mode: 'insensitive' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where: whereClause,
        skip,
        take: parseInt(limit),
        include: TICKET_INCLUDE_LIST,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.ticket.count({ where: whereClause })
    ]);

    res.json({
      success: true,
      tickets: formatTickets(tickets),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error get tickets:', error);
    res.status(500).json({ error: 'Gagal ambil tickets' });
  }
});

app.get('/api/tickets/:id', authMiddleware, async (req, res) => {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: Number(req.params.id) },
      // [FIX #1] Gunakan single include yang lengkap
      include: TICKET_INCLUDE_SINGLE
    });

    if (!ticket) return res.status(404).json({ error: 'Ticket tidak ditemukan' });

    if (req.user.role === 'customer' && ticket.userId !== req.user.userId)
      return res.status(403).json({ error: 'Akses ditolak' });

    if (req.user.role === 'technician' && ticket.currentTechnicianId !== req.user.userId)
      return res.status(403).json({ error: 'Bukan tugas Anda' });

    res.json({ success: true, ticket: formatTicket(ticket) });
  } catch (error) {
    console.error('Error ambil single ticket:', error);
    res.status(500).json({ error: 'Gagal ambil ticket' });
  }
});

app.patch('/api/tickets/:id', authMiddleware, adminOrTechnician, async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const { status, priority } = req.body;

    if (status && !VALID_STATUSES.includes(status))
      return res.status(400).json({
        error: `Status tidak valid: "${status}". Gunakan: open, assigned, in-progress, closed`
      });

    if (priority && !VALID_PRIORITIES.includes(priority))
      return res.status(400).json({
        error: `Priority tidak valid: "${priority}". Gunakan: low, medium, high`
      });

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return res.status(404).json({ error: 'Ticket tidak ditemukan' });

    if (req.user.role === 'technician') {
      if (ticket.currentTechnicianId !== req.user.userId)
        return res.status(403).json({ error: 'Bukan tugas Anda' });

      const allowedForTech = ['in-progress', 'in_progress', 'closed'];
      if (status && !allowedForTech.includes(status))
        return res.status(403).json({ error: 'Teknisi hanya bisa update ke in-progress atau closed' });
    }

    const updateData = {};

    if (status) {
      if (req.user.role === 'technician' && status === 'closed') {
        return res.status(403).json({
          error: 'Teknisi tidak bisa langsung close ticket. Gunakan endpoint /api/tickets/:id/done'
        });
      }
      updateData.status = STATUS_TO_PRISMA[status];
      if (updateData.status === 'closed') {
        updateData.closedAt   = new Date();
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = req.user.name || req.user.username;
      }
    }
    

    if (priority && req.user.role === 'admin') {
      updateData.priority = PRIORITY_TO_PRISMA[priority];
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: updateData,
      include: TICKET_INCLUDE_LIST
    });

    const formatted = formatTicket(updated);
    io.to(`ticket-${ticketId}`).emit('ticketUpdated', formatted);
    io.to('admin-room').emit('ticketUpdated', formatted);
    res.json(formatted);

  } catch (error) {
    console.error('Error update ticket:', error);
    if (error.code === 'P2025') return res.status(404).json({ error: 'Ticket tidak ditemukan' });
    res.status(500).json({ error: 'Gagal update ticket', details: error.message });
  }
});

app.delete('/api/tickets/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: Number(req.params.id) } });
    if (!ticket) return res.status(404).json({ error: 'Ticket tidak ditemukan' });

    await prisma.ticket.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true, message: 'Ticket berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ error: 'Gagal hapus ticket' });
  }
});

app.post('/api/tickets/:id/done', authMiddleware, technicianOnly, async (req, res) => {
  const ticketId = Number(req.params.id);
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        photos: true,
        user: { select: { name: true } }
      }
    });

    if (!ticket)
      return res.status(404).json({ error: 'Ticket tidak ditemukan' });
    if (ticket.currentTechnicianId !== req.user.userId)
      return res.status(403).json({ error: 'Bukan tugas Anda' });
    if (ticket.status !== 'in_progress')
      return res.status(400).json({ error: 'Ticket harus dalam status in-progress' });
    if (ticket.photos.length === 0)
      return res.status(400).json({ error: 'Kirim minimal 1 foto bukti sebelum tandai selesai' });
    if (ticket.technicianDone)
      return res.status(400).json({ error: 'Sudah menunggu konfirmasi admin' });

    // Update flag — status TETAP in_progress
    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        technicianDone:   true,
        technicianDoneAt: new Date()
      },
      include: TICKET_INCLUDE_LIST
    });

    // Kirim pesan otomatis ke chat customer
    const autoMsg = await prisma.chatMessage.create({
      data: {
        ticketId,
        sender:  'bot',
        message: `Halo ${ticket.user.name}, teknisi kami telah menyelesaikan perbaikan pada ticket ini. Apakah masalah Anda sudah tertangani? Admin kami akan segera mengkonfirmasi.`
      }
    });

    // Emit ke chat room customer
    io.to(`ticket-${ticketId}`).emit('newMessage', autoMsg);

    // Notifikasi admin
    io.to('admin-room').emit('technicianRequestClose', {
      ticketId,
      technicianName: req.user.name,
      ticket: formatTicket(updated)
    });

    res.json({
      success: true,
      message: 'Pengerjaan ditandai selesai. Menunggu konfirmasi admin.',
      ticket: formatTicket(updated)
    });
  } catch (e) {
    console.error('Error technicianDone:', e);
    res.status(500).json({ error: 'Gagal update', details: e.message });
  }
});

app.post('/api/tickets/:id/confirm', authMiddleware, adminOnly, async (req, res) => {
  const ticketId = Number(req.params.id);
  const { action } = req.body; // 'approve' atau 'reject'

  if (!['approve', 'reject'].includes(action))
    return res.status(400).json({ error: 'action harus approve atau reject' });

  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket)
      return res.status(404).json({ error: 'Ticket tidak ditemukan' });
    if (!ticket.technicianDone)
      return res.status(400).json({ error: 'Teknisi belum tandai selesai' });

    if (action === 'approve') {
      const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          status:      'closed',
          closedAt:    new Date(),
          resolvedAt:  new Date(),
          resolvedBy:  req.user.name || req.user.username,
        },
        include: TICKET_INCLUDE_LIST
      });

      const formatted = formatTicket(updated);

      // Notifikasi semua pihak
      io.to('admin-room').emit('ticketUpdated', formatted);
      io.to(`ticket-${ticketId}`).emit('ticketUpdated', formatted);
      if (ticket.currentTechnicianId) {
        io.to(`technician-${ticket.currentTechnicianId}`).emit('ticketClosed', {
          ticketId,
          message: 'Ticket berhasil dikonfirmasi selesai oleh admin'
        });
      }

      res.json({ success: true, message: 'Ticket berhasil dikonfirmasi selesai', ticket: formatted });

    } else {
      // Reject — kembalikan ke in-progress, reset flag
      const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          technicianDone:   false,
          technicianDoneAt: null,
        },
        include: TICKET_INCLUDE_LIST
      });

      const formatted = formatTicket(updated);

      io.to('admin-room').emit('ticketUpdated', formatted);

      // Beritahu teknisi
      if (ticket.currentTechnicianId) {
        io.to(`technician-${ticket.currentTechnicianId}`).emit('confirmationRejected', {
          ticketId,
          message: 'Admin meminta perbaikan lebih lanjut. Silakan lanjutkan pengerjaan.'
        });
      }

      res.json({ success: true, message: 'Permintaan selesai ditolak. Ticket kembali in-progress.', ticket: formatted });
    }
  } catch (e) {
    console.error('Error confirm ticket:', e);
    res.status(500).json({ error: 'Gagal konfirmasi', details: e.message });
  }
});

// ==================== TEKNISI MANAGEMENT ====================

app.get('/api/technicians', authMiddleware, adminOnly, async (req, res) => {
  try {
    const technicians = await prisma.user.findMany({
      where: { role: 'technician', status: 'active' },
      select: {
        id: true, name: true, username: true, phone: true, email: true
      },
      orderBy: { name: 'asc' }
    });

    const techsWithLoad = await Promise.all(technicians.map(async (tech) => {
      const activeTickets = await prisma.ticket.count({
        where: {
          currentTechnicianId: tech.id,
          status: { in: ['assigned', 'in_progress'] }
        }
      });
      return { ...tech, activeTickets };
    }));

    res.json({ success: true, technicians: techsWithLoad });
  } catch (error) {
    console.error('Error get technicians:', error);
    res.status(500).json({ error: 'Gagal ambil data teknisi' });
  }
});

// GET /api/technicians/all — Semua teknisi termasuk inactive (untuk halaman Kelola Teknisi)
app.get('/api/technicians/all', authMiddleware, adminOnly, async (req, res) => {
  try {
    const technicians = await prisma.user.findMany({
      where: { role: 'technician' },
      select: {
        id: true, name: true, username: true, phone: true, email: true,
        status: true, createdAt: true
      },
      orderBy: { name: 'asc' }
    });

    const techsWithLoad = await Promise.all(technicians.map(async (tech) => {
      const [activeTickets, totalTickets] = await Promise.all([
        prisma.ticket.count({
          where: {
            currentTechnicianId: tech.id,
            status: { in: ['assigned', 'in_progress'] }
          }
        }),
        prisma.ticketAssignment.count({
          where: { technicianId: tech.id }
        })
      ]);
      return { ...tech, activeTickets, totalTickets };
    }));

    res.json({ success: true, technicians: techsWithLoad });
  } catch (error) {
    console.error('Error get all technicians:', error);
    res.status(500).json({ error: 'Gagal ambil data teknisi' });
  }
});

// PATCH /api/technicians/:id — Update status/data teknisi
app.patch('/api/technicians/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { status, name, phone, email } = req.body;
    const updateData = {};

    if (status) {
      if (!['active', 'inactive'].includes(status))
        return res.status(400).json({ error: 'Status harus active atau inactive' });
      updateData.status = status;
    }
    if (name)             updateData.name  = name;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;

    const technician = await prisma.user.update({
      where: { id: Number(req.params.id) },
      data: updateData,
      select: {
        id: true, username: true, name: true,
        phone: true, email: true, status: true, createdAt: true
      }
    });
    res.json({ success: true, technician });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Teknisi tidak ditemukan' });
    res.status(500).json({ error: 'Gagal update teknisi' });
  }
});

// DELETE /api/technicians/:id — Hapus teknisi (dengan cek ticket aktif)
app.delete('/api/technicians/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const techId = Number(req.params.id);
    const tech = await prisma.user.findUnique({
      where: { id: techId }
    });
    if (!tech || tech.role !== 'technician')
      return res.status(404).json({ error: 'Teknisi tidak ditemukan' });

    // Cek apakah teknisi punya ticket aktif
    const activeCount = await prisma.ticket.count({
      where: {
        currentTechnicianId: techId,
        status: { in: ['assigned', 'in_progress'] }
      }
    });

    if (activeCount > 0) {
      return res.status(409).json({
        error: `Tidak bisa hapus teknisi yang masih punya ${activeCount} ticket aktif. Reassign terlebih dahulu.`,
        activeTickets: activeCount
      });
    }

    await prisma.user.delete({ where: { id: techId } });
    res.json({ success: true, message: 'Teknisi berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ error: 'Gagal hapus teknisi' });
  }
});

// ==================== ASSIGN ENDPOINTS ====================

app.post('/api/tickets/:id/assign', authMiddleware, adminOnly, async (req, res) => {
  const ticketId = Number(req.params.id);
  const { technicianId, adminNote, scheduledDate, estimatedDuration, scheduleNote } = req.body;

  if (!technicianId)
    return res.status(400).json({ error: 'technicianId wajib diisi' });

  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return res.status(404).json({ error: 'Ticket tidak ditemukan' });

    if (ticket.status === 'closed')
      return res.status(400).json({ error: 'Ticket sudah closed, tidak bisa di-assign' });

    const technician = await prisma.user.findFirst({
      where: { id: Number(technicianId), role: 'technician', status: 'active' }
    });
    if (!technician)
      return res.status(404).json({ error: 'Teknisi tidak ditemukan atau tidak aktif' });

    const assignment = await prisma.ticketAssignment.create({
      data: {
        ticketId,
        technicianId: Number(technicianId),
        adminNote: adminNote || null,
        status: 'pending'
      }
    });

    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: 'assigned',
        currentTechnicianId: Number(technicianId),
        assignedToId: req.user.userId,
        assignedAt: new Date()
      },
      include: TICKET_INCLUDE_LIST
    });

    if (scheduledDate) {
      await prisma.visitSchedule.upsert({
        where: { ticketId },
        update: {
          technicianId:      Number(technicianId),
          scheduledDate:     new Date(scheduledDate),
          estimatedDuration: estimatedDuration ? Number(estimatedDuration) : null,
          note:              scheduleNote || null
        },
        create: {
          ticketId,
          technicianId:      Number(technicianId),
          scheduledDate:     new Date(scheduledDate),
          estimatedDuration: estimatedDuration ? Number(estimatedDuration) : null,
          note:              scheduleNote || null
        }
      });
    }

    const formatted = formatTicket(updatedTicket);
    io.to('admin-room').emit('ticketUpdated', formatted);
    io.to(`technician-${technicianId}`).emit('newAssignment', {
      ticketId,
      ticket: formatted,
      assignment,
      adminNote: adminNote || null
    });

    res.json({
      success: true,
      message: `Ticket berhasil di-assign ke ${technician.name}`,
      assignment,
      ticket: formatted
    });
  } catch (error) {
    console.error('Error assign ticket:', error);
    res.status(500).json({ error: 'Gagal assign ticket', details: error.message });
  }
});

app.post('/api/tickets/:id/assignment/respond', authMiddleware, technicianOnly, async (req, res) => {
  const ticketId = Number(req.params.id);
  const { action, rejectReason } = req.body;

  if (!['accept', 'reject'].includes(action))
    return res.status(400).json({ error: 'action harus "accept" atau "reject"' });

  try {
    const assignment = await prisma.ticketAssignment.findFirst({
      where: { ticketId, technicianId: req.user.userId, status: 'pending' }
    });

    if (!assignment)
      return res.status(404).json({ error: 'Assignment tidak ditemukan atau sudah direspons' });

    if (action === 'accept') {
      await prisma.ticketAssignment.update({
        where: { id: assignment.id },
        data: { status: 'accepted', respondedAt: new Date() }
      });

      const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data: { status: 'in_progress' },
        include: TICKET_INCLUDE_LIST
      });

      const formatted = formatTicket(updated);
      io.to('admin-room').emit('ticketUpdated', formatted);
      io.to(`ticket-${ticketId}`).emit('ticketUpdated', formatted);

      res.json({
        success: true,
        message: 'Assignment diterima. Status ticket → in-progress',
        ticket: formatted
      });

    } else {
      await prisma.ticketAssignment.update({
        where: { id: assignment.id },
        data: { status: 'rejected', respondedAt: new Date(), rejectReason: rejectReason || null }
      });

      const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data: { status: 'open', currentTechnicianId: null, assignedAt: null },
        include: TICKET_INCLUDE_LIST
      });

      const formatted = formatTicket(updated);
      io.to('admin-room').emit('ticketUpdated', formatted);
      io.to('admin-room').emit('assignmentRejected', {
        ticketId,
        technicianName: req.user.name,
        rejectReason: rejectReason || null,
        ticket: formatted
      });

      res.json({
        success: true,
        message: 'Assignment ditolak. Ticket kembali ke open.',
        ticket: formatted
      });
    }
  } catch (error) {
    console.error('Error respond assignment:', error);
    res.status(500).json({ error: 'Gagal merespons assignment', details: error.message });
  }
});

// ==================== FOTO TICKET ====================

app.post('/api/tickets/:id/photos', authMiddleware, technicianOnly, upload.array('photos', 5), async (req, res) => {
  const ticketId = Number(req.params.id);

  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return res.status(404).json({ error: 'Ticket tidak ditemukan' });

    if (ticket.currentTechnicianId !== req.user.userId)
      return res.status(403).json({ error: 'Bukan tugas Anda' });

    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: 'Tidak ada file yang diupload' });

    const captions = req.body.captions
      ? (Array.isArray(req.body.captions) ? req.body.captions : [req.body.captions])
      : [];

    const savedPhotos = await Promise.all(req.files.map((file, index) =>
      prisma.ticketPhoto.create({
        data: {
          ticketId,
          uploadedById: req.user.userId,
          filename:     file.filename,
          originalName: file.originalname,
          url:          `/uploads/ticket-photos/${file.filename}`,
          mimeType:     file.mimetype,
          fileSize:     file.size,
          caption:      captions[index] || null
        }
      })
    ));

    io.to('admin-room').emit('ticketNewPhoto', {
      ticketId,
      technicianName: req.user.name,
      photos: savedPhotos
    });

    res.status(201).json({
      success: true,
      message: `${savedPhotos.length} foto berhasil diupload`,
      photos: savedPhotos
    });
  } catch (error) {
    console.error('Error upload foto:', error);
    res.status(500).json({ error: 'Gagal upload foto', details: error.message });
  }
});

app.get('/api/tickets/:id/photos', authMiddleware, async (req, res) => {
  try {
    const photos = await prisma.ticketPhoto.findMany({
      where: { ticketId: Number(req.params.id) },
      orderBy: { createdAt: 'asc' },
      include: { uploadedBy: { select: { id: true, name: true } } }
    });
    res.json({ success: true, photos });
  } catch (error) {
    res.status(500).json({ error: 'Gagal ambil foto' });
  }
});

// ==================== JADWAL KUNJUNGAN ====================

app.get('/api/tickets/:id/schedule', authMiddleware, async (req, res) => {
  try {
    const schedule = await prisma.visitSchedule.findUnique({
      where: { ticketId: Number(req.params.id) },
      include: { technician: { select: { id: true, name: true, phone: true } } }
    });
    res.json({ success: true, schedule });
  } catch (error) {
    res.status(500).json({ error: 'Gagal ambil jadwal' });
  }
});

app.patch('/api/tickets/:id/schedule', authMiddleware, adminOnly, async (req, res) => {
  const ticketId = Number(req.params.id);
  const { scheduledDate, estimatedDuration, note, technicianId } = req.body;

  try {
    const schedule = await prisma.visitSchedule.upsert({
      where: { ticketId },
      update: {
        scheduledDate:     scheduledDate ? new Date(scheduledDate) : undefined,
        estimatedDuration: estimatedDuration ? Number(estimatedDuration) : undefined,
        note:              note !== undefined ? note : undefined,
        technicianId:      technicianId ? Number(technicianId) : undefined
      },
      create: {
        ticketId,
        technicianId:      Number(technicianId),
        scheduledDate:     new Date(scheduledDate),
        estimatedDuration: estimatedDuration ? Number(estimatedDuration) : null,
        note:              note || null
      },
      include: { technician: { select: { id: true, name: true, phone: true } } }
    });

    io.to('admin-room').emit('scheduleUpdated', { ticketId, schedule });
    res.json({ success: true, schedule });
  } catch (error) {
    console.error('Error update schedule:', error);
    res.status(500).json({ error: 'Gagal update jadwal' });
  }
});

// ==================== CUSTOMER MANAGEMENT ====================

app.get('/api/customers', authMiddleware, adminOnly, async (req, res) => {
  try {
    const customers = await prisma.user.findMany({
      where: { role: 'customer' },
      select: {
        id: true, username: true, name: true,
        address: true, phone: true, status: true, createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: 'Gagal ambil data customer' });
  }
});

app.get('/api/customers/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const customer = await prisma.user.findUnique({
      where: { id: Number(req.params.id) },
      select: {
        id: true, username: true, name: true, address: true, phone: true, status: true, createdAt: true,
        tickets: {
          select: { id: true, title: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' }, take: 10
        }
      }
    });
    if (!customer) return res.status(404).json({ error: 'Customer tidak ditemukan' });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: 'Gagal ambil data customer' });
  }
});

app.patch('/api/customers/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { status, name, address, phone, password } = req.body;
    const updateData = {};

    if (status) {
      if (!['active', 'inactive'].includes(status))
        return res.status(400).json({ error: 'Status harus active atau inactive' });
      updateData.status = status;
    }
    if (name) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;

    if (password) {
      if (password.length < 6)
        return res.status(400).json({ error: 'Password minimal 6 karakter' });
      updateData.password = await bcrypt.hash(password, 10);
    }

    const customer = await prisma.user.update({
      where: { id: Number(req.params.id) },
      data: updateData,
      select: { id: true, username: true, name: true, address: true, status: true, createdAt: true }
    });
    res.json({ success: true, customer });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Customer tidak ditemukan' });
    res.status(500).json({ error: 'Gagal update customer' });
  }
});

// [FIX #4] DELETE customer — cek jumlah tiket dulu, kembalikan info untuk warning di frontend
app.delete('/api/customers/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const customerId = Number(req.params.id);
    const customer = await prisma.user.findUnique({
      where: { id: customerId },
      include: { _count: { select: { tickets: true } } }
    });
    if (!customer || customer.role !== 'customer')
      return res.status(404).json({ error: 'Customer tidak ditemukan' });

    const ticketCount = customer._count.tickets;

    // Jika request tidak menyertakan flag konfirmasi dan ada tiket, kembalikan warning
    const { confirmDelete } = req.query;
    if (ticketCount > 0 && confirmDelete !== 'true') {
      return res.status(200).json({
        requiresConfirmation: true,
        ticketCount,
        message: `Customer ini memiliki ${ticketCount} tiket. Semua tiket dan riwayatnya akan ikut terhapus (cascade). Kirim ?confirmDelete=true untuk melanjutkan.`
      });
    }

    await prisma.user.delete({ where: { id: customerId } });
    res.json({
      success: true,
      message: `Customer berhasil dihapus${ticketCount > 0 ? ` beserta ${ticketCount} tiket terkait` : ''}`
    });
  } catch (error) {
    res.status(500).json({ error: 'Gagal hapus customer' });
  }
});

// ==================== SOCKET.IO ====================

io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);

  socket.on('joinAdminRoom', () => {
    socket.join('admin-room');
    console.log(`👑 Admin joined admin-room: ${socket.id}`);
  });

  socket.on('joinTechnicianRoom', (technicianId) => {
    socket.join(`technician-${technicianId}`);
    console.log(`🔧 Teknisi ${technicianId} joined room: ${socket.id}`);
  });

  socket.on('joinTicketRoom', (ticketId) => {
    socket.join(`ticket-${ticketId}`);
    console.log(`📩 Socket ${socket.id} joined room: ticket-${ticketId}`);
  });

  socket.on('sendMessage', async ({ ticketId, message, sender }) => {
    console.log(`💬 Pesan dari ${sender} (ticket #${ticketId}):`, message);
    try {
      const chatMessage = await prisma.chatMessage.create({
        data: { ticketId: Number(ticketId), sender, message }
      });

      io.to(`ticket-${ticketId}`).emit('newMessage', chatMessage);
      io.to('admin-room').emit('ticketHasNewMessage', {
        ticketId: Number(ticketId),
        sender,
        messagePreview: message.substring(0, 50) + (message.length > 50 ? '...' : '')
      });
    } catch (error) {
      console.error('❌ Error simpan pesan chat:', error);
      socket.emit('messageError', { error: 'Gagal mengirim pesan' });
    }
  });

  socket.on('typing',     ({ ticketId, sender }) => { socket.to(`ticket-${ticketId}`).emit('userTyping',        { sender }); });
  socket.on('stopTyping', ({ ticketId })         => { socket.to(`ticket-${ticketId}`).emit('userStoppedTyping');              });
  socket.on('disconnect', ()                     => { console.log('❌ Client disconnected:', socket.id);                      });
});

// ==================== GRACEFUL SHUTDOWN ====================

process.on('SIGINT',  async () => { await prisma.$disconnect(); server.close(() => process.exit(0)); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); server.close(() => process.exit(0)); });

// ==================== START SERVER ====================

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return 'localhost';
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log(`\n Server berjalan di port ${PORT}`);
  console.log(`Lokal     : http://localhost:${PORT}`);
  console.log(`LAN       : http://${ip}:${PORT}`);
});