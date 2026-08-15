import { SetMetadata } from '@nestjs/common';
import { Role } from '../../user/schemas/user.schema';

export const ROLES_KEY = 'roles';

/** Đánh dấu route chỉ cho phép các role được liệt kê, cần đứng sau JwtAuthGuard. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
