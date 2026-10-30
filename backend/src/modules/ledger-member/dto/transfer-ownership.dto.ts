import { IsUUID } from 'class-validator';

export class TransferOwnershipDto {
  @IsUUID()
  targetMemberId!: string;
}
