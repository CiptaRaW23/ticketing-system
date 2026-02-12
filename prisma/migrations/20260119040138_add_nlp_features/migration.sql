/*
  Warnings:

  - You are about to alter the column `title` on the `tickets` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(200)`.
  - The `category` column on the `tickets` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `tickets` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `mapsLink` on the `tickets` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(500)`.
  - You are about to alter the column `resolvedBy` on the `tickets` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `username` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `name` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `password` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - The `role` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[ticketNumber]` on the table `tickets` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `priority` to the `bot_trainings` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `category` on the `bot_trainings` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `sender` on the `chat_messages` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - The required column `ticketNumber` was added to the `tickets` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('customer', 'admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('open', 'in_progress', 'closed');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('gangguan', 'pertanyaan', 'complaint', 'other');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "MessageSender" AS ENUM ('customer', 'admin', 'bot');

-- AlterTable
ALTER TABLE "bot_trainings" ADD COLUMN     "confidence" DOUBLE PRECISION DEFAULT 0.0,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastUsedAt" TIMESTAMP(3),
ADD COLUMN     "priority" "TicketPriority" NOT NULL,
ADD COLUMN     "timesUsed" INTEGER NOT NULL DEFAULT 0,
DROP COLUMN "category",
ADD COLUMN     "category" "TicketCategory" NOT NULL,
ALTER COLUMN "response" DROP NOT NULL;

-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "isRead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "readAt" TIMESTAMP(3),
DROP COLUMN "sender",
ADD COLUMN     "sender" "MessageSender" NOT NULL;

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedToId" INTEGER,
ADD COLUMN     "categoryConfidence" REAL,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "priority" "TicketPriority",
ADD COLUMN     "priorityConfidence" REAL,
ADD COLUMN     "resolutionTime" INTEGER,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "responseTime" INTEGER,
ADD COLUMN     "ticketNumber" TEXT NOT NULL,
ALTER COLUMN "title" SET DATA TYPE VARCHAR(200),
DROP COLUMN "category",
ADD COLUMN     "category" "TicketCategory",
DROP COLUMN "status",
ADD COLUMN     "status" "TicketStatus" NOT NULL DEFAULT 'open',
ALTER COLUMN "mapsLink" SET DATA TYPE VARCHAR(500),
ALTER COLUMN "resolvedBy" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email" VARCHAR(100),
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "phone" VARCHAR(20),
ALTER COLUMN "username" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "password" SET DATA TYPE VARCHAR(255),
DROP COLUMN "role",
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'customer',
DROP COLUMN "status",
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'active';

-- CreateTable
CREATE TABLE "admin_activity_logs" (
    "id" SERIAL NOT NULL,
    "adminId" INTEGER NOT NULL,
    "adminName" VARCHAR(100) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" INTEGER,
    "description" TEXT,
    "ipAddress" VARCHAR(50),
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "dataType" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_performance_metrics" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "totalClassified" INTEGER NOT NULL DEFAULT 0,
    "correctCategory" INTEGER NOT NULL DEFAULT 0,
    "correctPriority" INTEGER NOT NULL DEFAULT 0,
    "totalAutoResolved" INTEGER NOT NULL DEFAULT 0,
    "successfulResolve" INTEGER NOT NULL DEFAULT 0,
    "avgConfidence" REAL,
    "avgResponseTime" REAL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_performance_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_activity_logs_adminId_idx" ON "admin_activity_logs"("adminId");

-- CreateIndex
CREATE INDEX "admin_activity_logs_action_idx" ON "admin_activity_logs"("action");

-- CreateIndex
CREATE INDEX "admin_activity_logs_entityType_idx" ON "admin_activity_logs"("entityType");

-- CreateIndex
CREATE INDEX "admin_activity_logs_createdAt_idx" ON "admin_activity_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "system_settings_key_idx" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "bot_performance_metrics_date_idx" ON "bot_performance_metrics"("date");

-- CreateIndex
CREATE UNIQUE INDEX "bot_performance_metrics_date_key" ON "bot_performance_metrics"("date");

-- CreateIndex
CREATE INDEX "bot_trainings_category_idx" ON "bot_trainings"("category");

-- CreateIndex
CREATE INDEX "bot_trainings_priority_idx" ON "bot_trainings"("priority");

-- CreateIndex
CREATE INDEX "bot_trainings_isActive_idx" ON "bot_trainings"("isActive");

-- CreateIndex
CREATE INDEX "chat_messages_sender_idx" ON "chat_messages"("sender");

-- CreateIndex
CREATE INDEX "chat_messages_createdAt_idx" ON "chat_messages"("createdAt");

-- CreateIndex
CREATE INDEX "chat_messages_isRead_idx" ON "chat_messages"("isRead");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticketNumber_key" ON "tickets"("ticketNumber");

-- CreateIndex
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

-- CreateIndex
CREATE INDEX "tickets_category_idx" ON "tickets"("category");

-- CreateIndex
CREATE INDEX "tickets_priority_idx" ON "tickets"("priority");

-- CreateIndex
CREATE INDEX "tickets_ticketNumber_idx" ON "tickets"("ticketNumber");

-- CreateIndex
CREATE INDEX "tickets_createdAt_idx" ON "tickets"("createdAt");

-- CreateIndex
CREATE INDEX "tickets_assignedToId_idx" ON "tickets"("assignedToId");

-- CreateIndex
CREATE INDEX "tickets_autoResolved_idx" ON "tickets"("autoResolved");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
