import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { Publication } from '../publications/entities/publication.entity';
import { OrderStatus } from '../common/enums/order-status.enum';
import { CustomersService } from '../customers/customers.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { QueryOrderDto } from './dto/query-order.dto';

/** Map of valid status transitions. */
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONTACTED, OrderStatus.CANCELLED],
  [OrderStatus.CONTACTED]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED],
  [OrderStatus.IN_PROGRESS]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(OrderStatusHistory)
    private readonly statusHistoryRepo: Repository<OrderStatusHistory>,
    @InjectRepository(Publication)
    private readonly publicationRepo: Repository<Publication>,
    private readonly customersService: CustomersService,
  ) {}

  /**
   * Create a new order.
   * 1. Find or create the customer by email.
   * 2. Validate publications exist and are active.
   * 3. Build order items with price snapshots.
   * 4. Calculate subtotal / total.
   * 5. Save order with items.
   * 6. Create initial status history entry.
   */
  async create(dto: CreateOrderDto): Promise<Order> {
    // 1. Find or create customer
    const customer = await this.customersService.findOrCreateByEmail(
      dto.customer,
    );

    // 2. Validate publications
    const publicationIds = dto.items.map((i) => i.publicationId);
    const publications = await this.publicationRepo.find({
      where: { id: In(publicationIds) },
    });

    if (publications.length !== publicationIds.length) {
      const foundIds = publications.map((p) => p.id);
      const missing = publicationIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `Publications not found: ${missing.join(', ')}`,
      );
    }

    const inactivePublications = publications.filter((p) => !p.isActive);
    if (inactivePublications.length > 0) {
      throw new BadRequestException(
        `The following publications are not active: ${inactivePublications.map((p) => p.title).join(', ')}`,
      );
    }

    // 3. Build order items
    const pubMap = new Map(publications.map((p) => [p.id, p]));
    const orderItems: OrderItem[] = dto.items.map((item) => {
      const pub = pubMap.get(item.publicationId)!;
      const orderItem = this.orderItemRepo.create({
        productTitle: pub.title,
        quantity: item.quantity,
        unitPrice: pub.price,
        totalPrice: Number(pub.price) * item.quantity,
        publication: pub,
      });
      return orderItem;
    });

    // 4. Calculate subtotal and total
    const subtotal = orderItems.reduce(
      (sum, item) => sum + Number(item.totalPrice),
      0,
    );

    // 5. Save order
    const order = this.orderRepo.create({
      customer,
      items: orderItems,
      subtotal,
      total: subtotal,
      customerNotes: dto.customerNotes ?? null,
      contactInfo: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
      },
    });

    const savedOrder = await this.orderRepo.save(order);

    // 6. Create initial status history
    const history = this.statusHistoryRepo.create({
      order: savedOrder,
      previousStatus: null,
      newStatus: OrderStatus.PENDING,
      note: 'Order created',
    });
    await this.statusHistoryRepo.save(history);

    // Return with relations
    return this.findOne(savedOrder.id);
  }

  /**
   * Paginated list of orders with optional filters.
   */
  async findAll(query: QueryOrderDto) {
    const { page, limit, status, customerId, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const qb = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .orderBy('order.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (status) {
      qb.andWhere('order.status = :status', { status });
    }

    if (customerId) {
      qb.andWhere('customer.id = :customerId', { customerId });
    }

    if (fromDate) {
      qb.andWhere('order.createdAt >= :fromDate', { fromDate });
    }

    if (toDate) {
      qb.andWhere('order.createdAt <= :toDate', { toDate });
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find a single order by ID with all relations.
   */
  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: {
        customer: true,
        items: { publication: true },
        statusHistory: { changedBy: true },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with id "${id}" not found`);
    }

    return order;
  }

  /**
   * Update the status of an order with transition validation.
   */
  async updateStatus(
    id: string,
    dto: UpdateOrderStatusDto,
    userId?: string,
  ): Promise<Order> {
    const order = await this.findOne(id);

    // Validate transition
    const allowed = VALID_TRANSITIONS[order.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from "${order.status}" to "${dto.status}". ` +
          `Valid transitions: ${allowed.length ? allowed.join(', ') : 'none'}`,
      );
    }

    // Create status history entry
    const history = this.statusHistoryRepo.create({
      order,
      previousStatus: order.status,
      newStatus: dto.status,
      note: dto.note ?? null,
      changedBy: userId ? ({ id: userId } as any) : null,
    });
    await this.statusHistoryRepo.save(history);

    // Update order status
    order.status = dto.status;
    await this.orderRepo.save(order);

    return this.findOne(id);
  }

  /**
   * Update order admin notes.
   */
  async update(id: string, dto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(id);
    Object.assign(order, dto);
    return this.orderRepo.save(order);
  }
}
