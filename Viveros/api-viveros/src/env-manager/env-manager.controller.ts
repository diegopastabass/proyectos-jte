import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { EnvManagerService } from './env-manager.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('env')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnvManagerController {
  constructor(private readonly envService: EnvManagerService) {}

  @Get()
  @Roles('0')
  getEnv() {
    return this.envService.readEnv();
  }

  @Patch()
  @Roles('0')
  updateEnv(@Body() body: Record<string, string>) {
    this.envService.updateEnv(body);
    return { message: 'Environment file updated successfully' };
  }
}
