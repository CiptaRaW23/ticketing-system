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
  log: ['query', 'info', 'warn', 'error'], // opsional, bagus untuk debug
});
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Test route
app.get('/', (req, res) => {
  res.send('<h1>Ticketing Server Berjalan! 🚀</h1><p>Gunakan Postman atau Flutter untuk test API.</p>');
});

// Register (untuk admin tambah customer baru dari panel nanti)
app.post('/api/register', async (req, res) => {
  const { username, name, password, address } = req.body;

  if (!username || !password || !name) {
    return res.status(400).json({ error: 'Username, nama, dan password wajib' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        name,
        password: hashedPassword,
        address,
        role: 'customer'
      }
    });
    res.status(201).json({ success: true, user: { username: user.username, name: user.name } });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Username sudah digunakan' });
    }
    res.status(500).json({ error: 'Gagal register' });
  }
});

// Login (customer & admin)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'Username atau password salah' });
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

    res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ error: 'Gagal login' });
  }
});

// Proteksi create ticket
app.post('/api/tickets', authMiddleware, async (req, res) => {
      try {
      const { title, description, address: inputAddress } = req.body; // rename biar tidak bentrok
      const userId = req.user.userId;

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

      const ticket = await prisma.ticket.create({
        data: {
          title,
          description,
          userId,
          address,   
          mapsLink,   
        },
        include: { messages: true, user: true }
      });

      io.emit('newTicket', ticket);
      res.status(201).json(ticket);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Gagal buat ticket' });
    }
});

// REST API: Get all tickets
app.get('/api/tickets', async (req, res) => {
  try {
    const tickets = await prisma.ticket.findMany({
      include: { messages: true, user: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: 'Gagal ambil tickets' });
  }
});

// Get single ticket dengan messages lengkap
app.get('/api/tickets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await prisma.ticket.findUnique({
      where: { id: Number(id) },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' } // urutkan dari lama ke baru
        },
        user: true
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket tidak ditemukan' });
    }

    res.json(ticket);
  } catch (error) {
    console.error('Error ambil single ticket:', error);
    res.status(500).json({ error: 'Gagal ambil ticket' });
  }
});

// Socket.IO Real-time Chat
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('joinTicketRoom', (ticketId) => {
    socket.join(`ticket-${ticketId}`);
    console.log(`Socket ${socket.id} joined ticket-${ticketId}`);
  });

  socket.on('sendMessage', async ({ ticketId, message, sender }) => {
  console.log(`Pesan diterima dari ${sender} untuk ticket ${ticketId}: ${message}`);

  try {
    const chatMessage = await prisma.chatMessage.create({
      data: {
        ticketId: Number(ticketId),
        sender, // 'customer', 'admin', 'bot'
        message,
      }
    });

    console.log('Pesan disimpan & broadcast ke room ticket-' + ticketId);
    io.to(`ticket-${ticketId}`).emit('newMessage', chatMessage);
  } catch (error) {
    console.error('Error simpan pesan chat:', error);
  }
});

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Update status ticket
app.patch('/api/tickets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updated = await prisma.ticket.update({
      where: { id: Number(id) },
      data: { status },
      include: { messages: true, user: true }
    });
    io.emit('ticketUpdated', updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Gagal update status' });
  }
});

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

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down server...');
  await prisma.$disconnect();
  server.close(() => {
    console.log('Server stopped.');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down server...');
  await prisma.$disconnect();
  server.close(() => {
    console.log('Server stopped.');
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

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log(`\n Server ticketing berjalan di port ${PORT}!`);
  console.log(`Akses lokal: http://localhost:${PORT}`);
  console.log(`Akses dari LAN: http://${localIP}:${PORT}`);
  console.log(`Prisma Studio: npx prisma studio\n`);
});