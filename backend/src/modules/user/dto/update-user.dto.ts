import { IsEmail, IsOptional, IsString, IsUrl, Length } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  nickname?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  avatar?: string | null;
}
