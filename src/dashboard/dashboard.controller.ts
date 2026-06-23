import { Controller, Get } from '@nestjs/common';
import { successResponse } from '../common/utils/api-response.util';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  async getOverview() {
    const overview = await this.dashboardService.getOverview();
    return successResponse(overview, 'Dashboard overview retrieved');
  }
}
