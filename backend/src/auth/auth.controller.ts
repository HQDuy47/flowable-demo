import { Body, Controller, Get, Post, UnauthorizedException } from '@nestjs/common';
import { DEMO_PASSWORD, findUser, USERS } from '../common/users.js';

/** Đăng nhập demo qua POST /api/login; sau đó người dùng hiện tại lấy từ header "x-user-id" do frontend gửi. */
@Controller('api')
export class AuthController {
  @Get('users')
  listUsers() { return USERS; }

  /** Đúng id + mật khẩu demo thì trả về người dùng (kèm role để frontend lọc menu). */
  @Post('login')
  login(@Body() body: { username?: string; password?: string }) {
    const user = findUser(body?.username?.trim().toLowerCase());
    if (!user || body.password !== DEMO_PASSWORD) throw new UnauthorizedException('Incorrect username or password');
    return user;
  }
}
