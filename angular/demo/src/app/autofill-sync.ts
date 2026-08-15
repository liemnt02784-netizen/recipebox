import { WritableSignal } from '@angular/core';

/**
 * Đồng bộ lại giá trị thật vào signal model khi trình duyệt autofill — xem styles.css
 * (@keyframes onAutoFillStart) để hiểu cơ chế bắt sự kiện. Dùng ở mọi form trang auth
 * (login/register/forgot/reset), bind qua (animationstart) trên từng input.
 */
export function syncAutofillValue<T extends Record<string, unknown>>(
  event: Event,
  model: WritableSignal<T>,
  field: keyof T,
): void {
  if (!(event instanceof AnimationEvent) || event.animationName !== 'onAutoFillStart') {
    return;
  }
  const value = (event.target as HTMLInputElement).value;
  model.update((current) => ({ ...current, [field]: value }));
}
