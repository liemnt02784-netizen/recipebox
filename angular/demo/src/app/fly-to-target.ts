/**
 * Hiệu ứng "bay vào giỏ": clone 1 icon từ vị trí nút bấm, bay theo cung parabol tới icon đích
 * (vd: icon "Đơn của tôi" trên header) rồi biến mất — phản hồi tức thời, vui mắt cho hành động
 * đặt món, không phụ thuộc kết quả API (chạy ngay lúc bấm, tách biệt với snackbar báo kết quả).
 * Tôn trọng prefers-reduced-motion: bỏ qua animation, chỉ "bump" nhẹ icon đích.
 */
export function flyToTarget(sourceEl: HTMLElement, targetSelector: string, iconName: string, fallbackSelector?: string): void {
  let targetEl = document.querySelector<HTMLElement>(targetSelector);
  // Đích chính (icon "Đơn của tôi" trong sidebar) có thể đang nằm ngoài màn hình — sidebar dạng
  // drawer trên mobile đóng thì vẫn còn trong DOM (chỉ dịch translateX ra ngoài), không phải
  // display:none. Toạ độ âm/ngoài viewport thì bay tới đó sẽ trông như icon bay mất hút, nên
  // rơi về đích phụ (nút hamburger — luôn hiển thị) nếu có.
  if (targetEl) {
    const r = targetEl.getBoundingClientRect();
    const offscreen = r.right <= 0 || r.bottom <= 0 || r.left >= window.innerWidth || r.top >= window.innerHeight;
    if (offscreen && fallbackSelector) {
      targetEl = document.querySelector<HTMLElement>(fallbackSelector);
    }
  } else if (fallbackSelector) {
    targetEl = document.querySelector<HTMLElement>(fallbackSelector);
  }
  if (!targetEl) {
    return;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  targetEl.classList.add('fly-target-bump');
  setTimeout(() => targetEl.classList.remove('fly-target-bump'), 420);

  if (reduceMotion) {
    return;
  }

  const srcRect = sourceEl.getBoundingClientRect();
  const tgtRect = targetEl.getBoundingClientRect();

  const clone = document.createElement('span');
  clone.className = 'material-symbols-outlined fly-to-target-icon';
  clone.textContent = iconName;
  clone.style.left = `${srcRect.left + srcRect.width / 2 - 17}px`;
  clone.style.top = `${srcRect.top + srcRect.height / 2 - 17}px`;
  document.body.appendChild(clone);

  const dx = tgtRect.left + tgtRect.width / 2 - (srcRect.left + srcRect.width / 2);
  const dy = tgtRect.top + tgtRect.height / 2 - (srcRect.top + srcRect.height / 2);
  const lift = Math.min(130, Math.abs(dy) * 0.7 + 50);

  // Quỹ đạo cong nảy nhẹ nhiều đoạn (thay vì 1 đường vòng cung đơn giản): "bật" lên khỏi nút,
  // lên đỉnh cung, rơi xuống có 1 nhịp nảy nhỏ trước khi chạm đích — giống cảm giác vật rơi
  // thật thay vì trượt đều theo easing.
  const animation = clone.animate(
    [
      { transform: 'translate(0px, 0px) scale(0.5)', opacity: 0, offset: 0 },
      { transform: `translate(${dx * 0.12}px, ${dy * 0.12 - lift * 0.75}px) scale(1.35) rotate(-8deg)`, opacity: 1, offset: 0.16 },
      { transform: `translate(${dx * 0.42}px, ${dy * 0.42 - lift}px) scale(1.2) rotate(4deg)`, opacity: 1, offset: 0.4 },
      { transform: `translate(${dx * 0.7}px, ${dy * 0.7 - lift * 0.35}px) scale(1) rotate(-3deg)`, opacity: 1, offset: 0.64 },
      { transform: `translate(${dx * 0.86}px, ${dy * 0.86 - lift * 0.12}px) scale(0.7) rotate(0deg)`, opacity: 0.95, offset: 0.82 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.3)`, opacity: 0.1, offset: 1 },
    ],
    { duration: 750, easing: 'cubic-bezier(0.3, 0.1, 0.3, 1)' },
  );

  animation.onfinish = () => clone.remove();
}
