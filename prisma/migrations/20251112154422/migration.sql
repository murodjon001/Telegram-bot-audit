-- DropForeignKey
ALTER TABLE "Operation" DROP CONSTRAINT "Operation_userId_fkey";

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
