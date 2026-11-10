import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_CATEGORY_ICON_CLEANUP_INTERVAL_SECONDS } from './category-icon.constants';
import { CategoryIconService } from './category-icon.service';

@Injectable()
export class CategoryIconCleanup implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly categoryIconService: CategoryIconService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    if (this.configService.get<string>('CATEGORY_ICON_ENABLED') !== 'true')
      return;
    const intervalSeconds = readPositiveNumber(
      this.configService.get<string>('CATEGORY_ICON_CLEANUP_INTERVAL_SECONDS'),
      DEFAULT_CATEGORY_ICON_CLEANUP_INTERVAL_SECONDS,
    );
    this.timer = setInterval(() => {
      void this.categoryIconService
        .cleanupExpiredAndDeleted()
        .catch(() => undefined);
    }, intervalSeconds * 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}

function readPositiveNumber(
  value: string | undefined,
  fallback: number,
): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}
