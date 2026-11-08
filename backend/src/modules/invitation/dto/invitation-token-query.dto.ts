import { IsString, Length } from 'class-validator';

/** 邀请链接 Token 只从查询串读取，不接受调用方传入用户或邮箱作为身份。 */
export class InvitationTokenQueryDto {
  @IsString()
  @Length(20, 200)
  token!: string;
}
