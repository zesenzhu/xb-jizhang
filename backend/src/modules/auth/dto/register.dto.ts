import { IsEmail, IsOptional, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(3, 32)
  @Matches(/^[a-zA-Z0-9_]+$/)
  username!: string;

  @IsString()
  @Length(8, 72)
  password!: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  nickname?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
