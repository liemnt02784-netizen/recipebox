import { HttpErrorResponse } from '@angular/common/http';
import type { Locale } from './i18n.service';

/** Message kỹ thuật không nên hiện thẳng cho người dùng — rơi vào đây thì dùng fallback thay thế. */
const GENERIC_MESSAGES = new Set([
  'internal server error',
  'unauthorized',
  'forbidden',
  'not found',
  // JwtAuthGuard tự viết (BE-03) trả các message kỹ thuật này khi thiếu/hỏng token —
  // không phải lỗi do người dùng thao tác sai, nên không hiện thẳng ra UI.
  'no auth token',
  'chữ ký không hợp lệ',
  'token đã hết hạn',
  'token sai định dạng',
  'payload không hợp lệ',
]);

/**
 * `fallback` do nơi gọi truyền vào, luôn đã dịch đúng theo locale hiện tại (vd `i18n.t('orders.cancelError')`).
 *
 * `locale`: backend KHÔNG có i18n — mọi message nó trả về (kể cả message nghiệp vụ hợp lệ như
 * "Sai username hoặc password", "Username đã tồn tại"...) luôn là tiếng Việt cứng, không có bản
 * tiếng Anh. Vì vậy khi app đang ở locale 'en', không được hiện thẳng message backend ra (sẽ lộ
 * tiếng Việt dù UI đang tiếng Anh) — luôn dùng `fallback` (đã dịch đúng phía frontend) thay thế.
 * Chỉ khi đang ở 'vi' mới ưu tiên hiện message backend (thường chi tiết/hữu ích hơn fallback chung).
 *
 * status === 0 nghĩa là request chưa tới được server (mất mạng, sai domain/IP, CORS chặn, server
 * sập...) — response.error lúc này thường là message trình duyệt kiểu "Failed to fetch", không
 * phải message từ backend, nên luôn dùng fallback bất kể locale.
 */
export function extractErrorMessage(error: unknown, fallback: string, locale: Locale): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return fallback;
    }
    if (locale === 'vi' && typeof error.error?.message === 'string') {
      const message = error.error.message;
      if (!GENERIC_MESSAGES.has(message.trim().toLowerCase())) {
        return message;
      }
    }
  }
  return fallback;
}
