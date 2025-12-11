import { Controller, Get, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Roles('0')
  @Get('find/:id')
  async find(@Param('id') id: string) {
    const user = await this.usersService.findOneById(id);
    const { password_hash, ...rest } = user as any;
    return rest;
  }

  @Roles('0')
  @Get('email/:email')
  async findByEmail(@Param('email') email: string) {
    const user = await this.usersService.findByEmail(email);
    const { password_hash, ...rest } = user as any;
    return rest;
  }
}
