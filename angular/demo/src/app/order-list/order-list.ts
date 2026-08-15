import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { OrderStore } from '../order-store';
import { I18nService } from '../i18n.service';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { OrderModel } from '../models';

@Component({
  selector: 'order-list',
  imports: [RouterLink, MatCardModule, MatIconModule, MatButtonModule, MatMenuModule],
  templateUrl: './order-list.html',
  styleUrl: './order-list.css',
})
export class OrderList {
  protected readonly store = inject(OrderStore);
  protected readonly i18n = inject(I18nService);
  private readonly dialog = inject(MatDialog);

  /** id đơn đang được chỉnh số khẩu phần — null nghĩa là không có đơn nào đang sửa. */
  protected readonly editingId = signal<string | null>(null);
  protected readonly editingPortions = signal(1);

  protected statusLabel(status: OrderModel['status']): string {
    return this.i18n.t(`orders.status.${status}`);
  }

  /** Chỉ đơn đã xong mới ẩn được — đơn đang chờ/đang làm phải huỷ trước (US-10). */
  protected canHide(order: OrderModel): boolean {
    return order.status === 'completed' || order.status === 'cancelled';
  }

  protected confirmHideOrder(order: OrderModel): void {
    this.dialog
      .open(ConfirmDialog, {
        width: '400px',
        maxWidth: '90vw',
        autoFocus: false,
        panelClass: 'confirm-dialog-panel',
        data: {
          title: this.i18n.t('orders.hideDialogTitle'),
          message: this.i18n.t('orders.hideDialogMessage'),
          itemName: order.recipe?.name,
          confirmLabel: this.i18n.t('orders.hideConfirm'),
          cancelLabel: this.i18n.t('common.cancel'),
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.store.hideOrder(order.id);
        }
      });
  }

  protected startEdit(order: OrderModel): void {
    this.editingId.set(order.id);
    this.editingPortions.set(order.portions);
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
  }

  protected incrementEditing(): void {
    this.editingPortions.update((n) => n + 1);
  }

  protected decrementEditing(): void {
    if (this.editingPortions() <= 1) {
      return;
    }
    this.editingPortions.update((n) => n - 1);
  }

  protected saveEdit(id: string): void {
    this.store.updatePortions(id, this.editingPortions());
    this.editingId.set(null);
  }

  protected confirmCancelOrder(order: OrderModel): void {
    this.dialog
      .open(ConfirmDialog, {
        width: '400px',
        maxWidth: '90vw',
        autoFocus: false,
        panelClass: 'confirm-dialog-panel',
        data: {
          title: this.i18n.t('orders.cancelDialogTitle'),
          message: this.i18n.t('orders.cancelDialogMessage'),
          itemName: order.recipe?.name,
          confirmLabel: this.i18n.t('orders.cancelConfirm'),
          cancelLabel: this.i18n.t('orders.cancelDismiss'),
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.store.cancelOrder(order.id);
        }
      });
  }
}
