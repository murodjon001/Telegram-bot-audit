/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Injectable } from '@nestjs/common';
import { Update, Start, Hears, Action, Ctx } from 'nestjs-telegraf';
import { PrismaService } from 'src/config/prisma.service';
import { Markup, Scenes } from 'telegraf';
import type { BotContext, MySceneSession } from './bot.type';
import { Stage, WizardScene } from 'telegraf/typings/scenes';

@Update()
@Injectable()
export class BotService {
  private wizard = new WizardScene<BotContext, MySceneSession>(
    'op_wizard',
    async (ctx) => {
      await ctx.reply('Sender telefon:');
      return ctx.wizard.next();
    },
    async (ctx) => {
      if (!ctx.message || !('text' in ctx.message)) return;
      ctx.wizard.state.senderPhone = ctx.message.text;
      await ctx.reply('Reciever telefon:');
      return ctx.wizard.next();
    },
    // ... qolgan qadamlar
  );

  private stage = new Stage<BotContext, MySceneSession>([this.wizard]);

  // Stage middleware ni tashqariga chiqarish uchun
  public getStageMiddleware() {
    return this.stage.middleware();
  }

  constructor(private prisma: PrismaService) {}

  private async isWhitelisted(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { telegramId: id },
    });
    return user?.isWhitelisted ?? false;
  }

  @Start()
  async start(@Ctx() ctx: BotContext) {
    await ctx.reply('Salom! /new – operatsiya, /daily – hisob');
  }

  @Hears('/daily')
  async daily(@Ctx() ctx: BotContext) {
    if (!(await this.isWhitelisted(ctx?.from?.id || 0))) {
      return ctx.reply('Ruxsat yo‘q');
    }

    const today = new Date();
    const start = new Date(today.setHours(0, 0, 0, 0));
    const end = new Date(today.setHours(23, 59, 59, 999));

    const ops = await this.prisma.operation.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { amount: true, currency: true },
    });

    const sum: Record<string, number> = {};
    ops.forEach((o) => (sum[o.currency] = (sum[o.currency] || 0) + o.amount));

    const report =
      Object.entries(sum)
        .map(([c, a]) => `${c}: ${a}`)
        .join('\n') || 'Yo‘q';
    await ctx.reply(`Kunlik hisob:\n${report}`);
  }

  // WIZARD — session ishlaydi
  private wizard = new Scenes.WizardScene<any>(
    'op_wizard',
    async (ctx) => {
      await ctx.reply('Sender telefon:');
      return ctx.wizard.next();
    },
    async (ctx) => {
      ctx.scene.session.__scenes = {
        cursor: 1,
        state: { senderPhone: ctx.message?.text },
      };
      await ctx.reply('Reciever telefon:');
      return ctx.wizard.next();
    },
    async (ctx) => {
      ctx.scene.session.__scenes.state.recieverPhone = ctx.message?.text;
      await ctx.reply('Qayerdan:');
      return ctx.wizard.next();
    },
    async (ctx) => {
      ctx.scene.session.__scenes.state.senderLocation = ctx.message?.text;
      await ctx.reply('Qayerga:');
      return ctx.wizard.next();
    },
    async (ctx) => {
      ctx.scene.session.__scenes.state.recieverLocation = ctx.message?.text;
      await ctx.reply('Miqdor:');
      return ctx.wizard.next();
    },
    async (ctx) => {
      const amount = parseInt(ctx.message?.text ?? '', 10);
      if (isNaN(amount) || amount <= 0) return ctx.reply('Noto‘g‘ri! Qayta:');
      ctx.scene.session.__scenes.state.amount = amount;
      await ctx.reply('Valyuta (UZS/USD/RUB/EUR):');
      return ctx.wizard.next();
    },
    async (ctx) => {
      const cur = ctx.message?.text?.toUpperCase().trim();
      if (!['UZS', 'USD', 'RUB', 'EUR'].includes(cur!))
        return ctx.reply('Noto‘g‘ri valyuta!');
      ctx.scene.session.__scenes.state.currency = cur;

      const s = ctx.scene.session.__scenes.state;
      await ctx.reply(
        `Tasdiqlang:\n${s.senderPhone} → ${s.recieverPhone}\n${s.senderLocation} → ${s.recieverLocation}\n${s.amount} ${s.currency}`,
        Markup.inlineKeyboard([
          Markup.button.callback('Ha', 'yes'),
          Markup.button.callback('Yo‘q', 'no'),
        ]),
      );
    },
  );

  @Hears('/new')
  async newOp(@Ctx() ctx: BotContext) {
    console.log('new');

    if (!(await this.isWhitelisted(ctx?.from?.id || 0)))
      return ctx.reply('Ruxsat yo‘q');

    // console.log(ctx, 'ctx');

    ctx.scene.session.__scenes = {
      cursor: 0,
      state: {},
    };

    console.log(ctx.scene.enter('op_wizard'), 'check');

    return ctx.scene.enter('op_wizard');
  }

  @Action('yes')
  async confirm(@Ctx() ctx: BotContext) {
    const userId = ctx?.from?.id;

    console.log(userId);

    if (!(await this.isWhitelisted(userId || 0))) {
      return ctx.reply('Ruxsat yo‘q');
    }

    const s = ctx.wizard.state;
    if (!s.senderPhone || !s.amount) {
      return ctx.reply('Ma’lumotlar to‘liq emas. /new');
    }

    // DB ga saqlash
    const operation = await this.prisma.operation.create({
      data: {
        senderPhone: s.senderPhone,
        recieverPhone: s.recieverPhone,
        senderLocation: s.senderLocation!,
        recieverLocation: s.recieverLocation!,
        amount: s.amount,
        currency: s.currency,
        userId: userId || 1, // Int
      },
    });

    // GURUHGA YUBORISH
    const groupMessage = `
Yangi operatsiya!
ID: ${operation.id}
${s.senderPhone} → ${s.recieverPhone}
${s.senderLocation} → ${s.recieverLocation}
${s.amount} ${s.currency}
  `.trim();

    try {
      await ctx.telegram.sendMessage(process.env.GROUP_CHAT_ID!, groupMessage);
    } catch (err) {
      console.error('Guruhga yuborish xatosi:', err);
    }

    await ctx.reply('Saqlandi va guruhga yuborildi!');
    await ctx.scene.leave();
  }

  @Action('no')
  async cancel(@Ctx() ctx: BotContext) {
    await ctx.reply('Bekor qilindi');
    await ctx.scene.leave();
  }
}
