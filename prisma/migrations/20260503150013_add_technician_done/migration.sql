-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "technicianDone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "technicianDoneAt" TIMESTAMP(3);
