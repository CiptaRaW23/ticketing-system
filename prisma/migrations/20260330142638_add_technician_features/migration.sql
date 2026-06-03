/*
  Warnings:

  - You are about to drop the column `autoResolved` on the `tickets` table. All the data in the column will be lost.
  - You are about to drop the column `categoryConfidence` on the `tickets` table. All the data in the column will be lost.
  - You are about to drop the column `priorityConfidence` on the `tickets` table. All the data in the column will be lost.
  - You are about to drop the column `resolutionTime` on the `tickets` table. All the data in the column will be lost.
  - You are about to drop the column `responseTime` on the `tickets` table. All the data in the column will be lost.
  - You are about to drop the `bot_performance_metrics` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `bot_trainings` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('pending', 'accepted', 'rejected');

-- AlterEnum
ALTER TYPE "TicketStatus" ADD VALUE 'assigned';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'technician';

-- DropIndex
DROP INDEX "tickets_autoResolved_idx";

-- DropIndex
DROP INDEX "tickets_category_idx";

-- AlterTable
ALTER TABLE "tickets" DROP COLUMN "autoResolved",
DROP COLUMN "categoryConfidence",
DROP COLUMN "priorityConfidence",
DROP COLUMN "resolutionTime",
DROP COLUMN "responseTime",
ADD COLUMN     "currentTechnicianId" INTEGER;

-- DropTable
DROP TABLE "bot_performance_metrics";

-- DropTable
DROP TABLE "bot_trainings";

-- CreateTable
CREATE TABLE "ticket_assignments" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "technicianId" INTEGER NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "rejectReason" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "ticket_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_schedules" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "technicianId" INTEGER NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "estimatedDuration" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_photos" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "uploadedById" INTEGER NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "mimeType" VARCHAR(50) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "caption" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_assignments_ticketId_idx" ON "ticket_assignments"("ticketId");

-- CreateIndex
CREATE INDEX "ticket_assignments_technicianId_idx" ON "ticket_assignments"("technicianId");

-- CreateIndex
CREATE INDEX "ticket_assignments_status_idx" ON "ticket_assignments"("status");

-- CreateIndex
CREATE INDEX "ticket_assignments_assignedAt_idx" ON "ticket_assignments"("assignedAt");

-- CreateIndex
CREATE UNIQUE INDEX "visit_schedules_ticketId_key" ON "visit_schedules"("ticketId");

-- CreateIndex
CREATE INDEX "visit_schedules_technicianId_idx" ON "visit_schedules"("technicianId");

-- CreateIndex
CREATE INDEX "visit_schedules_scheduledDate_idx" ON "visit_schedules"("scheduledDate");

-- CreateIndex
CREATE INDEX "ticket_photos_ticketId_idx" ON "ticket_photos"("ticketId");

-- CreateIndex
CREATE INDEX "ticket_photos_uploadedById_idx" ON "ticket_photos"("uploadedById");

-- CreateIndex
CREATE INDEX "ticket_photos_createdAt_idx" ON "ticket_photos"("createdAt");

-- CreateIndex
CREATE INDEX "tickets_currentTechnicianId_idx" ON "tickets"("currentTechnicianId");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_currentTechnicianId_fkey" FOREIGN KEY ("currentTechnicianId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_schedules" ADD CONSTRAINT "visit_schedules_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_schedules" ADD CONSTRAINT "visit_schedules_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_photos" ADD CONSTRAINT "ticket_photos_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_photos" ADD CONSTRAINT "ticket_photos_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
