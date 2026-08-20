import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ConsumptionRule } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateResourceRuleDto } from './dto/create-resource-rule.dto';
import { UpdateResourceRuleDto } from './dto/update-resource-rule.dto';

@Injectable()
export class ResourceRulesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateResourceRuleDto) {
    const [variant, resource] = await Promise.all([
      this.prisma.productVariant.findUnique({
        where: { id: dto.variantId },
      }),
      this.prisma.resource.findUnique({
        where: { id: dto.resourceId },
      }),
    ]);

    if (!variant || !variant.isActive) {
      throw new NotFoundException('Variant was not found');
    }

    if (!resource || !resource.isActive) {
      throw new NotFoundException('Resource was not found');
    }

    if (dto.rule === ConsumptionRule.CAPACITY && !dto.capacity) {
      throw new BadRequestException('Capacity is required for CAPACITY rules');
    }

    const existingRule = await this.prisma.productResourceRule.findFirst({
      where: {
        variantId: dto.variantId,
        resourceId: dto.resourceId,
      },
    });

    if (existingRule) {
      throw new ConflictException(
        'This variant already has a rule for this resource',
      );
    }

    return this.prisma.productResourceRule.create({
      data: {
        variantId: dto.variantId,
        resourceId: dto.resourceId,
        rule: dto.rule,
        quantity: dto.quantity,
        capacity: dto.capacity,
        usageGroup: dto.usageGroup,
      },
      include: {
        variant: {
          include: {
            product: true,
          },
        },
        resource: true,
      },
    });
  }

  async findAll(variantId?: string) {
    return this.prisma.productResourceRule.findMany({
      where: {
        ...(variantId ? { variantId } : {}),
      },
      include: {
        variant: {
          include: {
            product: true,
          },
        },
        resource: true,
      },
      orderBy: {
        id: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const rule = await this.prisma.productResourceRule.findUnique({
      where: { id },
      include: {
        variant: {
          include: {
            product: true,
          },
        },
        resource: true,
      },
    });

    if (!rule) {
      throw new NotFoundException(
        `Resource rule with ID "${id}" was not found`,
      );
    }

    return rule;
  }

  async update(id: string, dto: UpdateResourceRuleDto) {
    const currentRule = await this.findOne(id);

    const variantId = dto.variantId ?? currentRule.variantId;
    const resourceId = dto.resourceId ?? currentRule.resourceId;
    const ruleType = dto.rule ?? currentRule.rule;
    const capacity = dto.capacity ?? currentRule.capacity;

    const [variant, resource] = await Promise.all([
      this.prisma.productVariant.findUnique({
        where: { id: variantId },
      }),
      this.prisma.resource.findUnique({
        where: { id: resourceId },
      }),
    ]);

    if (!variant || !variant.isActive) {
      throw new NotFoundException('Variant was not found');
    }

    if (!resource || !resource.isActive) {
      throw new NotFoundException('Resource was not found');
    }

    if (ruleType === ConsumptionRule.CAPACITY && !capacity) {
      throw new BadRequestException('Capacity is required for CAPACITY rules');
    }

    const duplicate = await this.prisma.productResourceRule.findFirst({
      where: {
        variantId,
        resourceId,
        NOT: {
          id,
        },
      },
    });

    if (duplicate) {
      throw new ConflictException(
        'This variant already has a rule for this resource',
      );
    }

    return this.prisma.productResourceRule.update({
      where: { id },
      data: {
        variantId: dto.variantId,
        resourceId: dto.resourceId,
        rule: dto.rule,
        quantity: dto.quantity,
        capacity: dto.capacity,
        usageGroup: dto.usageGroup,
      },
      include: {
        variant: {
          include: {
            product: true,
          },
        },
        resource: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.productResourceRule.delete({
      where: { id },
    });
  }
}
