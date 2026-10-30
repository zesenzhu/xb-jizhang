import { IsString, Length } from 'class-validator';

export class AdminLoginDto {
  @IsString()
  @Length(3, 64)
  username!: string;

  @IsString()
  @Length(8, 128)
  password!: string;
}
