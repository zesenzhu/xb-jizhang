import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/authenticated-request';
import { AuthGuard } from '../auth/auth.guard';
import { AttachmentService } from './attachment.service';
import { CreateAttachmentUploadDto } from './dto/create-attachment-upload.dto';
import type { CreateAttachmentUploadInput } from './attachment.types';

@Controller('ledgers/:ledgerId')
@UseGuards(AuthGuard)
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @Post('transactions/:transactionId/attachment-uploads')
  createUpload(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Param('transactionId') transactionId: string,
    @Body() dto: CreateAttachmentUploadDto,
  ) {
    const input: CreateAttachmentUploadInput = {
      clientRequestId: dto.clientRequestId,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
    };
    return this.attachmentService.createUploadSession(
      user.id,
      ledgerId,
      transactionId,
      input,
    );
  }

  @Post('attachments/:attachmentId/complete')
  complete(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.attachmentService.complete(user.id, ledgerId, attachmentId);
  }

  @Get('attachments/:attachmentId/access-url')
  accessUrl(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.attachmentService.getAccessUrl(user.id, ledgerId, attachmentId);
  }

  @Delete('transactions/:transactionId/attachments/:attachmentId')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('ledgerId') ledgerId: string,
    @Param('transactionId') transactionId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.attachmentService.remove(user.id, ledgerId, transactionId, attachmentId);
  }
}
