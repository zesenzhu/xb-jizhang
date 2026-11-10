import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CategoryIconModule } from '../category-icon/category-icon.module';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

@Module({
  imports: [AuthModule, CategoryIconModule],
  controllers: [StatisticsController],
  providers: [StatisticsService],
  exports: [StatisticsService],
})
export class StatisticsModule {}
