import { IsIn, IsInt, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { ATTACHMENT_ALLOWED_MIME_TYPES, type AttachmentMimeType } from '../attachment.constants';

export class CreateAttachmentUploadDto {
  @IsUUID()
  clientRequestId!: string;

  @IsString()
  @Length(1, 255)
  fileName!: string;

  @IsIn(ATTACHMENT_ALLOWED_MIME_TYPES)
  mimeType!: AttachmentMimeType;

  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  sizeBytes!: number;
}
