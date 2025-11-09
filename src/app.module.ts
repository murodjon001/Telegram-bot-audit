import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';
import { BotModule } from './modules/bot.module';
import { session } from 'telegraf';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // bu .env ni butun app bo‘ylab global qiladi
      envFilePath: '.env', // kerak bo‘lsa yo‘lni ko‘rsatish mumkin
    }),
    TelegrafModule.forRoot({
      token: process.env.BOT_TOKEN as string,
      middlewares: [session()],
    }),
    BotModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
