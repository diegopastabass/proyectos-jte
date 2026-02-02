import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quote } from './entities/quotes.entity';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class QuotesService {
  constructor(
    @InjectRepository(Quote)
    private readonly quoteRepository: Repository<Quote>,
  ) {}

  // Crear cotización
  async create(createQuoteDto: CreateQuoteDto, user: User): Promise<Quote> {
    const quote = this.quoteRepository.create({
      client_name: createQuoteDto.clientName,
      total_amount: createQuoteDto.totalAmount,
      description: createQuoteDto.description,
      user: user,
    });

    return this.quoteRepository.save(quote);
  }

  // Obtener todas (del usuario actual)
  async findAllByUser(userId: string): Promise<Quote[]> {
    return this.quoteRepository.find({
      where: { user: { id: userId } },
      order: { created_at: 'DESC' },
    });
  }

  // Obtener una por ID
  async findOne(id: string, userId: string): Promise<Quote> {
    const quote = await this.quoteRepository.findOne({
      where: { id, user: { id: userId } },
    });

    if (!quote) throw new NotFoundException(`Quote with id ${id} not found`);
    return quote;
  }
}
