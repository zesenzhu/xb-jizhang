import { IsString, Length } from 'class-validator';

export class InvitationTokenDto {
  @IsString()
  @Length(20, 200)
  token!: string;
}
