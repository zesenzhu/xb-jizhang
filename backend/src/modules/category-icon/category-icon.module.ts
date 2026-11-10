import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ObjectStorageModule } from '../attachment/object-storage/object-storage.module';
import { CategoryIconCleanup } from './category-icon.cleanup';
import { CategoryIconController } from './category-icon.controller';
import { CategoryIconService } from './category-icon.service';

@Module({
  imports: [AuthModule, ObjectStorageModule],
  controllers: [CategoryIconController],
  providers: [CategoryIconService, CategoryIconCleanup],
  exports: [CategoryIconService],
})
export class CategoryIconModule {}
