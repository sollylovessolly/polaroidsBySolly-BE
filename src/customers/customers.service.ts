import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerFiltersDto } from './dto/customer-filters.dto';
import { PhoneNumberService } from './phone-number.service';
import { paginated, pagination } from '../common/dto/pagination.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly phones: PhoneNumberService,
  ) {}
  async findAll(filters: CustomerFiltersDto = {}) {
    const search = filters.search?.trim();
    const where: Prisma.CustomerWhereInput = {
      isArchived: filters.archived ?? false,
      ...(filters.phone
        ? { phone: { in: this.phones.lookupCandidates(filters.phone) } }
        : {}),
      ...(filters.email
        ? { email: { contains: filters.email, mode: 'insensitive' } }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const { page, limit, skip, take } = pagination(filters);
    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        include: {
          orders: {
            select: { paymentStatus: true, totalAmount: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.customer.count({ where }),
    ]);
    return paginated(
      customers.map((customer) => this.summary(customer)),
      total,
      page,
      limit,
    );
  }
  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        orders: {
          select: {
            orderNumber: true,
            source: true,
            status: true,
            paymentStatus: true,
            totalAmount: true,
            deliveryState: true,
            createdAt: true,
            paidAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!customer)
      throw new NotFoundException(`Customer with ID "${id}" was not found`);
    return { ...this.summary(customer), orders: customer.orders };
  }
  async archive(id: string, archived: boolean) {
    await this.findOne(id);
    return this.prisma.customer.update({
      where: { id },
      data: { isArchived: archived },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        isArchived: true,
      },
    });
  }
  private summary(customer: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    isArchived: boolean;
    orders: Array<{
      paymentStatus: PaymentStatus;
      totalAmount: Prisma.Decimal;
      createdAt: Date;
    }>;
  }) {
    const paid = customer.orders.filter(
      (order) => order.paymentStatus === PaymentStatus.PAID,
    );
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      isArchived: customer.isArchived,
      totalOrders: customer.orders.length,
      paidOrders: paid.length,
      totalSpent: paid.reduce(
        (sum, order) => sum.plus(order.totalAmount),
        new Prisma.Decimal(0),
      ),
      lastOrderAt: customer.orders[0]?.createdAt ?? null,
    };
  }
}
