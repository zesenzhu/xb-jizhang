import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/authenticated-request';
import { AuthGuard } from '../auth/auth.guard';
import { QueryStatisticsDto } from './dto/query-statistics.dto';
import { StatisticsService } from './statistics.service';
import type { StatisticsQuery } from './statistics.types';

@Controller('ledgers/:ledgerId/statistics')
@UseGuards(AuthGuard)
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('overview')
  overview(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Query() query: QueryStatisticsDto,
  ) {
    return this.statisticsService.overview(user.id, ledgerId, query as StatisticsQuery);
  }
}
