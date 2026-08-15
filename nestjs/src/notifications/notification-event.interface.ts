import type { OrderStatus } from '../order/schemas/order.schema';

/** BE-18: sự kiện realtime khi (a) đơn đổi status, (b) đơn được tạo mới từ user. */
export interface OrderNotificationEvent {
  type: 'order_created' | 'order_status_changed';
  orderId: string;
  /** userId của chủ đơn — dùng để lọc: user chỉ nhận sự kiện của chính mình, admin nhận tất cả. */
  userId: string;
  recipeName: string;
  status: OrderStatus;
  message: string;
}
