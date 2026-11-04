import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
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

  @Get('categories')
  async categories(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Query() query: Record<string, unknown>,
  ) {
    // Validate here so this endpoint can map DTO failures to its domain codes.
    // The other statistics endpoints retain their existing validation contract.
    const pipe = new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          code: errors.some(
            (error) => error.constraints?.categoryFilterExclusive !== undefined,
          )
            ? 40023
            : 40021,
          message: '统计参数不合法',
          data: null,
        }),
    });
    const validated = (await pipe.transform(
      {
        ...query,
        ...(typeof query.keyword === 'string'
          ? { keyword: query.keyword.trim() || undefined }
          : {}),
      },
      { type: 'query', metatype: QueryStatisticsDto },
    )) as QueryStatisticsDto;
    return this.statisticsService.categories(user.id, ledgerId, validated);
  }

  @Get('overview')
  overview(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Query() query: QueryStatisticsDto,
  ) {
    return this.statisticsService.overview(
      user.id,
      ledgerId,
      query as StatisticsQuery,
    );
  }

  @Get('trend')
  trend(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Query() query: QueryStatisticsDto,
  ) {
    return this.statisticsService.trend(
      user.id,
      ledgerId,
      query as StatisticsQuery,
    );
  }

  @Get('periods')
  periods(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Query() query: QueryStatisticsDto,
  ) {
    return this.statisticsService.periods(
      user.id,
      ledgerId,
      query as StatisticsQuery,
    );
  }
}
