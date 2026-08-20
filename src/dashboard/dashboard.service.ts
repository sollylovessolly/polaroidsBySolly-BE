import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ExpenseCategory,
  OrderStatus,
  PaymentStatus,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ResourcesService } from '../resources/resources.service';
import { DashboardPeriodDto } from './dto/dashboard-period.dto';

const overlappingExpenseCategories = [
  ExpenseCategory.MATERIAL_PURCHASE,
  ExpenseCategory.OUTSOURCING,
  ExpenseCategory.DELIVERY,
];

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resources: ResourcesService,
  ) {}

  async summary(filters: DashboardPeriodDto = {}) {
    const period = this.period(filters);
    const paidWhere = {
      paymentStatus: PaymentStatus.PAID,
      paidAt: { gte: period.from, lt: period.to },
    };
    const [orders, expenses, withdrawals, pendingOrders, lowStock] =
      await Promise.all([
        this.prisma.order.aggregate({
          where: paidWhere,
          _sum: { totalAmount: true, grossProfitSnapshot: true },
          _count: true,
        }),
        this.prisma.expense.aggregate({
          where: {
            expenseDate: { gte: period.from, lt: period.to },
            category: { notIn: overlappingExpenseCategories },
          },
          _sum: { amount: true },
        }),
        this.prisma.ownerWithdrawal.aggregate({
          where: { withdrawnAt: { gte: period.from, lt: period.to } },
          _sum: { amount: true },
        }),
        this.prisma.order.count({
          where: {
            status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
          },
        }),
        this.resources.lowStock(),
      ]);
    const revenue = orders._sum.totalAmount ?? new Prisma.Decimal(0);
    const orderGrossProfit =
      orders._sum.grossProfitSnapshot ?? new Prisma.Decimal(0);
    const operatingExpenses = expenses._sum.amount ?? new Prisma.Decimal(0);
    const businessProfit = orderGrossProfit.minus(operatingExpenses);
    const ownerWithdrawals = withdrawals._sum.amount ?? new Prisma.Decimal(0);
    return {
      period,
      revenue,
      orderGrossProfit,
      operatingExpenses,
      businessProfit,
      ownerWithdrawals,
      retainedAfterWithdrawals: businessProfit.minus(ownerWithdrawals),
      paidOrders: orders._count,
      pendingOrders,
      averageOrderValue:
        orders._count > 0
          ? revenue.dividedBy(orders._count)
          : new Prisma.Decimal(0),
      lowStockCount: lowStock.length,
      urgentLowStock: lowStock.slice(0, 5),
    };
  }

  async monthlyProfit(year: number) {
    const start = this.lagosMonthBoundary(year, 0);
    const end = this.lagosMonthBoundary(year + 1, 0);
    const [orders, expenses] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          paymentStatus: PaymentStatus.PAID,
          paidAt: { gte: start, lt: end },
        },
        select: { paidAt: true, totalAmount: true, grossProfitSnapshot: true },
      }),
      this.prisma.expense.findMany({
        where: {
          expenseDate: { gte: start, lt: end },
          category: { notIn: overlappingExpenseCategories },
        },
        select: { expenseDate: true, amount: true },
      }),
    ]);
    const labels = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return labels.map((label, index) => {
      const monthOrders = orders.filter(
        (order) => order.paidAt && this.lagosMonth(order.paidAt) === index,
      );
      const monthExpenses = expenses.filter(
        (expense) => this.lagosMonth(expense.expenseDate) === index,
      );
      const revenue = this.sum(monthOrders.map((order) => order.totalAmount));
      const grossProfit = this.sum(
        monthOrders.map((order) => order.grossProfitSnapshot),
      );
      const expenseTotal = this.sum(
        monthExpenses.map((expense) => expense.amount),
      );
      return {
        month: index + 1,
        label,
        revenue,
        grossProfit,
        expenses: expenseTotal,
        businessProfit: grossProfit.minus(expenseTotal),
      };
    });
  }

  async products(filters: DashboardPeriodDto = {}) {
    const period = this.period(filters);
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: {
          paymentStatus: PaymentStatus.PAID,
          paidAt: { gte: period.from, lt: period.to },
        },
      },
      include: { variant: { include: { product: true } } },
    });
    const groups = new Map<
      string,
      { product: string; quantitySold: number; revenue: Prisma.Decimal }
    >();
    for (const item of items) {
      const key = item.variant.product.id;
      const group = groups.get(key) ?? {
        product: item.variant.product.name,
        quantitySold: 0,
        revenue: new Prisma.Decimal(0),
      };
      group.quantitySold += item.quantity;
      group.revenue = group.revenue.plus(item.totalPriceSnapshot);
      groups.set(key, group);
    }
    return [...groups.values()];
  }

  async sources(filters: DashboardPeriodDto = {}) {
    const period = this.period(filters);
    const groups = await this.prisma.order.groupBy({
      by: ['source'],
      where: {
        paymentStatus: PaymentStatus.PAID,
        paidAt: { gte: period.from, lt: period.to },
      },
      _count: true,
      _sum: { totalAmount: true },
      orderBy: { source: 'asc' },
    });
    return groups.map((group) => ({
      source: group.source,
      orders: group._count,
      revenue: group._sum.totalAmount ?? new Prisma.Decimal(0),
    }));
  }

  private period(filters: DashboardPeriodDto) {
    if (filters.from && filters.to && filters.from >= filters.to) {
      throw new BadRequestException('from must be before to');
    }
    if (filters.from || filters.to) {
      return {
        from: filters.from ?? new Date(0),
        to: filters.to ?? new Date('9999-12-31T23:59:59.999Z'),
      };
    }
    const lagosNow = new Date(Date.now() + 60 * 60 * 1000);
    return {
      from: this.lagosMonthBoundary(
        lagosNow.getUTCFullYear(),
        lagosNow.getUTCMonth(),
      ),
      to: this.lagosMonthBoundary(
        lagosNow.getUTCFullYear(),
        lagosNow.getUTCMonth() + 1,
      ),
    };
  }

  private lagosMonthBoundary(year: number, month: number) {
    return new Date(Date.UTC(year, month, 1) - 60 * 60 * 1000);
  }
  private lagosMonth(date: Date) {
    return new Date(date.getTime() + 60 * 60 * 1000).getUTCMonth();
  }
  private sum(values: Prisma.Decimal[]) {
    return values.reduce(
      (sum, value) => sum.plus(value),
      new Prisma.Decimal(0),
    );
  }
}
