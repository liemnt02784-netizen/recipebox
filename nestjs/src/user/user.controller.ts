import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { Role } from './schemas/user.schema';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';

@ApiTags('user')
@ApiBearerAuth('access-token')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  /** Chỉ admin mới được xem toàn bộ danh sách user — dùng cho AD-05 (lọc role=admin) hoặc test 403. */
  @Roles('admin')
  @Get()
  findAll(@Query('role') role?: Role, @Query('search') search?: string) {
    return this.userService.findAll(role, search);
  }

  /** Chỉ xem được hồ sơ của chính mình, trừ khi là admin — tránh lộ thông tin user khác qua đoán ID (IDOR). */
  @Get(':id')
  findOne(@CurrentUser() currentUser: AuthenticatedUser, @Param('id', ParseObjectIdPipe) id: string) {
    this.assertSelfOrAdmin(currentUser, id);
    return this.userService.findOne(id);
  }

  /** US-12: chỉ sửa được hồ sơ của chính mình, trừ khi là admin. */
  @Patch(':id')
  update(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    this.assertSelfOrAdmin(currentUser, id);
    return this.userService.update(id, updateUserDto, currentUser.userId);
  }

  /** AD-06/AD-07: cấp hoặc thu hồi quyền admin. */
  @Roles('admin')
  @Patch(':id/role')
  updateRole(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.userService.updateRole(id, dto.role, currentUser.userId);
  }

  /** US-13: user tự xoá tài khoản của chính mình; admin xoá được bất kỳ ai. */
  @Delete(':id')
  remove(@CurrentUser() currentUser: AuthenticatedUser, @Param('id', ParseObjectIdPipe) id: string) {
    this.assertSelfOrAdmin(currentUser, id);
    return this.userService.remove(id);
  }

  private assertSelfOrAdmin(currentUser: AuthenticatedUser, targetId: string): void {
    if (currentUser.role !== 'admin' && currentUser.userId !== targetId) {
      throw new ForbiddenException('Bạn không có quyền truy cập tài nguyên này');
    }
  }
}
