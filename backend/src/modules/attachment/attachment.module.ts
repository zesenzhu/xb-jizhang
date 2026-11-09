import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AttachmentCleanupService } from './attachment-cleanup.service';
import { AttachmentScheduler } from './attachment.scheduler';
import { AttachmentController } from './attachment.controller';
import { AttachmentService } from './attachment.service';
import { ObjectStorageModule } from './object-storage/object-storage.module';

@Module({
  imports: [AuthModule, ObjectStorageModule],
  controllers: [AttachmentController],
  providers: [AttachmentService, AttachmentCleanupService, AttachmentScheduler],
  exports: [AttachmentService],
})
export class AttachmentModule {}
