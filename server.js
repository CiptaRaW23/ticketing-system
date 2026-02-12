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
const path = require('path');
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-if-env-not-set';

// Setup connection pool ke PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Setup adapter untuk Prisma 7
const adapter = new PrismaPg(pool);

// Inisialisasi Prisma Client dengan adapter
const prisma = new PrismaClient({
  adapter,
  log: ['warn', 'error'],
});

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE"]
  }
});

app.use(cors());
app.use(express.json());

// ==================== STATIC FILES & ROUTING ====================

// Serve static files dari folder 'public'
app.use(express.static('public'));

// Redirect root ke login page
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Admin panel routing
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// API health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Ticketing Server Running! 🚀',
    timestamp: new Date().toISOString()
  });
});

// ==================== AUTH MIDDLEWARE ====================
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token diperlukan' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { userId, username, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token tidak valid atau kadaluarsa' });
  }
};

// Middleware khusus admin
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak. Admin only.' });
  }
  next();
};

// ==================== BOT NLP LOGIC (PERSAPAN) ====================
async function classifyTicket(description) {
  // Tempat Logika NLP + Naive Bayes nantinya
  // Untuk sekarang, kembalikan nilai default agar database tidak Error P2011
  return {
    category: "other", // Default sementara
    priority: "low" // Default sementara
  };
}

// ==================== AUTH ROUTES ====================

// Register (hanya admin yang bisa tambah customer)
app.post('/api/register', authMiddleware, adminOnly, async (req, res) => {
  const { username, name, password, address } = req.body;

  if (!username || !password || !name) {
    return res.status(400).json({ error: 'Username, nama, dan password wajib' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password minimal 6 karakter' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        name,
        password: hashedPassword,
        address: address || null,
        role: 'customer',
        status: 'active'
      },
      select: {
        id: true,
        username: true,
        name: true,
        address: true,
        status: true,
        createdAt: true
      }
    });
    
    res.status(201).json({ 
      success: true, 
      message: 'Customer berhasil ditambahkan',
      user
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Username sudah digunakan' });
    }
    console.error('Error register:', error);
    res.status(500).json({ error: 'Gagal register' });
  }
});

// Login (customer & admin)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { username } });
    
    if (!user) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    if (user.status !== 'active') {
      return res.status(401).json({ error: 'Akun Anda tidak aktif. Hubungi administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Update last login
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

// Get current user info
app.get('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        username: true,
        name: true,
        address: true,
        role: true,
        status: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Error get profile:', error);
    res.status(500).json({ error: 'Gagal mengambil data profile' });
  }
});

// Update profile
app.patch('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const { name, address } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (address !== undefined) updateData.address = address;

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        address: true,
        role: true
      }
    });

    res.json({ success: true, user });
  } catch (error) {
    console.error('Error update profile:', error);
    res.status(500).json({ error: 'Gagal update profile' });
  }
});

// Change password
app.post('/api/user/change-password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Password lama dan baru wajib diisi' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Password lama salah' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { password: hashedPassword }
    });

    res.json({ success: true, message: 'Password berhasil diubah' });
  } catch (error) {
    console.error('Error change password:', error);
    res.status(500).json({ error: 'Gagal ganti password' });
  }
});

// ==================== TICKET ROUTES ====================

// Create ticket (dengan persiapan Auto-Bot NLP)
app.post('/api/tickets', authMiddleware, async (req, res) => {
  try {
    const { title, description, address: inputAddress } = req.body;
    const userId = req.user.userId;

    if (!title || !description) {
      return res.status(400).json({ error: 'Judul dan deskripsi wajib diisi' });
    }

    // A. JALANKAN BOT (Persiapan NLP)
    const botResult = await classifyTicket(description);

    // B. LOGIKA ALAMAT & MAPS
    let address = inputAddress?.trim() || null;
    if (!address) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { address: true }
      });
      address = user?.address || null;
    }

    let mapsLink = null;
    if (address) {
      const encoded = encodeURIComponent(address.trim());
      mapsLink = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    }

    // C. SIMPAN KE DATABASE
    const ticket = await prisma.ticket.create({
      data: {
        title,
        description,
        userId,
        category: botResult.category, 
        priority: botResult.priority,
        address,
        mapsLink,
        status: 'open'
      },
      include: { 
        user: {
          select: { id: true, name: true, username: true, address: true }
        }
      }
    });

    io.emit('newTicket', ticket);
    res.status(201).json(ticket);

  } catch (error) {
    console.error('❌ Error create ticket:', error);
    res.status(500).json({ 
      error: 'Gagal buat ticket', 
      details: error.message 
    });
  }
});

// Get tickets berdasarkan role
app.get('/api/tickets', authMiddleware, async (req, res) => {
  try {
    const whereClause = req.user.role === 'customer' 
      ? { userId: req.user.userId }
      : {};

    const tickets = await prisma.ticket.findMany({
      where: whereClause,
      include: { 
        messages: {
          orderBy: { createdAt: 'asc' }
        }, 
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            address: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(tickets);
  } catch (error) {
    console.error('Error get tickets:', error);
    res.status(500).json({ error: 'Gagal ambil tickets' });
  }
});

// Get single ticket dengan security check
app.get('/api/tickets/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await prisma.ticket.findUnique({
      where: { id: Number(id) },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        },
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            address: true
          }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket tidak ditemukan' });
    }

    // Security: customer hanya bisa akses ticket miliknya
    if (req.user.role === 'customer' && ticket.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Akses ditolak' });
    }

    res.json(ticket);
  } catch (error) {
    console.error('Error ambil single ticket:', error);
    res.status(500).json({ error: 'Gagal ambil ticket' });
  }
});

