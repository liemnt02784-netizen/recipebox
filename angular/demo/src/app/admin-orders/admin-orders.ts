import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { AdminOrderStore } from '../admin-order-store';
import { I18nService } from '../i18n.service';
import { CancelReasonDialog } from '../cancel-reason-dialog/cancel-reason-dialog';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { AdminOrderModel, OrderStatus } from '../models';

const STATUS_OPTIONS: OrderStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];

/** AD-01/AD-02/AD-03/FE-07: quản trị toàn bộ đơn đặt món trong hệ thống. */
@Component({
  selector: 'admin-orders',
  imports: [
    FormsModule, MatCardModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatMenuModule,
  ],
  templateUrl: './admin-orders.html',
  styleUrl: './admin-orders.css',
})
export class AdminOrders {
  protected readonly store = inject(AdminOrderStore);
  protected readonly i18n = inject(I18nService);
  private readonly dialog = inject(MatDialog);

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly searchTerm = signal('');
  protected readonly statusFilter = signal<OrderStatus | ''>('');

  private searchDebounceHandle: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.store.loadOrders();
  }

  protected statusLabel(status: OrderStatus): string {
    return this.i18n.t(`orders.status.${status}`);
  }

  protected canHide(order: AdminOrderModel): boolean {
    return order.status === 'completed' || order.status === 'cancelled';
  }

  protected confirmHideOrder(order: AdminOrderModel): void {
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

  /** FE-06.1: debounce — tránh gọi API mỗi phím gõ. */
  protected onSearchChange(value: string): void {
    this.searchTerm.set(value);
    if (this.searchDebounceHandle) {
      clearTimeout(this.searchDebounceHandle);
    }
    this.searchDebounceHandle = setTimeout(() => this.reload(), 350);
  }

  protected onStatusFilterChange(value: OrderStatus | ''): void {
    this.statusFilter.set(value);
    this.reload();
  }

  private reload(): void {
    this.store.loadOrders(this.statusFilter() || undefined, this.searchTerm());
  }

  protected setInProgress(order: AdminOrderModel): void {
    this.store.updateStatus(order.id, { status: 'in_progress' });
  }

  protected setCompleted(order: AdminOrderModel): void {
    this.store.updateStatus(order.id, { status: 'completed' });
  }

  /** AD-03: bắt buộc nhập lý do trước khi chuyển sang "Bị hủy". */
  protected setCancelled(order: AdminOrderModel): void {
    this.dialog
      .open(CancelReasonDialog, {
        width: '420px',
        maxWidth: '90vw',
        autoFocus: true,
        panelClass: 'confirm-dialog-panel',
      })
      .afterClosed()
      .subscribe((reason: string | undefined) => {
        if (reason?.trim()) {
          this.store.updateStatus(order.id, { status: 'cancelled', cancelReason: reason.trim() });
        }
      });
  }
}
