import { effect, inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthStore } from './auth-store';
import { OrderStore } from './order-store';
import { AdminOrderStore } from './admin-order-store';
import { API_BASE_URL } from './api-base';

interface OrderNotificationEvent {
  type: 'order_created' | 'order_status_changed';
  orderId: string;
  userId: string;
  recipeName: string;
  status: string;
  message: string;
}

/**
 * BE-18: lắng nghe thông báo realtime qua SSE khi đơn được tạo mới hoặc đổi trạng thái.
 * EventSource của trình duyệt không cho gắn header Authorization, nên phải gửi access
 * token qua query string — backend (NotificationsController) verify thủ công token này.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly authStore = inject(AuthStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly orderStore = inject(OrderStore);
  private readonly adminOrderStore = inject(AdminOrderStore);

  private eventSource: EventSource | null = null;
  private connectedToken: string | null = null;

  constructor() {
    effect(() => {
      const token = this.authStore.accessToken();
      if (token) {
        this.connect(token);
      } else {
        this.disconnect();
      }
    });
  }

  private connect(token: string): void {
    if (this.connectedToken === token) {
      return;
    }
    this.disconnect();
    this.connectedToken = token;

    const url = `${API_BASE_URL}/notifications/stream?token=${encodeURIComponent(token)}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = (messageEvent) => {
      const event = JSON.parse(messageEvent.data) as OrderNotificationEvent;
      this.snackBar.open(event.message, undefined, { duration: 4000 });
      // Đơn của mình có thể đã đổi — nạp lại cho khớp trạng thái mới nhất.
      this.orderStore.loadMyOrders();
      // GET /orders (danh sách toàn bộ) chỉ admin mới có quyền gọi — user thường gọi sẽ ăn 403.
      if (this.authStore.isAdmin()) {
        this.adminOrderStore.loadOrders();
      }
    };
    // EventSource tự động reconnect khi mất kết nối — không cần xử lý gì thêm ở onerror.
    this.eventSource.onerror = () => {};
  }

  private disconnect(): void {
    this.eventSource?.close();
    this.eventSource = null;
    this.connectedToken = null;
  }
}
