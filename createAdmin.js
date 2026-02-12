require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// Setup pool PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Adapter Prisma
const adapter = new PrismaPg(pool);

// Prisma Client (WAJIB pakai adapter)
const prisma = new PrismaClient({ adapter });

async function createAdmin() {
  try {
    const username = 'admin';
    const password = 'admin123';
    const name = 'Administrator';

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await prisma.user.create({
      data: {
        username,
        name,
        password: hashedPassword,
        role: 'admin',
        status: 'active',
      },
    });

    console.log('Admin berhasil dibuat!');
    console.log({
      username: admin.username,
      role: admin.role,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      console.log('Admin sudah ada');
    } else {
      console.error('Gagal membuat admin:', error);
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

createAdmin();
