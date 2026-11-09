import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AttachmentCleanupService } from './attachment-cleanup.service';

@Injectable()
export class AttachmentScheduler {
  constructor(private readonly cleanup: AttachmentCleanupService) {}

  @Interval(30_000)
  async tick(): Promise<void> {
    await this.cleanup.tick();
  }
}
