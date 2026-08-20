import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { CreateDeliveryRateDto } from './dto/create-delivery-rate.dto';
import { UpdateDeliveryRateDto } from './dto/update-delivery-rate.dto';

@Injectable()
export class DeliveryRatesService {
  constructor(private readonly prisma: PrismaService) {}

  normalizeState(state: string) {
    return state.trim().toLocaleLowerCase('en-NG');
  }

  async resolve(
    state: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const normalizedState = this.normalizeState(state);
    const rate = await client.deliveryRate.findUnique({
      where: { normalizedState },
    });

    if (!rate || !rate.isActive) {
      throw new BadRequestException(
        `Delivery rate is not configured for ${state.trim() || 'this state'}`,
      );
    }

    return rate;
  }

  async findAll() {
    return this.prisma.deliveryRate.findMany({
      where: { isActive: true },
      select: { state: true, fee: true, isActive: true },
      orderBy: { state: 'asc' },
    });
  }

  async findByState(state: string) {
    const rate = await this.prisma.deliveryRate.findUnique({
      where: { normalizedState: this.normalizeState(state) },
    });

    return rate?.isActive
      ? { state: rate.state, fee: rate.fee, available: true }
      : { state: state.trim(), available: false };
  }

  async create(dto: CreateDeliveryRateDto) {
    const normalizedState = this.normalizeState(dto.state);
    const existing = await this.prisma.deliveryRate.findUnique({
      where: { normalizedState },
    });

    if (existing) {
      throw new ConflictException(
        `A delivery rate for ${existing.state} already exists`,
      );
    }

    return this.prisma.deliveryRate.create({
      data: {
        state: this.displayState(dto.state),
        normalizedState,
        fee: dto.fee,
      },
    });
  }

  async update(id: string, dto: UpdateDeliveryRateDto) {
    const current = await this.findOne(id);
    const normalizedState = dto.state
      ? this.normalizeState(dto.state)
      : current.normalizedState;

    const duplicate = await this.prisma.deliveryRate.findFirst({
      where: { normalizedState, NOT: { id } },
    });

    if (duplicate) {
      throw new ConflictException(
        `A delivery rate for ${duplicate.state} already exists`,
      );
    }

    return this.prisma.deliveryRate.update({
      where: { id },
      data: {
        state: dto.state ? this.displayState(dto.state) : undefined,
        normalizedState: dto.state ? normalizedState : undefined,
        fee: dto.fee,
        isActive: dto.isActive,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.deliveryRate.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async findOne(id: string) {
    const rate = await this.prisma.deliveryRate.findUnique({ where: { id } });
    if (!rate) {
      throw new NotFoundException(
        `Delivery rate with ID "${id}" was not found`,
      );
    }
    return rate;
  }

  private displayState(state: string) {
    const trimmed = state.trim().toLocaleLowerCase('en-NG');
    return trimmed.replace(/\b\p{L}/gu, (letter) =>
      letter.toLocaleUpperCase('en-NG'),
    );
  }
}
