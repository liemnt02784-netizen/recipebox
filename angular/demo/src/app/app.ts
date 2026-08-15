import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthStore } from './auth-store';
import { I18nService } from './i18n.service';
import { NotificationService } from './notification.service';

/**
 * Các trang không cần sidebar/topbar chung của app: trang auth (card 2 cột, nền riêng) và
 * help/privacy/terms — 3 trang này CHỈ được link tới từ footer của các trang auth (chưa đăng
 * nhập), nên không được phép hiện sidebar (sidebar giả định luôn có user đã đăng nhập).
 */
const AUTH_ROUTE_PREFIXES = ['/login', '/register', '/forgot-password', '/reset-password', '/help', '/privacy', '/terms'];

/** Từ mốc này trở lên, sidebar luôn hiện cố định (mode="side") — dưới mốc này là drawer trượt (mode="over"). */
const DESKTOP_BREAKPOINT_QUERY = '(min-width: 1024px)';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatIconModule, MatButtonModule, MatSidenavModule], // Nếu có dùng component con hoặc directive khác thì đưa vào đây
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('My Recipe Box');
  protected readonly authStore = inject(AuthStore);
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  /** Chỉ để kích hoạt kết nối SSE ngay khi app khởi động — xem notification.service.ts. */
  private readonly notificationService = inject(NotificationService);

  /**
   * initialValue lấy thẳng từ window.location thay vì router.url — router.url
   * mặc định là '/' cho tới khi navigation đầu tiên hoàn tất (bất đồng bộ),
   * còn location.pathname đã đúng ngay từ đầu vì trình duyệt đã điều hướng
   * xong trước khi Angular bootstrap. Thiếu bước này thì lúc F5 (hard reload)
   * header sẽ bị "chớp" hiện ra 1 nhịp trước khi ẩn lại.
   */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: window.location.pathname },
  );

  protected readonly isAuthRoute = computed(() =>
    AUTH_ROUTE_PREFIXES.some((prefix) => this.currentUrl().startsWith(prefix)),
  );

  /** Sidebar cố định (desktop) hay drawer trượt-đè (mobile/tablet hẹp) — theo dõi media query sống. */
  private readonly desktopQuery = window.matchMedia(DESKTOP_BREAKPOINT_QUERY);
  protected readonly isDesktop = signal(this.desktopQuery.matches);

  /**
   * 1 signal DUY NHẤT điều khiển đóng/mở sidebar ở CẢ 2 chế độ (trước đây desktop luôn ép mở
   * qua `isDesktop() || mobileOpen()`, khiến bấm ra ngoài không đóng được trên màn rộng — đây
   * chính là bug người dùng báo). Mặc định mở sẵn nếu khởi động ở desktop, đóng sẵn nếu mobile.
   */
  protected readonly sidenavOpen = signal(this.desktopQuery.matches);

  protected closeSidenavOnMobile(): void {
    if (!this.isDesktop()) {
      this.sidenavOpen.set(false);
    }
  }

  protected toggleSidenav(): void {
    this.sidenavOpen.set(!this.sidenavOpen());
  }

  /**
   * MatSidenav tự đóng khi bấm ra ngoài backdrop (mobile) hoặc nhấn Esc — (openedChange) là sự
   * kiện DUY NHẤT bắt được mọi cách đóng đó. Phải đồng bộ lại sidenavOpen theo, nếu không thì
   * lần render kế tiếp binding 1 chiều [opened] sẽ ép nó mở lại ngay lập tức.
   */
  protected onSidenavOpenedChange(opened: boolean): void {
    this.sidenavOpen.set(opened);
  }

  /**
   * Desktop (mode="side") không có backdrop nên MatSidenav không tự bắt được "bấm ra ngoài" —
   * phải tự lắng click trên vùng nội dung và đóng thủ công khi đang mở.
   */
  protected onContentAreaClick(): void {
    if (this.isDesktop() && this.sidenavOpen()) {
      this.sidenavOpen.set(false);
    }
  }

  private readonly shellEl = viewChild<ElementRef<HTMLElement>>('shell');

  /**
   * Fade nhẹ khi chuyển trang — thay vì "cắt" cứng ngay lập tức. .app-shell không bị Angular
   * tạo lại (chỉ nội dung router-outlet bên trong đổi), nên phải tự remove/re-add class để ép
   * trình duyệt chạy lại animation (nếu chỉ add class 1 lần thì lần chuyển trang thứ 2 trở đi
   * animation không lặp lại vì class đã tồn tại sẵn từ trước).
   */
  constructor() {
    this.desktopQuery.addEventListener('change', (event) => {
      this.isDesktop.set(event.matches);
      // Vượt qua ngưỡng desktop thì mở lại mặc định; co xuống mobile thì đóng lại mặc định —
      // giữ đúng hành vi mặc định cũ, chỉ khác là giờ user có thể tự đóng trên desktop được.
      this.sidenavOpen.set(event.matches);
    });

    effect(() => {
      this.currentUrl();
      this.closeSidenavOnMobile();
      const el = this.shellEl()?.nativeElement;
      if (!el) {
        return;
      }
      el.classList.remove('app-shell-fade');
      void el.offsetWidth;
      el.classList.add('app-shell-fade');
    });
  }

  /**
   * M3 top app bar: elevation chỉ xuất hiện khi nội dung phía dưới đã cuộn, không phải mặc định.
   * mat-sidenav-content tự cuộn nội bộ (không phải window) nên phải lắng (scroll) trên chính nó.
   */
  protected readonly scrolled = signal(false);

  protected onContentScroll(event: Event): void {
    this.scrolled.set((event.target as HTMLElement).scrollTop > 4);
  }

  protected logout(): void {
    this.authStore.logout();
    this.router.navigate(['/login']);
  }
}
