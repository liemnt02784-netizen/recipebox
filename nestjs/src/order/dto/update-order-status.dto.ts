import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import type { OrderStatus } from '../schemas/order.schema';

/** AD-02/AD-03: admin đổi trạng thái đơn — bắt buộc lý do khi chọn "cancelled". */
export class UpdateOrderStatusDto {
  @ApiProperty({ enum: ['pending', 'in_progress', 'completed', 'cancelled'] })
  @IsIn(['pending', 'in_progress', 'completed', 'cancelled'])
  status!: OrderStatus;

  @ApiPropertyOptional({ example: 'Hết nguyên liệu' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  cancelReason?: string;
}
