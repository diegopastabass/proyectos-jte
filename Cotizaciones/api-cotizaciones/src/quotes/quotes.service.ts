import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Quote } from './entities/quote.entity';
import { CreateQuoteDto } from './dto/create-quote.dto';
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
      return {
        message: 'Error al crear la cotización',
      };
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

  private async generateFolio(): Promise<string> {
    const now = new Date();
    const datePart = now.toISOString().slice(2, 10).replace(/-/g, '');

    const count = await this.quoteRepository.count({
      where: {
        folio: Like(`${datePart}-%`),
      },
    });

    return `${datePart}-${count + 1}`;
  }
}
