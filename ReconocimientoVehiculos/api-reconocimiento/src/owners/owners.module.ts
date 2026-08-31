import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OwnersService } from './owners.service.js';
import { OwnersController } from './owners.controller.js';
import { Persona } from './models/owner.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Persona])],
  controllers: [OwnersController],
  providers: [OwnersService],
  exports: [OwnersService],
})
export class OwnersModule {}
