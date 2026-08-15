import { Injectable } from '@nestjs/common';
import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler';

/** Đổi message mặc định "ThrottlerException: Too Many Requests" sang câu dễ hiểu hơn cho người dùng cuối. */
@Injectable()
export class FriendlyThrottlerGuard extends ThrottlerGuard {
  protected override async throwThrottlingException(): Promise<void> {
    throw new ThrottlerException('Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.');
  }
}
