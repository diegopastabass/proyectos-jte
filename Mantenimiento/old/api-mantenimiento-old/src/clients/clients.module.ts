// clients.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from './clients.entity';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [TypeOrmModule.forFeature([Client])],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
