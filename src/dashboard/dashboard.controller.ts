import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import {
  DashboardPeriodDto,
  DashboardYearDto,
} from './dto/dashboard-period.dto';
@ApiTags('Dashboard — Admin')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}
  @Get('summary') summary(@Query() dto: DashboardPeriodDto) {
    return this.dashboard.summary(dto);
  }
  @Get('monthly-profit') monthly(@Query() dto: DashboardYearDto) {
    return this.dashboard.monthlyProfit(dto.year);
  }
  @Get('products') products(@Query() dto: DashboardPeriodDto) {
    return this.dashboard.products(dto);
  }
  @Get('sources') sources(@Query() dto: DashboardPeriodDto) {
    return this.dashboard.sources(dto);
  }
}
