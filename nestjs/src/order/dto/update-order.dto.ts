import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

/** US-09: sửa đơn — chỉ cho phép đổi số khẩu phần, chỉ khi đơn còn ở trạng thái pending. */
export class UpdateOrderDto {
  @ApiProperty({ example: 3, minimum: 1 })
  @IsInt()
  @Min(1)
  portions!: number;
}
