import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

@Module({
  imports: [AuthModule],
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
