import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Đánh dấu 1 route/controller không cần JWT, dùng cho login/register. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
