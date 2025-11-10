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

    // --- /report komandasi ---
    this.bot.command('report', async (ctx) => {
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

      const totals = operations.reduce(
        (acc, op) => {
          acc[op.currency] = (acc[op.currency] || 0) + op.amount;
          return acc;
        },
        {} as Record<string, number>,
      );

      let reportMsg = `📅 <b>Bugungi (${format(today, 'dd.MM.yyyy')}) hisobot:</b>\n\n`;
      for (const [currency, total] of Object.entries(totals)) {
        reportMsg += `💵 <b>${currency}:</b> ${total.toLocaleString()}\n`;
      }
      reportMsg += `\n📊 <b>Jami operatsiyalar:</b> ${operations.length}`;

      await ctx.reply(reportMsg, { parse_mode: 'HTML' });
    });

    // --- Text xabarlarni qabul qilish (shablon orqali operatsiya yaratish) ---
    this.bot.on('text', async (ctx) => {
      const telegramId = ctx.from?.id;
      if (!telegramId) return ctx.reply('Telegram ID topilmadi.');

      const user = await this.prisma.user.findUnique({ where: { telegramId } });
      if (!user || !user.isWhitelisted)
        return ctx.reply('❌ Sizda ruxsat yo‘q.');

      const text = ctx.message.text;
      const opData = this.parseTemplateText(text);

      // Validator
      if (
        !opData.senderPhone ||
        !opData.recieverPhone ||
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

      // Foydalanuvchiga tasdiq
      await ctx.reply(this.formatOperationMessage(operation), {
        parse_mode: 'HTML',
      });

      // Guruhga yuborish
      await this.sendOperationToGroup(operation);
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
📍 Jo‘natuvchi joyi: Samarqand  
🏙️ Qabul joyi: Toshkent  
💰 Summasi: 10000  
💵 Valyuta: USD
🪙 Komissiya: Ha
`;
  }

  private usageMessageTosh(): string {
    return `
👤 Jo‘natuvchi raqami: 998901234567  
📞 Qabul qiluvchi raqami: 998917654321  
📍 Jo‘natuvchi joyi: Toshkent  
🏙️ Qabul joyi: Samarqand
💰 Summasi: 10000  
💵 Valyuta: USD
🪙 Komissiya: Ha
`;
  }

  private parseTemplateText(text: string) {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const data: any = {};

    for (const line of lines) {
      if (line.startsWith('👤')) data.senderPhone = line.split(':')[1].trim();
      else if (line.startsWith('📞'))
        data.recieverPhone = line.split(':')[1].trim();
      // Sender location
      else if (line.startsWith('📍'))
        data.senderLocation = line.split(':')[1].trim();
      // Receiver location, qaysi emoji bo‘lishidan qat’i nazar
      else if (line.includes('Qabul') && line.includes('joy')) {
        data.recieverLocation = line.split(':')[1].trim();
      } else if (line.startsWith('💰'))
        data.amount = parseInt(line.split(':')[1].trim().replace(/,/g, ''), 10);
      else if (line.startsWith('💵'))
        data.currency = line.split(':')[1].trim().toUpperCase();
      else if (line.startsWith('🪙'))
        data.isFree = line.split(':')[1].trim().toLowerCase() === 'ha';
    }

    return data;
  }

  // --- Foydalanuvchiga tasdiq xabar ---
  private formatOperationMessage(op: any): string {
    return `
✅ <b>Operatsiya muvaffaqiyatli qo‘shildi!</b>

👤 <b>Jo‘natuvchi:</b> ${op.senderPhone}
📞 <b>Qabul qiluvchi:</b> ${op.recieverPhone}
📍 <b>Jo‘natilgan joy:</b> ${op.senderLocation}
🏙️ <b>Qabul joyi:</b> ${op.recieverLocation}
💰 <b>Summasi:</b> ${op.amount.toLocaleString()} ${op.currency}
🪙 <b>Komissiya:</b> ${op.isFree ? 'Yo‘q' : 'Ha'}

🕒 <i>${new Date(op.createdAt).toLocaleString('uz-UZ')}</i>
`;
  }

  // --- Guruhga xabar yuborish ---
  private async sendOperationToGroup(op: any) {
    if (!this.groupId) {
      this.logger.warn(
        '⚠️ Guruh ID aniqlanmagan (.env da TELEGRAM_GROUP_ID yo‘q)',
      );
      return;
    }

    const groupMessage = `
📢 <b>Yangi operatsiya!</b>

👤 <b>Foydalanuvchi:</b> ${op.user.username || 'Noma’lum'}
📞 <b>Jo‘natuvchi:</b> ${op.senderPhone}
📞 <b>Qabul qiluvchi:</b> ${op.recieverPhone}
📍 <b>Jo‘natilgan joy:</b> ${op.senderLocation}
🏙️ <b>Qabul joyi:</b> ${op.recieverLocation}
💰 <b>Summasi:</b> ${op.amount.toLocaleString()} ${op.currency}
🪙 <b>Komissiya:</b> ${op.isFree ? 'Ha' : 'Yo‘q'}

🕒 <i>${new Date(op.createdAt).toLocaleString('uz-UZ')}</i>
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
