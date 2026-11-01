import { Body, Controller, ForbiddenException, Get, Headers, Param, Post, Put } from '@nestjs/common';
import { RequestTypesService } from './request-types.service.js';
import type { RequestTypeInput } from './request-types.js';
import { findUser } from './users.js';

/** Thiết kế loại đơn. Chỉ người dùng có vai trò admin (header "x-user-id"). */
@Controller('api/request-types')
export class RequestTypesController {
  constructor(private readonly types: RequestTypesService) {}

  private admin(userId: string) {
    if (findUser(userId)?.role !== 'admin') throw new ForbiddenException('Only an administrator can design request types');
    return userId;
  }

  @Get()
  list(@Headers('x-user-id') user: string) {
    this.admin(user);
    return this.types.list();
  }

  @Get(':key')
  get(@Param('key') key: string, @Headers('x-user-id') user: string) {
    this.admin(user);
    return this.types.get(key);
  }

  @Post()
  create(@Body() body: RequestTypeInput, @Headers('x-user-id') user: string) {
    return this.types.create(body, this.admin(user));
  }

  @Put(':key')
  update(@Param('key') key: string, @Body() body: RequestTypeInput, @Headers('x-user-id') user: string) {
    return this.types.update(key, body, this.admin(user));
  }
}
