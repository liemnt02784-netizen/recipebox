import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { patchState, signalStore, withMethods, withProps, withState } from '@ngrx/signals';
import { AdminOrderModel, OrderStats, OrderStatus, UpdateOrderStatusRequest } from './models';
import { API_BASE_URL } from './api-base';
import { I18nService } from './i18n.service';
import { extractErrorMessage } from './http-error';
import { notifyError } from './notify';

type AdminOrderState = {
  orders: AdminOrderModel[];
  stats: OrderStats | null;
  loading: boolean;
};

const ORDER_API_URL = `${API_BASE_URL}/orders`;

/** AD-01/AD-02/AD-03/AD-04: quản trị đơn đặt món — tách store riêng, không dùng chung OrderStore của user. */
export const AdminOrderStore = signalStore(
  { providedIn: 'root' },

  withState<AdminOrderState>({
    orders: [],
    stats: null,
    loading: false,
  }),

  withProps(() => ({
    http: inject(HttpClient),
    i18n: inject(I18nService),
    snackBar: inject(MatSnackBar),
  })),

  withMethods((store) => {
    function fail(error: unknown, fallbackKey: string): void {
      notifyError(store.snackBar, extractErrorMessage(error, store.i18n.t(fallbackKey), store.i18n.locale()));
    }

    return {
      loadOrders(status?: OrderStatus, search?: string): void {
        patchState(store, { loading: true });
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        if (search?.trim()) params.set('search', search.trim());
        const query = params.toString();
        store.http.get<AdminOrderModel[]>(`${ORDER_API_URL}${query ? '?' + query : ''}`).subscribe({
          next: (orders) => patchState(store, { orders, loading: false }),
          error: (error) => {
            patchState(store, { loading: false });
            fail(error, 'adminOrders.loadError');
          },
        });
      },

      loadStats(): void {
        store.http.get<OrderStats>(`${ORDER_API_URL}/stats`).subscribe({
          next: (stats) => patchState(store, { stats }),
          error: (error) => fail(error, 'adminOrders.statsError'),
        });
      },

      updateStatus(id: string, payload: UpdateOrderStatusRequest): void {
        store.http.patch<AdminOrderModel>(`${ORDER_API_URL}/${id}/status`, payload).subscribe({
          next: (updated) =>
            patchState(store, (state) => ({
              orders: state.orders.map((order) => (order.id === id ? updated : order)),
            })),
          error: (error) => fail(error, 'adminOrders.updateError'),
        });
      },

      /**
       * Ẩn đơn (đã hoàn thành/đã huỷ) khỏi trang quản trị — xoá mềm, không xoá dữ liệu/thống kê.
       * Optimistic: biến mất ngay khỏi danh sách, chèn lại đúng vị trí cũ nếu API lỗi.
       */
      hideOrder(id: string): void {
        const previousOrders = store.orders();
        const index = previousOrders.findIndex((order) => order.id === id);
        if (index === -1) return;

        patchState(store, { orders: previousOrders.filter((order) => order.id !== id) });

        store.http.patch<{ message: string }>(`${ORDER_API_URL}/${id}/hide-admin`, {}).subscribe({
          error: (error) => {
            patchState(store, { orders: previousOrders });
            fail(error, 'adminOrders.hideError');
          },
        });
      },
    };
  }),
);
