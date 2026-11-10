import {
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import {
  CATEGORY_ICON_ALLOWED_MIME_TYPES,
  DEFAULT_CATEGORY_ICON_MAX_BYTES,
} from '../category-icon.constants';

export class CreateCategoryIconUploadDto {
  @IsUUID()
  clientRequestId!: string;

  @IsString()
  @Length(1, 128)
  fileName!: string;

  @IsIn(CATEGORY_ICON_ALLOWED_MIME_TYPES)
  mimeType!: (typeof CATEGORY_ICON_ALLOWED_MIME_TYPES)[number];

  @IsInt()
  @Min(1)
  @Max(DEFAULT_CATEGORY_ICON_MAX_BYTES)
  sizeBytes!: number;
}
