import { ConfigService } from '@nestjs/config';

export function getPositiveSeconds(
  configService: ConfigService,
  key: string,
  fallback: number,
): number {
  const configuredValue = configService.get<unknown>(key);
  const seconds =
    typeof configuredValue === 'number' ? configuredValue : Number(configuredValue);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : fallback;
}
