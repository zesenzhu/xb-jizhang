import { Injectable } from '@nestjs/common';
import { PasswordService } from '../../auth/password.service';

/** 管理员密码保持与普通用户相同的单向哈希格式，但通过独立 Provider 维护身份域边界。 */
@Injectable()
export class AdminPasswordService extends PasswordService {}
