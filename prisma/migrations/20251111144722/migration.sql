/*
  Warnings:

  - You are about to drop the column `isFree` on the `Operation` table. All the data in the column will be lost.
  - You are about to drop the column `recieverPhone` on the `Operation` table. All the data in the column will be lost.
  - Added the required column `receiverPhone` to the `Operation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Operation" DROP COLUMN "isFree",
DROP COLUMN "recieverPhone",
ADD COLUMN     "commission" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isNeedCommission" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "receiverPhone" TEXT NOT NULL;
