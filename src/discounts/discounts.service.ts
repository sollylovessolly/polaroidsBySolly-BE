import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DiscountType, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';

@Injectable()
export class DiscountsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateDiscountDto) {
    this.validateDefinition(dto.type, dto.value, dto.startsAt, dto.endsAt);
    return this.prisma.discountCode.create({
      data: {
        ...dto,
        code: this.normalize(dto.code),
        value: new Prisma.Decimal(dto.value),
        minimumOrderAmount:
          dto.minimumOrderAmount === undefined
            ? undefined
            : new Prisma.Decimal(dto.minimumOrderAmount),
      },
    });
  }

  findAll() {
    return this.prisma.discountCode.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const discount = await this.prisma.discountCode.findUnique({
      where: { id },
    });
    if (!discount)
      throw new NotFoundException(`Discount with ID "${id}" was not found`);
    return discount;
  }

  async update(id: string, dto: UpdateDiscountDto) {
    const current = await this.findOne(id);
    const type = dto.type ?? current.type;
    const value = dto.value ?? Number(current.value);
    const startsAt =
      dto.startsAt === undefined
        ? (current.startsAt ?? undefined)
        : dto.startsAt;
    const endsAt =
      dto.endsAt === undefined ? (current.endsAt ?? undefined) : dto.endsAt;
    this.validateDefinition(type, value, startsAt, endsAt);
    return this.prisma.discountCode.update({
      where: { id },
      data: {
        ...dto,
        code: dto.code ? this.normalize(dto.code) : undefined,
        value:
          dto.value === undefined ? undefined : new Prisma.Decimal(dto.value),
        minimumOrderAmount:
          dto.minimumOrderAmount === undefined
            ? undefined
            : new Prisma.Decimal(dto.minimumOrderAmount),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.discountCode.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async calculate(
    code: string | undefined,
    subtotal: number,
    tx: Prisma.TransactionClient,
  ) {
    if (!code?.trim()) return { amount: 0, code: null };
    const normalized = this.normalize(code);
    const discount = await tx.discountCode.findUnique({
      where: { code: normalized },
    });
    const now = new Date();
    if (
      !discount ||
      !discount.isActive ||
      (discount.startsAt && discount.startsAt > now) ||
      (discount.endsAt && discount.endsAt < now)
    ) {
      throw new BadRequestException('Discount code is invalid or unavailable');
    }
    if (
      discount.minimumOrderAmount &&
      new Prisma.Decimal(subtotal).lessThan(discount.minimumOrderAmount)
    ) {
      throw new BadRequestException(
        `Discount requires a minimum product subtotal of ₦${discount.minimumOrderAmount.toString()}`,
      );
    }
    const raw =
      discount.type === DiscountType.PERCENTAGE
        ? new Prisma.Decimal(subtotal).times(discount.value).dividedBy(100)
        : discount.value;
    const amount = Prisma.Decimal.min(
      raw,
      new Prisma.Decimal(subtotal),
    ).toDecimalPlaces(2);
    return { amount: amount.toNumber(), code: normalized };
  }

  private normalize(code: string) {
    return code.trim().toUpperCase();
  }

  private validateDefinition(
    type: DiscountType,
    value: number,
    startsAt?: Date,
    endsAt?: Date,
  ) {
    if (type === DiscountType.PERCENTAGE && value > 100)
      throw new BadRequestException('Percentage discount cannot exceed 100');
    if (startsAt && endsAt && startsAt >= endsAt)
      throw new BadRequestException('startsAt must be before endsAt');
  }
}
