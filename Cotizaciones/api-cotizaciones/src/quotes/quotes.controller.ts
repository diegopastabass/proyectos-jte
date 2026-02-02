import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('quotes')
@UseGuards(AuthGuard('jwt')) // Protege todas las rutas
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  create(@Body() createQuoteDto: CreateQuoteDto, @Request() req) {
    // req.user viene del JwtStrategy
    return this.quotesService.create(createQuoteDto, req.user);
  }

  @Get()
  findAll(@Request() req) {
    return this.quotesService.findAllByUser(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.quotesService.findOne(id, req.user.id);
  }
}
