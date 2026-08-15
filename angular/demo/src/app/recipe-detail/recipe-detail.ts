import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RecipeStore } from '../recipe-store';
import { OrderStore } from '../order-store';
import { AuthStore } from '../auth-store';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { I18nService } from '../i18n.service';
import { flyToTarget } from '../fly-to-target';

@Component({
  selector: 'recipe-detail',
  imports: [RouterLink, MatIconModule, MatButtonModule, MatCardModule, MatListModule, MatProgressSpinnerModule],
  templateUrl: './recipe-detail.html',
  styleUrl: './recipe-detail.css'
})
export class RecipeDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(RecipeStore);
  private readonly orderStore = inject(OrderStore);
  protected readonly authStore = inject(AuthStore);
  protected readonly i18n = inject(I18nService);

  private readonly params = toSignal(this.route.paramMap);

  private readonly recipeId = computed(() => this.params()?.get('id') ?? '');

  protected readonly selectedRecipe = computed(() => {
    return this.store.getRecipeById(this.recipeId());
  });

  protected readonly soPhanAn = signal(1);
  protected readonly placingOrder = signal(false);

  protected readonly adjustedIngredients = computed(() => {
    const recipe = this.selectedRecipe();
    if (!recipe) {
      return [];
    }
    const soPhanAn = this.soPhanAn();
    return recipe.ingredients.map((ingredient) => ({
      ...ingredient,
      quantity: ingredient.quantity != null ? ingredient.quantity * soPhanAn : null,
    }));
  });

  protected tangSoPhanAn(): void {
    this.soPhanAn.update((soPhanAnHienTai) => soPhanAnHienTai + 1);
  }

  protected giamSoPhanAn(): void {
    if (this.soPhanAn() == 0) {
      return;
    }
    this.soPhanAn.update((soPhanAnHienTai) => soPhanAnHienTai - 1);
  }

  /**
   * US-07: đặt món với số khẩu phần đã chọn — AD-00 vô hiệu hoá với Admin.
   * `placingOrder` chặn double-submit khi user bấm liên tiếp trước khi API kịp trả lời (không có
   * guard này thì mỗi lần bấm thêm là 1 đơn mới bị tạo) + hiện spinner thay label trong lúc chờ.
   */
  protected datMon(event: MouseEvent): void {
    const recipe = this.selectedRecipe();
    if (!recipe || this.placingOrder()) {
      return;
    }
    flyToTarget(event.currentTarget as HTMLElement, '#fly-target-my-orders', 'shopping_cart', '#fly-target-menu-toggle');
    this.placingOrder.set(true);
    this.orderStore.createOrder(
      { recipeId: recipe.id, portions: this.soPhanAn() },
      // Đợi 1 nhịp trước khi chuyển trang — điều hướng ngay lập tức khiến trang đơn hàng
      // "đè" lên lúc snackbar báo thành công còn đang hiện, nhìn như vỡ giao diện.
      () => setTimeout(() => this.router.navigate(['/orders']), 700),
      () => this.placingOrder.set(false),
    );
  }
}
