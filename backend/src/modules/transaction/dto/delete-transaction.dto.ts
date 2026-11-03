import { IsInt, Min } from 'class-validator';

export class DeleteTransactionDto {
  @IsInt()
  @Min(1)
  version!: number;
}
