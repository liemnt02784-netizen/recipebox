import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  /** Bắt buộc khi tự đổi mật khẩu của chính mình — xem UserService.update(). */
  @ApiPropertyOptional({ example: '123456' })
  @IsOptional()
  @IsString()
  currentPassword?: string;
}
