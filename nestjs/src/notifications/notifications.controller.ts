import { Controller, MessageEvent, Query, Sse, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { map, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { NotificationsService } from './notifications.service';
import { Public } from '../auth/decorators/public.decorator';
import { CustomJwtService } from '../auth/custom-jwt.service';
import type { JwtPayload } from '../auth/auth.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly jwtService: CustomJwtService,
  ) {}

  /**
   * BE-18 (SSE). EventSource của trình duyệt không cho gắn header Authorization,
   * nên nhận token qua query string thay vì Bearer header — vì vậy route này phải
   * @Public() (bỏ qua JwtAuthGuard toàn cục) và tự verify token thủ công ở đây.
   */
  @Public()
  @Sse('stream')
  stream(@Query('token') token: string): Observable<MessageEvent> {
    const payload = this.verifyToken(token);

    return this.notificationsService.stream().pipe(
      filter((event) => payload.role === 'admin' || event.userId === payload.sub),
      map((event) => ({ data: event }) as MessageEvent),
    );
  }

  private verifyToken(token: string): JwtPayload {
    if (!token) {
      throw new UnauthorizedException('Thiếu token');
    }
    try {
      return this.jwtService.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }
  }
}
