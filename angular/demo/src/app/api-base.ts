/**
 * Base URL của backend NestJS.
 *
 * - Khi deploy thật (frontend và backend ở 2 domain khác nhau, vd Vercel + Render): set
 *   `window.__API_BASE_URL__` trong index.html trỏ thẳng tới URL backend đã deploy.
 * - Khi chạy dev cục bộ (không set biến trên): tự suy ra từ hostname trình duyệt đang mở app
 *   (localhost, IP LAN...) — máy khác trong cùng mạng mở app qua IP LAN sẽ tự gọi đúng API về
 *   IP đó, không hardcode "localhost" (không thì bị lỗi "Failed to fetch").
 */
declare global {
  interface Window {
    __API_BASE_URL__?: string;
  }
}

export const API_BASE_URL = window.__API_BASE_URL__?.trim()
  ? window.__API_BASE_URL__.trim().replace(/\/$/, '')
  : `${location.protocol}//${location.hostname}:3000`;
