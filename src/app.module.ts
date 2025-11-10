import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BotModule } from './modules/bot.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // bu .env ni butun app bo‘ylab global qiladi
      envFilePath: '.env', // kerak bo‘lsa yo‘lni ko‘rsatish mumkin
    }),
    BotModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
