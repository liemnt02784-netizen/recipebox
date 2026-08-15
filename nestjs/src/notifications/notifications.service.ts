import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { OrderNotificationEvent } from './notification-event.interface';

/** BE-18: bus sự kiện dùng chung cho SSE — OrderService bắn sự kiện vào đây, controller stream ra client. */
@Injectable()
export class NotificationsService {
  private readonly events$ = new Subject<OrderNotificationEvent>();

  emit(event: OrderNotificationEvent): void {
    this.events$.next(event);
  }

  stream(): Observable<OrderNotificationEvent> {
    return this.events$.asObservable();
  }
}
