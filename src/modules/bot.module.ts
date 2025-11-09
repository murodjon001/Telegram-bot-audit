/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
// bot.module.ts

import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { BotService } from './bot.service';
import { session } from 'telegraf';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      useFactory: (botService: BotService) => ({
        token: process.env.BOT_TOKEN!,
        middlewares: [
          session(), // MUTLAQ kerak
          botService.getStageMiddleware.apply(), // Stage middleware
        ],
      }),
      inject: [BotService],
    }),
  ],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
