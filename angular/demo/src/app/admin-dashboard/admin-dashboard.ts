import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { AdminOrderStore } from '../admin-order-store';
import { I18nService } from '../i18n.service';
import { OrderStatus } from '../models';

const STATUS_ORDER: OrderStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];

/** AD-04: dashboard thống kê — đếm đơn theo trạng thái + top món được đặt nhiều nhất, hiển thị dạng biểu đồ cột. */
@Component({
  selector: 'admin-dashboard',
  imports: [MatCardModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css',
})
export class AdminDashboard {
  protected readonly store = inject(AdminOrderStore);
  protected readonly i18n = inject(I18nService);

  protected readonly statusOrder = STATUS_ORDER;

  /**
   * Cột dọc (theo trạng thái) "mọc" từ dưới lên, cột ngang (top món) "chạy" từ trái qua phải khi
   * dữ liệu vừa tải xong — dựng thẳng ở 100% ngay từ đầu thì CSS transition không có "điểm xuất
   * phát" để chạy (element đã có sẵn giá trị cuối cùng lúc paint đầu tiên). Phải render ở 0%
   * trước, rồi mới đổi sang giá trị thật 1 nhịp sau (double rAF để chắc chắn trình duyệt đã
   * paint xong khung 0% trước khi transition kích hoạt).
   */
  protected readonly animateCharts = signal(false);

  constructor() {
    this.store.loadStats();

    effect(() => {
      if (this.store.stats()) {
        this.animateCharts.set(false);
        requestAnimationFrame(() => requestAnimationFrame(() => this.animateCharts.set(true)));
      }
    });
  }

  protected statusLabel(status: OrderStatus): string {
    return this.i18n.t(`orders.status.${status}`);
  }

  protected statusCount(status: OrderStatus): number {
    return this.store.stats()?.byStatus[status] ?? 0;
  }

  /** Chiều cao cột % so với trạng thái có số lượng lớn nhất — tối thiểu 4% để cột rỗng vẫn thấy được viền. */
  protected readonly maxStatusCount = computed(() => {
    const stats = this.store.stats();
    if (!stats) return 1;
    return Math.max(1, ...STATUS_ORDER.map((status) => stats.byStatus[status]));
  });

  protected barHeightPercent(status: OrderStatus): number {
    if (!this.animateCharts()) {
      return 0;
    }
    const count = this.statusCount(status);
    return Math.max(4, (count / this.maxStatusCount()) * 100);
  }

  protected readonly maxRecipeOrders = computed(() => {
    const topRecipes = this.store.stats()?.topRecipes ?? [];
    return Math.max(1, ...topRecipes.map((r) => r.totalOrders));
  });

  protected recipeBarPercent(totalOrders: number): number {
    if (!this.animateCharts()) {
      return 0;
    }
    return Math.max(4, (totalOrders / this.maxRecipeOrders()) * 100);
  }
}
