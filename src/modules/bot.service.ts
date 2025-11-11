/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/config/prisma.service';
import { Telegraf, Context } from 'telegraf';
import { format } from 'date-fns';

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);
  private readonly bot: Telegraf<Context>;
  private readonly groupId: string;

  constructor(private readonly prisma: PrismaService) {
    this.bot = new Telegraf(process.env.BOT_TOKEN as string);
    this.groupId = process.env.TELEGRAM_GROUP_ID as string;
    console.log(this.groupId);

    // --- /start komandasi ---
    this.bot.start(async (ctx) => {
      const telegramId = ctx.from?.id;
      const username = ctx.from?.username || 'foydalanuvchi';

      if (!telegramId) return ctx.reply('Xatolik: Telegram ID topilmadi.');

      const user = await this.prisma.user.findUnique({ where: { telegramId } });

      if (!user || !user.isWhitelisted) {
        return ctx.reply(
          '❌ Sizga bu botdan foydalanishga ruxsat berilmagan.\nIltimos, administrator bilan bog‘laning.',
        );
      }

      const welcomeMessage = `
👋 <b>Salom, ${username}!</b>
Siz tizimga muvaffaqiyatli kirdingiz.

Quyidagi komandalar mavjud:
• /report — bugungi hisobotni ko‘rish
• /shablon_tosh — Toshkent shabloni
• /shablon_sam — Samarqand shabloni
`;

      await ctx.reply(welcomeMessage, { parse_mode: 'HTML' });
    });

    // --- Shablon komandalar ---
    this.bot.command('shablon_sam', async (ctx) => {
      const telegramId = ctx.from?.id;
      if (!telegramId) return ctx.reply('Telegram ID topilmadi.');
      const user = await this.prisma.user.findUnique({ where: { telegramId } });
      if (!user || !user.isWhitelisted)
        return ctx.reply('❌ Sizda ruxsat yo‘q.');

      await ctx.reply(this.usageMessageSam());
    });

    this.bot.command('shablon_tosh', async (ctx) => {
      const telegramId = ctx.from?.id;
      if (!telegramId) return ctx.reply('Telegram ID topilmadi.');
      const user = await this.prisma.user.findUnique({ where: { telegramId } });
      if (!user || !user.isWhitelisted)
        return ctx.reply('❌ Sizda ruxsat yo‘q.');

      await ctx.reply(this.usageMessageTosh());
    });

    // --- /report_tosh ---
    this.bot.command('report_tosh', async (ctx) => {
      const telegramId = ctx.from?.id;
      if (!telegramId) return ctx.reply('Telegram ID topilmadi.');

      const user = await this.prisma.user.findUnique({ where: { telegramId } });
      if (!user || !user.isWhitelisted)
        return ctx.reply('❌ Sizda ruxsat yo‘q.');

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      // 🔹 Faqat bugungi operatsiyalar
      const operations = await this.prisma.operation.findMany({
        where: { createdAt: { gte: today, lt: tomorrow } },
      });

      if (!operations.length)
        return ctx.reply('📭 Bugun hech qanday operatsiya yo‘q.');

      // Toshkentga kirgan (receiverLocation = Toshkent)
      const kirim = operations.filter(
        (op) => op.receiverLocation === 'Toshkent',
      );
      // Toshkentdan chiqqan (senderLocation = Toshkent)
      const chiqim = operations.filter(
        (op) => op.senderLocation === 'Toshkent',
      );

      const kirimTotals = kirim.reduce(
        (acc, op) => {
          acc[op.currency] = (acc[op.currency] || 0) + op.amount;
          return acc;
        },
        {} as Record<string, number>,
      );

      const chiqimTotals = chiqim.reduce(
        (acc, op) => {
          acc[op.currency] = (acc[op.currency] || 0) + op.amount;
          return acc;
        },
        {} as Record<string, number>,
      );

      let reportMsg = `🏙️ <b>Toshkent hisobot (${format(today, 'dd.MM.yyyy')})</b>\n\n`;

      reportMsg += `📥 <b>Kirim (Toshkentga kelgan):</b>\n`;
      for (const [currency, total] of Object.entries(kirimTotals)) {
        reportMsg += `  • ${currency}: ${total.toLocaleString()}\n`;
      }

      reportMsg += `\n📤 <b>Chiqim (Toshkentdan ketgan):</b>\n`;
      for (const [currency, total] of Object.entries(chiqimTotals)) {
        reportMsg += `  • ${currency}: ${total.toLocaleString()}\n`;
      }

      await ctx.reply(reportMsg, { parse_mode: 'HTML' });
    });

    // --- /report_sam ---
    this.bot.command('report_sam', async (ctx) => {
      const telegramId = ctx.from?.id;
      if (!telegramId) return ctx.reply('Telegram ID topilmadi.');

      const user = await this.prisma.user.findUnique({ where: { telegramId } });
      if (!user || !user.isWhitelisted)
        return ctx.reply('❌ Sizda ruxsat yo‘q.');

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const operations = await this.prisma.operation.findMany({
        where: { createdAt: { gte: today, lt: tomorrow } },
      });

      if (!operations.length)
        return ctx.reply('📭 Bugun hech qanday operatsiya yo‘q.');

      // Samarqandga kirgan
      const kirim = operations.filter(
        (op) => op.receiverLocation === 'Samarqand',
      );
      // Samarqanddan chiqqan
      const chiqim = operations.filter(
        (op) => op.senderLocation === 'Samarqand',
      );

      const kirimTotals = kirim.reduce(
        (acc, op) => {
          acc[op.currency] = (acc[op.currency] || 0) + op.amount;
          return acc;
        },
        {} as Record<string, number>,
      );

      const chiqimTotals = chiqim.reduce(
        (acc, op) => {
          acc[op.currency] = (acc[op.currency] || 0) + op.amount;
          return acc;
        },
        {} as Record<string, number>,
      );

      let reportMsg = `📍 <b>Samarqand hisobot (${format(today, 'dd.MM.yyyy')})</b>\n\n`;

      reportMsg += `📥 <b>Kirim (Samarqandga kelgan):</b>\n`;
      for (const [currency, total] of Object.entries(kirimTotals)) {
        reportMsg += `  • ${currency}: ${total.toLocaleString()}\n`;
      }

      reportMsg += `\n📤 <b>Chiqim (Samarqanddan ketgan):</b>\n`;
      for (const [currency, total] of Object.entries(chiqimTotals)) {
        reportMsg += `  • ${currency}: ${total.toLocaleString()}\n`;
      }

      await ctx.reply(reportMsg, { parse_mode: 'HTML' });
    });

    // --- /all_report ---
    this.bot.command('all_report', async (ctx) => {
      const telegramId = ctx.from?.id;
      if (!telegramId) return ctx.reply('Telegram ID topilmadi.');

      const user = await this.prisma.user.findUnique({ where: { telegramId } });
      if (!user || !user.isWhitelisted)
        return ctx.reply('❌ Sizda ruxsat yo‘q.');

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const operations = await this.prisma.operation.findMany({
        where: { createdAt: { gte: today, lt: tomorrow } },
      });

      if (!operations.length)
        return ctx.reply('📭 Bugun hech qanday operatsiya yo‘q.');

      // Har bir location bo‘yicha umumiy summani hisoblash
      const locationTotals: Record<string, Record<string, number>> = {};

      for (const op of operations) {
        const loc = op.receiverLocation;
        if (!locationTotals[loc]) locationTotals[loc] = {};
        locationTotals[loc][op.currency] =
          (locationTotals[loc][op.currency] || 0) + op.amount;
      }

      let reportMsg = `🌍 <b>Umumiy kunlik hisobot (${format(today, 'dd.MM.yyyy')})</b>\n\n`;

      for (const [loc, totals] of Object.entries(locationTotals)) {
        reportMsg += `🏙️ <b>${loc}:</b>\n`;
        for (const [currency, total] of Object.entries(totals)) {
          reportMsg += `  • ${currency}: ${total.toLocaleString()}\n`;
        }
        reportMsg += '\n';
      }

      const totalCount = operations.length;
      reportMsg += `📊 <b>Jami operatsiyalar:</b> ${totalCount}`;

      await ctx.reply(reportMsg, { parse_mode: 'HTML' });
    });

    // --- Text xabarlarni qabul qilish (shablon orqali operatsiya yaratish) ---
    this.bot.on('text', async (ctx) => {
      try {
        if (ctx.chat.type !== 'private') return;

        const telegramId = ctx.from?.id;
        if (!telegramId) return ctx.reply('Telegram ID topilmadi.');

        const user = await this.prisma.user.findUnique({
          where: { telegramId },
        });
        if (!user || !user.isWhitelisted)
          return ctx.reply('❌ Sizda ruxsat yo‘q.');

        const text = ctx.message.text;
        const opData = this.parseTemplateText(text);

        // Validator
        if (
          !opData.senderPhone ||
          !opData.receiverPhone ||
          !opData.amount ||
          !opData.currency
        ) {
          return ctx.reply("❌ Shablon noto‘g‘ri yoki yetarli ma'lumot yo‘q.");
        }

        // Bazaga yozish
        const operation = await this.prisma.operation.create({
          data: {
            ...opData,
            userId: user.id,
          },
          include: { user: true },
        });

        // // Foydalanuvchiga tasdiq
        // await ctx.reply(this.formatOperationMessage(operation), {
        //   parse_mode: 'HTML',
        // });

        // Guruhga yuborish
        await this.sendOperationToGroup(operation);
      } catch (err) {
        console.log(err);

        return ctx.reply("❌ Shablon noto‘g‘ri yoki yetarli ma'lumot yo‘q.");
      }
    });

    // Botni ishga tushurish
    this.bot.launch();
    this.logger.log('🤖 Telegram bot ishga tushdi!');
  }

  // --- Usage messages ---
  private usageMessageSam(): string {
    return `
👤 Jo‘natuvchi raqami: 998901234567  
📞 Qabul qiluvchi raqami: 998917654321  

📍 Jo‘natuvchi joyi: SKD  
🏙️ Qabul joyi: TAS 

💰 Summasi: 10000  
💵 Valyuta: USD

💬 Izoh: 10$ ol
`;
  }

  private usageMessageTosh(): string {
    return `
👤 Jo‘natuvchi raqami: 998901234567  
📞 Qabul qiluvchi raqami: 998917654321  

📍 Jo‘natuvchi joyi: TAS  
🏙️ Qabul joyi: SKD

💰 Summasi: 10000  
💵 Valyuta: USD

💬 Izoh: 10$ ol
`;
  }

  private parseTemplateText(text: string) {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const data: any = {};

    for (const line of lines) {
      // 👤 Jo‘natuvchi raqami
      if (line.startsWith('👤')) {
        data.senderPhone = line.split(':')[1]?.trim() || '';
      }

      // 📞 Qabul qiluvchi raqami
      else if (line.startsWith('📞')) {
        data.receiverPhone = line.split(':')[1]?.trim() || '';
      }

      // 📍 Jo‘natuvchi joyi
      else if (line.startsWith('📍')) {
        data.senderLocation = line.split(':')[1]?.trim() || '';
      }

      // 🏙️ Qabul joyi (emoji farqi bo‘lishi mumkin)
      else if (line.includes('Qabul') && line.includes('joy')) {
        data.receiverLocation = line.split(':')[1]?.trim() || '';
      }

      // 💰 Summasi
      else if (line.startsWith('💰')) {
        const amountRaw = line.split(':')[1]?.trim().replace(/,/g, '') || '0';
        data.amount = parseInt(amountRaw, 10);
      }

      // 💵 Valyuta
      else if (line.startsWith('💵')) {
        data.currency = line.split(':')[1]?.trim().toUpperCase() || 'UZS';
      }

      // 💬 Izoh (comment)
      else if (line.includes('💬')) {
        const raw = line.split('💬')[1] || '';
        data.comment = raw
          .replace(/<[^>]+>/g, '') // HTML teglardan tozalash
          .replace(/Izoh:?/gi, '') // "Izoh:" so‘zini olib tashlash
          .replace(/[{}]/g, '') // jingalak qavslarni olib tashlash
          .replace(/[:>]/g, '') // : va > belgilarini olib tashlash
          .trim(); // ortiqcha bo‘sh joylarni olib tashlash
      }
    }

    return data;
  }

  // --- Foydalanuvchiga tasdiq xabar ---
  //   private formatOperationMessage(op: any): string {
  //     return `
  // ✅ <b>Operatsiya muvaffaqiyatli qo‘shildi!</b>

  // 👤 <b>Jo‘natuvchi:</b> ${op.senderPhone}
  // 📞 <b>Qabul qiluvchi:</b> ${op.receiverPhone}
  // 📍 <b>Jo‘natilgan joy:</b> ${op.senderLocation}
  // 🏙️ <b>Qabul joyi:</b> ${op.receiverLocation}
  // 💰 <b>Summasi:</b> ${op.amount.toLocaleString()} ${op.currency}
  // 🪙 <b>Komissiya:</b> ${op.isNeedcomment ? 'Ha' : 'Yo‘q'}
  // 💸 Komissiya summasi: ${op.comment}

  // 🕒 <i>${new Date(op.createdAt).toLocaleString('uz-UZ')}</i>
  // `;
  //   }

  // --- Guruhga xabar yuborish ---
  private async sendOperationToGroup(op: any) {
    if (!this.groupId) {
      this.logger.warn(
        '⚠️ Guruh ID aniqlanmagan (.env da TELEGRAM_GROUP_ID yo‘q)',
      );
      return;
    }

    let borderEmoji = '🔷';
    if (op.receiverLocation === 'TAS') borderEmoji = '🟩';
    else if (op.receiverLocation === 'SKD') borderEmoji = '🟥';

    const borderLine = borderEmoji.repeat(12);
    const phone = formatPhone(op.receiverPhone);

    const groupMessage = `
${borderLine}

<b>${phone}</b>
<b>${op.senderLocation}</b> ➡️ <b>${op.receiverLocation}</b>
<b>${op.amount.toLocaleString()} ${op.currency}</b> 
<b>${op.comment || ''}</b>
`;

    try {
      await this.bot.telegram.sendMessage(this.groupId, groupMessage, {
        parse_mode: 'HTML',
      });
      this.logger.log(`📩 Operatsiya guruhga yuborildi (${this.groupId})`);
    } catch (err: any) {
      this.logger.error('❌ Guruhga xabar yuborishda xatolik:', err.message);
    }
  }
}
function formatPhone(phone: string): string {
  // Faqat raqamlarni olish
  const digits = phone.replace(/\D/g, '');

  // Oxirgi 9 raqamni olish (masalan, 998911234567 -> 911234567)
  const local = digits.slice(-9);

  // Formatlash: 91 123 45 67
  const formatted = `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`;
  return formatted;
}
