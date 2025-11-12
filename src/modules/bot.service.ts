/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/config/prisma.service';
import { Telegraf, Context } from 'telegraf';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Markup } from 'telegraf';
import { uz } from 'date-fns/locale';

const TASHKENT_TZ = 'Asia/Tashkent';

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);
  private readonly bot: Telegraf<Context>;
  private readonly groupId: string;

  constructor(private readonly prisma: PrismaService) {
    try {
      this.bot = new Telegraf(process.env.BOT_TOKEN as string);
      this.groupId = process.env.TELEGRAM_GROUP_ID as string;
      this.logger.log(`TELEGRAM_GROUP_ID: ${this.groupId}`);

      const mainMenuKeyboard = Markup.keyboard([
        ['📄 Shablon Tosh', '📄 Shablon Sam'], // 1-qator: shablonlar
        ['📊 Tosh Hisobot', '📊 Sam Hisobot', '📊 Umumiy hisobot'], // 2-qator: hisobotlar
        ['📅 Haftalik Hisobot'], // 3-qator: weekly
      ])
        .oneTime()
        .resize();

      /** /start komandasi **/
      this.bot.start(async (ctx) => {
        try {
          const telegramId = ctx.from?.id;
          const username = ctx.from?.username || 'foydalanuvchi';

          if (!telegramId) return ctx.reply('Xatolik: Telegram ID topilmadi.');

          const user = await this.prisma.user.findUnique({
            where: { telegramId: String(telegramId) },
          });

          if (!user || !user.isWhitelisted) {
            return ctx.reply(
              '❌ Sizga bu botdan foydalanishga ruxsat berilmagan.',
            );
          }

          await ctx.reply(
            `👋 Salom, ${username}!\nQuyidagi tugmalar orqali ishni boshlang:`,
            mainMenuKeyboard,
          );
        } catch (err) {
          this.logger.error('❌ /start komandasi xatosi:', err);
          ctx.reply('Xatolik yuz berdi.');
        }
      });

      // --- Inline callback: REPORT_DAY_YYYY-MM-DD ---
      this.bot.action(/REPORT_DAY_(\d{4}-\d{2}-\d{2})/, async (ctx) => {
        try {
          await ctx.answerCbQuery(); // yuklanish animatsiyasini to‘xtatish
          const telegramId = ctx.from?.id;
          if (!telegramId) return ctx.reply('Telegram ID topilmadi.');

          const user = await this.prisma.user.findUnique({
            where: { telegramId: String(telegramId) },
          });
          if (!user || !user.isWhitelisted)
            return ctx.reply('❌ Sizda ruxsat yo‘q.');

          const dateStr = ctx.match[1];
          const date = new Date(dateStr);
          const tzDate = toZonedTime(date, TASHKENT_TZ);

          const start = startOfDay(tzDate);
          const end = endOfDay(tzDate);

          // Shu kunlik operatsiyalarni olish
          const operations = await this.prisma.operation.findMany({
            where: { createdAt: { gte: start, lt: end } },
          });

          if (!operations.length) {
            return ctx.reply(
              `📭 ${format(date, 'dd MMM (EEEE)', { locale: uz })} kuni hech qanday operatsiya yo‘q.`,
            );
          }

          // Har bir location bo‘yicha umumiy summani hisoblash
          const locationTotals: Record<string, Record<string, number>> = {};

          for (const op of operations) {
            const loc = op.receiverLocation;
            if (!locationTotals[loc]) locationTotals[loc] = {};
            locationTotals[loc][op.currency] =
              (locationTotals[loc][op.currency] || 0) + op.amount;
          }

          // Hisobot xabari
          let reportMsg = `📅 <b>${format(date, 'dd MMMM, EEEE', { locale: uz })}</b>\n\n`;

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
        } catch (err) {
          this.logger.error('❌ REPORT_DAY callback xatosi:', err);
          ctx.reply('Xatolik yuz berdi, qayta urinib ko‘ring.');
        }
      });

      this.bot.hears('📊 Umumiy hisobot', async (ctx) => {
        try {
          const telegramId = ctx.from?.id;
          if (!telegramId) return ctx.reply('Telegram ID topilmadi.');

          const user = await this.prisma.user.findUnique({
            where: { telegramId: String(telegramId) },
          });
          if (!user || !user.isWhitelisted)
            return ctx.reply('❌ Sizda ruxsat yo‘q.');

          // --- Toshkent vaqtini olish ---
          const now = new Date();
          const TASHKENT_TZ = 'Asia/Tashkent';
          const tzNow = toZonedTime(now, TASHKENT_TZ);
          const start = startOfDay(tzNow);
          const end = endOfDay(tzNow);

          // --- Bugungi barcha operatsiyalarni olish ---
          const operations = await this.prisma.operation.findMany({
            where: { createdAt: { gte: start, lt: end } },
          });

          if (!operations.length)
            return ctx.reply('📭 Bugun hech qanday operatsiya yo‘q.');

          // --- Location bo‘yicha guruhlash ---
          const locationTotals: Record<string, Record<string, number>> = {};
          for (const op of operations) {
            const loc = op.receiverLocation;
            if (!locationTotals[loc]) locationTotals[loc] = {};
            locationTotals[loc][op.currency] =
              (locationTotals[loc][op.currency] || 0) + op.amount;
          }

          // --- Hisobot xabarini shakllantirish ---
          let reportMsg = `📅 <b>Bugungi umumiy hisobot (${format(
            tzNow,
            'dd MMMM, EEEE',
            { locale: uz },
          )})</b>\n\n`;

          for (const [loc, totals] of Object.entries(locationTotals)) {
            reportMsg += `🏙️ <b>${loc}:</b>\n`;
            for (const [currency, total] of Object.entries(totals)) {
              reportMsg += `  • ${currency}: ${total.toLocaleString()}\n`;
            }
            reportMsg += '\n';
          }

          reportMsg += `📊 <b>Jami operatsiyalar:</b> ${operations.length}`;
          await ctx.reply(reportMsg, { parse_mode: 'HTML' });
        } catch (err) {
          this.logger.error('❌ Umumiy hisobotda xatolik:', err);
          ctx.reply('Xatolik yuz berdi, qayta urinib ko‘ring.');
        }
      });

      this.bot.hears('📄 Shablon Tosh', async (ctx) => {
        await ctx.telegram.sendMessage(ctx.chat.id, this.usageMessageTosh());
      });

      this.bot.hears('📄 Shablon Sam', async (ctx) => {
        await ctx.telegram.sendMessage(ctx.chat.id, this.usageMessageSam());
      });

      this.bot.hears('📊 Tosh Hisobot', async (ctx) => {
        await this.handleDailyReport(ctx, 'TAS', 'Toshkent');
      });

      this.bot.hears('📊 Sam Hisobot', async (ctx) => {
        await this.handleDailyReport(ctx, 'SKD', 'Samarqand');
      });

      this.bot.hears('📅 Haftalik Hisobot', async (ctx) => {
        await this.sendWeeklyInlineKeyboard(ctx);
      });

      /** Text handler **/
      this.bot.on('text', async (ctx) => {
        try {
          if (ctx.chat.type !== 'private') return;
          const telegramId = ctx.from?.id;
          if (!telegramId) return ctx.reply('Telegram ID topilmadi.');

          const user = await this.prisma.user.findUnique({
            where: { telegramId: String(telegramId) },
          });
          if (!user || !user.isWhitelisted)
            return ctx.reply('❌ Sizda ruxsat yo‘q.');

          const opData = this.parseTemplateText(ctx.message.text);
          if (
            !opData.senderPhone ||
            !opData.receiverPhone ||
            !opData.amount ||
            !opData.currency
          )
            return ctx.reply(
              "❌ Shablon noto‘g‘ri yoki yetarli ma'lumot yo‘q.",
            );

          const now = toZonedTime(new Date(), TASHKENT_TZ);
          const operation = await this.prisma.operation.create({
            data: { createdAt: now, ...opData, userId: user.id },
            include: { user: true },
          });

          await this.sendOperationToGroup(operation);
        } catch (err) {
          this.logger.error('❌ Matnli xabarni qayta ishlashda xatolik:', err);
          ctx.reply("❌ Shablon noto‘g‘ri yoki yetarli ma'lumot yo‘q.");
        }
      });

      /** Botni ishga tushirish **/
      this.bot
        .launch()
        .then(() => {
          this.logger.log('🤖 Telegram bot ishga tushdi!');
        })
        .catch((err) => {
          this.logger.error('❌ Botni ishga tushirishda xatolik:', err);
        });
    } catch (err) {
      this.logger.error('❌ BotService konstruktorida xatolik:', err);
    }
  }

  async sendWeeklyInlineKeyboard(ctx) {
    const now = new Date();
    const days: { label: string; value: string }[] = [];

    // Oxirgi 7 kunni orqadan boshlab olish (bugun, kecha, ... 6 kun oldin)
    for (let i = 0; i < 7; i++) {
      const date = subDays(now, i);
      const dateLabel = format(date, 'dd MMM', { locale: uz }); // masalan "12 Noy"
      const dateValue = format(date, 'yyyy-MM-dd'); // masalan "2025-11-12"
      days.push({ label: dateLabel, value: dateValue });
    }

    // Inline tugmalarni 2 ustunli qilib chiqaramiz
    const buttons: any = [];
    for (let i = 0; i < days.length; i += 2) {
      const row: any = [];
      row.push(
        Markup.button.callback(days[i].label, `REPORT_DAY_${days[i].value}`),
      );
      if (days[i + 1]) {
        row.push(
          Markup.button.callback(
            days[i + 1].label,
            `REPORT_DAY_${days[i + 1].value}`,
          ),
        );
      }
      buttons.push(row);
    }

    await ctx.reply(
      '🗓 So‘nggi 7 kunlik hisobotdan birini tanlang:',
      Markup.inlineKeyboard(buttons),
    );
  }

  private async handleDailyReport(
    ctx: any,
    code: 'TAS' | 'SKD',
    cityName: string,
  ) {
    try {
      const now = toZonedTime(new Date(), 'Asia/Tashkent');
      const today = startOfDay(now);
      const tomorrow = endOfDay(now);

      const operations = await this.prisma.operation.findMany({
        where: { createdAt: { gte: today, lt: tomorrow } },
      });

      if (!operations.length)
        return ctx.reply(
          `📭 Bugun ${cityName} uchun hech qanday operatsiya yo‘q.`,
        );

      const chiqim = operations.filter((op) => op.receiverLocation === code);
      const kirim = operations.filter((op) => op.senderLocation === code);

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

      let reportMsg = `🏙️ <b>${cityName} hisobot (${format(today, 'dd.MM.yyyy')})</b>\n\n`;

      reportMsg += `📥 <b>Kirim:</b>\n`;
      for (const [currency, total] of Object.entries(kirimTotals)) {
        reportMsg += `  • ${currency}: ${total.toLocaleString()}\n`;
      }

      reportMsg += `\n📤 <b>Chiqim:</b>\n`;
      for (const [currency, total] of Object.entries(chiqimTotals)) {
        reportMsg += `  • ${currency}: ${total.toLocaleString()}\n`;
      }

      await ctx.reply(reportMsg, { parse_mode: 'HTML' });
    } catch (err) {
      this.logger.error('Hisobot xatolik:', err);
      ctx.reply('❌ Hisobot olishda xatolik yuz berdi.');
    }
  }

  private usageMessageSam() {
    return `👤 Jo‘natuvchi raqami: 998901234567
📞 Qabul qiluvchi raqami: 998917654321
📍 Jo‘natuvchi joyi: SKD
🏙️ Qabul joyi: TAS
💰 Summasi: 10000
💵 Valyuta: USD
💬 Izoh: 10$ ol`;
  }

  private usageMessageTosh() {
    return `👤 Jo‘natuvchi raqami: 998901234567
📞 Qabul qiluvchi raqami: 998917654321
📍 Jo‘natuvchi joyi: TAS
🏙️ Qabul joyi: SKD
💰 Summasi: 10000
💵 Valyuta: USD
💬 Izoh: 10$ ol`;
  }

  private parseTemplateText(text: string) {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const data: any = {};
    for (const line of lines) {
      if (line.startsWith('👤')) data.senderPhone = line.split(':')[1]?.trim();
      else if (line.startsWith('📞'))
        data.receiverPhone = line.split(':')[1]?.trim();
      else if (line.startsWith('📍'))
        data.senderLocation = line.split(':')[1]?.trim();
      else if (line.includes('Qabul'))
        data.receiverLocation = line.split(':')[1]?.trim();
      else if (line.startsWith('💰'))
        data.amount = parseInt(
          line.split(':')[1]?.replace(/,/g, '') || '0',
          10,
        );
      else if (line.startsWith('💵'))
        data.currency = line.split(':')[1]?.trim().toUpperCase() || 'UZS';
      else if (line.includes('💬')) {
        data.comment = line
          .split('💬')[1]
          ?.replace(/<[^>]+>/g, '')
          .replace(/Izoh:?/gi, '')
          .replace(/[{}]/g, '')
          .replace(/[:>]/g, '')
          .trim();
      }
    }
    return data;
  }

  private async sendOperationToGroup(op: any) {
    try {
      if (!this.groupId) {
        this.logger.warn(
          '⚠️ Guruh ID aniqlanmagan (.env da TELEGRAM_GROUP_ID yo‘q)',
        );
        return;
      }

      let borderEmoji = '🔷';
      if (op.receiverLocation === 'TAS') borderEmoji = '🟩';
      else if (op.receiverLocation === 'SKD') borderEmoji = '🟥';

      const phone = formatPhone(op.receiverPhone);
      const msg = `${borderEmoji.repeat(12)}\n\n<b>${phone}</b>\n<b>${op.senderLocation}</b> ➡️ <b>${op.receiverLocation}</b>\n<b>${op.amount.toLocaleString()} ${op.currency}</b>\n<b>${op.comment || ''}</b>`;

      await this.bot.telegram.sendMessage(this.groupId, msg, {
        parse_mode: 'HTML',
      });
      this.logger.log(`📩 Operatsiya guruhga yuborildi (${this.groupId})`);
    } catch (err) {
      this.logger.error('❌ Guruhga xabar yuborishda xatolik:', err);
    }
  }
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const local = digits.slice(-9);
  return `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`;
}
