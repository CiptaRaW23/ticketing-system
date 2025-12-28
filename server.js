require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

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

// REST API: Create Ticket
app.post('/api/tickets', async (req, res) => {
  try {
    const { title, description, userId } = req.body;
    const ticket = await prisma.ticket.create({
      data: {
        title,
        description,
        userId: Number(userId),
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

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n Server ticketing berjalan di port ${PORT}!`);
  console.log(`Akses lokal: http://localhost:${PORT}`);
  const ip = require('os').networkInterfaces();
  let localIp = '10.192.32.91';
  Object.keys(ip).forEach(iface => {
    ip[iface].forEach(addr => {
      if (addr.family === 'IPv4' && !addr.internal) localIp = addr.address;
    });
  });
  console.log(`Akses dari LAN: http://${localIp}:${PORT}`);
  console.log(`Prisma Studio: npx prisma studio\n`);
});
