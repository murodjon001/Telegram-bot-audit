/*
  Warnings:

  - You are about to drop the column `commission` on the `Operation` table. All the data in the column will be lost.
  - You are about to drop the column `isNeedCommission` on the `Operation` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Operation" DROP COLUMN "commission",
DROP COLUMN "isNeedCommission",
ADD COLUMN     "comment" TEXT;
