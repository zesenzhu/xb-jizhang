import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/authenticated-request';
import { AuthGuard } from '../auth/auth.guard';
import { ChangePasswordDto } from '../auth/dto/change-password.dto';
import { AuthService } from '../auth/auth.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserService } from './user.service';

@Controller('users')
@UseGuards(AuthGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return this.userService.getMe(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateUserDto) {
    return this.userService.updateMe(user.id, dto);
  }

  @Patch('me/password')
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto): Promise<null> {
    await this.authService.changePassword(user.id, dto);
    return null;
  }
}