// Update status ticket (admin only)
app.patch('/api/tickets/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['open', 'in-progress', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Status tidak valid' });
    }

    const updated = await prisma.ticket.update({
      where: { id: Number(id) },
      data: { 
        status,
        ...(status === 'closed' && { resolvedAt: new Date(), closedAt: new Date() })
      },
      include: { 
        messages: {
          orderBy: { createdAt: 'asc' }
        }, 
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            address: true
          }
        }
      }
    });

    io.emit('ticketUpdated', updated);
    
    res.json(updated);
  } catch (error) {
    console.error('Error update ticket:', error);
    res.status(500).json({ error: 'Gagal update status' });
  }
});

// Delete ticket (admin only)
app.delete('/api/tickets/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await prisma.ticket.findUnique({
      where: { id: Number(id) }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket tidak ditemukan' });
    }

    await prisma.ticket.delete({
      where: { id: Number(id) }
    });

    res.json({ 
      success: true, 
      message: 'Ticket berhasil dihapus' 
    });
  } catch (error) {
    console.error('Error delete ticket:', error);
    res.status(500).json({ error: 'Gagal hapus ticket' });
  }
});

// ==================== CUSTOMER MANAGEMENT (Admin Only) ====================

// Get all customers
app.get('/api/customers', authMiddleware, adminOnly, async (req, res) => {
  try {
    const customers = await prisma.user.findMany({
      where: { role: 'customer' },
      select: { 
        id: true, 
        username: true, 
        name: true, 
        address: true, 
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(customers);
  } catch (error) {
    console.error('Error get customers:', error);
    res.status(500).json({ error: 'Gagal ambil data customer' });
  }
});

// Get single customer (admin only)
app.get('/api/customers/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    
    const customer = await prisma.user.findUnique({
      where: { 
        id: Number(id),
        role: 'customer'
      },
      select: {
        id: true,
        username: true,
        name: true,
        address: true,
        status: true,
        createdAt: true,
        tickets: {
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer tidak ditemukan' });
    }

    res.json(customer);
  } catch (error) {
    console.error('Error get customer:', error);
    res.status(500).json({ error: 'Gagal ambil data customer' });
  }
});

// Update customer (admin only)
app.patch('/api/customers/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, name, address } = req.body;

    const updateData = {};

    if (status) {
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ error: 'Status harus active atau inactive' });
      }
      updateData.status = status;
    }

    if (name) updateData.name = name;
    if (address !== undefined) updateData.address = address;

    const customer = await prisma.user.update({
      where: { id: Number(id) },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        address: true,
        status: true,
        createdAt: true
      }
    });

    res.json({ success: true, customer });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Customer tidak ditemukan' });
    }
    console.error('Error update customer:', error);
    res.status(500).json({ error: 'Gagal update customer' });
  }
});

// Delete customer (admin only)
app.delete('/api/customers/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await prisma.user.findUnique({
      where: { id: Number(id) }
    });

    if (!customer || customer.role !== 'customer') {
      return res.status(404).json({ error: 'Customer tidak ditemukan' });
    }

    await prisma.user.delete({
      where: { id: Number(id) }
    });

    res.json({ 
      success: true, 
      message: 'Customer berhasil dihapus' 
    });
  } catch (error) {
    console.error('Error delete customer:', error);
    res.status(500).json({ error: 'Gagal hapus customer' });
  }
});

// ==================== SOCKET.IO - REAL-TIME CHAT ====================

io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);

  socket.on('joinTicketRoom', (ticketId) => {
    socket.join(`ticket-${ticketId}`);
    console.log(`📩 Socket ${socket.id} joined room: ticket-${ticketId}`);
  });

  socket.on('sendMessage', async ({ ticketId, message, sender }) => {
    console.log(`💬 Pesan dari ${sender} (ticket #${ticketId}):`, message);

    try {
      const chatMessage = await prisma.chatMessage.create({
        data: {
          ticketId: Number(ticketId),
          sender,
          message,
        }
      });

      console.log(`✅ Pesan disimpan, broadcast ke room ticket-${ticketId}`);
      
      io.to(`ticket-${ticketId}`).emit('newMessage', chatMessage);

      io.emit('ticketHasNewMessage', {
        ticketId: Number(ticketId),
        sender,
        messagePreview: message.substring(0, 50) + (message.length > 50 ? '...' : '')
      });

    } catch (error) {
      console.error('❌ Error simpan pesan chat:', error);
      socket.emit('messageError', { error: 'Gagal mengirim pesan' });
    }
  });

  socket.on('typing', ({ ticketId, sender }) => {
    socket.to(`ticket-${ticketId}`).emit('userTyping', { sender });
  });

  socket.on('stopTyping', ({ ticketId }) => {
    socket.to(`ticket-${ticketId}`).emit('userStoppedTyping');
  });

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

// ==================== SERVER STARTUP ====================

process.on('SIGINT', async () => {
  console.log('\n⏳ Shutting down server...');
  await prisma.$disconnect();
  server.close(() => {
    console.log('✅ Server stopped.');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('\n⏳ Shutting down server...');
  await prisma.$disconnect();
  server.close(() => {
    console.log('✅ Server stopped.');
    process.exit(0);
  });
});

const os = require('os');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address;
      }
    }
  }
  return 'localhost';
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log(`\n✅ Server ticketing berjalan di port ${PORT}!`);
  console.log(`📍 Akses lokal: http://localhost:${PORT}`);
  console.log(`📍 Akses dari LAN: http://${localIP}:${PORT}`);
  console.log(`🔐 Login Admin: http://${localIP}:${PORT}/login.html`);
  console.log(`📊 Admin Panel: http://${localIP}:${PORT}/admin`);
  console.log(`🔧 Prisma Studio: npx prisma studio`);
  console.log(`💬 Socket.IO ready untuk real-time chat\n`);
});