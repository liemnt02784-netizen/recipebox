import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token nhận được trong email (phần query ?token=...)' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: 'matKhauMoi123', minLength: 6 })
  @IsString()
  @MinLength(6)
  newPassword!: string;
}
