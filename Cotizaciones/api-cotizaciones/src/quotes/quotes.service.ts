import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Quote } from './entities/quote.entity';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class QuotesService {
  constructor(
    @InjectRepository(Quote)
    private readonly quoteRepository: Repository<Quote>,
  ) {}

  async create(
    createQuoteDto: CreateQuoteDto,
    user: User,
  ): Promise<{ message: string; quote?: Quote }> {
    try {
      const folio = await this.generateFolio();

      const quote = this.quoteRepository.create({
        folio: folio,
        data: createQuoteDto.data,
        user: user,
      });

      return {
        message: 'Cotización creada exitosamente',
        quote: await this.quoteRepository.save(quote),
      };
    } catch (error) {
      console.log(error);
      return { message: 'Error al crear la cotización' };
    }
  }

  async findAllByUser(userId: string): Promise<Quote[]> {
    return this.quoteRepository.find({
      where: { user: { id: userId } },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Quote> {
    const quote = await this.quoteRepository.findOne({
      where: { id, user: { id: userId } },
    });

    if (!quote) throw new NotFoundException(`Quote with id ${id} not found`);
    return quote;
  }

  async update(
    id: string,
    updateQuoteDto: UpdateQuoteDto,
    userId: string,
  ): Promise<Quote> {
    const quote = await this.findOne(id, userId);
    quote.data = updateQuoteDto.data;
    return this.quoteRepository.save(quote);
  }

  async remove(id: string, userId: string): Promise<{ message: string }> {
    const quote = await this.findOne(id, userId);
    await this.quoteRepository.remove(quote);

    return { message: 'Cotización eliminada correctamente' };
  }

  private async generateFolio(): Promise<string> {
    const now = new Date();
    const datePart = now.toISOString().slice(2, 10).replace(/-/g, '');

    const lastQuote = await this.quoteRepository.findOne({
      where: { folio: Like(`${datePart}-%`) },
      order: { created_at: 'DESC' },
    });

    if (lastQuote) {
      const parts = lastQuote.folio.split('-');
      const lastNumber = parseInt(parts[parts.length - 1], 10);

      return `${datePart}-${lastNumber + 1}`;
    } else {
      return `${datePart}-1`;
    }
  }
}
