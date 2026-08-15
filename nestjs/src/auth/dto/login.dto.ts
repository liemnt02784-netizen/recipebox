import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  /** BE: chấp nhận cả username lẫn email trong cùng 1 ô nhập — xem AuthService.login(). */
  @ApiProperty({ example: 'THANH LIEM hoặc user1@example.com' })
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
