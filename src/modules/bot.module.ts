import { Module } from '@nestjs/common';
// import { ScheduleModule } from '@nestjs/schedule';
import { BotService } from './bot.service';
import { PrismaService } from 'src/config/prisma.service';

@Module({
  // imports: [ScheduleModule.forRoot({})],
  providers: [BotService, PrismaService],
})
export class BotModule {}
