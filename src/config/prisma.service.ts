import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { execSync } from 'child_process';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
  }

  runMigrations(): void {
    this.logger.log('Starting migrations...');
    execSync('npx prisma migrate deploy');
    this.logger.log('Migrations completed');
  }
}
