import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { OrderStatus } from './schemas/order.schema';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';

@ApiTags('orders')
@ApiBearerAuth('access-token')
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /** AD-00: Admin kế thừa mọi quyền của User trừ tự đặt món — nên chỉ 'user' được tạo đơn. */
  @Roles('user')
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrderDto) {
    return this.orderService.create(user.userId, dto);
  }

  /** AD-01/FE-07: admin xem toàn bộ đơn, lọc theo trạng thái, tìm theo tên món/người đặt. */
  @Roles('admin')
  @Get()
  findAllAdmin(@Query('status') status?: OrderStatus, @Query('search') search?: string) {
    return this.orderService.findAllAdmin(status, search);
  }

  /** AD-04: số liệu thống kê cho dashboard — phải khai báo trước ':id' để không bị nuốt route. */
  @Roles('admin')
  @Get('stats')
  stats() {
    return this.orderService.getStats();
  }

  @Get('me')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.orderService.findAllForUser(user.userId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.orderService.findOne(user.userId, id);
  }

  /** AD-02/AD-03: admin đổi trạng thái đơn, bắt buộc lý do khi huỷ. */
  @Roles('admin')
  @Patch(':id/status')
  updateStatus(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.orderService.updateStatus(id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateOrderDto) {
    return this.orderService.update(user.userId, id, dto);
  }

  @Delete(':id')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.orderService.cancel(user.userId, id);
  }

  /** Ẩn đơn khỏi "Đơn của tôi" — chỉ đơn đã hoàn thành/đã huỷ. */
  @Patch(':id/hide')
  hideMine(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.orderService.hideForUser(user.userId, id);
  }

  /** Ẩn đơn khỏi trang quản trị đơn — chỉ đơn đã hoàn thành/đã huỷ. */
  @Roles('admin')
  @Patch(':id/hide-admin')
  hideAdmin(@Param('id', ParseObjectIdPipe) id: string) {
    return this.orderService.hideForAdmin(id);
  }
}
