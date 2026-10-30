import { IsEmail, IsIn } from 'class-validator';

export class CreateInvitationDto {
  @IsEmail()
  targetEmail!: string;

  @IsIn(['EDITOR', 'VIEWER'])
  role!: 'EDITOR' | 'VIEWER';
}
