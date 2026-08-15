import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { Role } from '../schemas/user.schema';

/** AD-06/AD-07: cấp hoặc thu hồi quyền admin. */
export class UpdateRoleDto {
  @ApiProperty({ enum: ['user', 'admin'] })
  @IsIn(['user', 'admin'])
  role!: Role;
}
