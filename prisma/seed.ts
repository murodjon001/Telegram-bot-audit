import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Superuser yaratish
  await prisma.user.upsert({
    where: { telegramId: 929064950 }, // test uchun unikal ID
    update: {},
    create: {
      telegramId: 929064950,
      username: 'superadmin',
      isWhitelisted: true,
      isSuperUser: true,
    },
  });

  // Oddiy whitelisted user
  await prisma.user.upsert({
    where: { telegramId: 111111111 },
    update: {},
    create: {
      telegramId: 111111111,
      username: 'whitelisted_user',
      isWhitelisted: true,
      isSuperUser: false,
    },
  });

  // Oddiy foydalanuvchi
  await prisma.user.upsert({
    where: { telegramId: 222222222 },
    update: {},
    create: {
      telegramId: 222222222,
      username: 'normal_user',
      isWhitelisted: false,
      isSuperUser: false,
    },
  });

  console.log('✅ Seeding completed!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error while seeding:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
