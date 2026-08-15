import { effect, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { patchState, signalStore, withHooks, withMethods, withProps, withState } from '@ngrx/signals';
import { CreateOrderRequest, OrderModel } from './models';
import { API_BASE_URL } from './api-base';
import { I18nService } from './i18n.service';
import { extractErrorMessage } from './http-error';
import { notifyError, notifySuccess } from './notify';
import { AuthStore } from './auth-store';

type OrderState = {
  orders: OrderModel[];
  loading: boolean;
};

const ORDER_API_URL = `${API_BASE_URL}/orders`;

export const OrderStore = signalStore(
  { providedIn: 'root' },

  withState<OrderState>({
    orders: [],
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
      /** US-08: nạp danh sách đơn của chính user đang đăng nhập. */
      loadMyOrders(): void {
        patchState(store, { loading: true });
        store.http.get<OrderModel[]>(`${ORDER_API_URL}/me`).subscribe({
          next: (orders) => patchState(store, { orders, loading: false }),
          error: (error) => {
            patchState(store, { loading: false });
            fail(error, 'orders.loadError');
          },
        });
      },

      /**
       * US-07: đặt món với số khẩu phần đã chọn.
       * `onSettled` luôn chạy dù thành công hay lỗi — dùng để component tắt loading-state trên
       * nút "Đặt món" (Nhóm 1: mọi thao tác bất đồng bộ phải có phản hồi, kể cả khi request lỗi).
       */
      createOrder(payload: CreateOrderRequest, onSuccess?: () => void, onSettled?: () => void): void {
        store.http.post<OrderModel>(ORDER_API_URL, payload).subscribe({
          next: (created) => {
            patchState(store, (state) => ({ orders: [created, ...state.orders] }));
            notifySuccess(store.snackBar, store.i18n.t('orders.placedToast'));
            onSuccess?.();
            onSettled?.();
          },
          error: (error) => {
            fail(error, 'orders.placeError');
            onSettled?.();
          },
        });
      },

      /** US-09: sửa số khẩu phần — chỉ hợp lệ khi đơn còn "pending". */
      updatePortions(id: string, portions: number): void {
        store.http.patch<OrderModel>(`${ORDER_API_URL}/${id}`, { portions }).subscribe({
          next: (updated) =>
            patchState(store, (state) => ({
              orders: state.orders.map((order) => (order.id === id ? updated : order)),
            })),
          error: (error) => fail(error, 'orders.updateError'),
        });
      },

      /**
       * US-10: user tự huỷ đơn — optimistic update: đổi trạng thái ngay trên UI trước khi
       * server trả lời, rollback về bản ghi cũ nếu request thất bại. Huỷ đơn không thể "undo"
       * bằng 1 API khác (không giống thêm/xoá item khỏi mảng) nên rollback = ghi đè lại y
       * nguyên bản ghi cũ đã lưu trước khi optimistic-update, không phải gọi API nghịch đảo.
       */
      cancelOrder(id: string): void {
        const previous = store.orders().find((order) => order.id === id);
        if (!previous) return;

        patchState(store, (state) => ({
          orders: state.orders.map((order) =>
            order.id === id
              ? { ...order, status: 'cancelled' as const, cancelReason: store.i18n.t('orders.cancelledByUser') }
              : order,
          ),
        }));

        store.http.delete<OrderModel>(`${ORDER_API_URL}/${id}`).subscribe({
          next: (cancelled) =>
            patchState(store, (state) => ({
              orders: state.orders.map((order) => (order.id === id ? cancelled : order)),
            })),
          error: (error) => {
            patchState(store, (state) => ({
              orders: state.orders.map((order) => (order.id === id ? previous : order)),
            }));
            fail(error, 'orders.cancelError');
          },
        });
      },

      /**
       * Ẩn đơn (đã hoàn thành/đã huỷ) khỏi danh sách — xoá mềm, không xoá dữ liệu.
       * Optimistic: biến mất khỏi danh sách ngay lập tức, chèn lại đúng vị trí cũ nếu API lỗi.
       */
      hideOrder(id: string): void {
        const previousOrders = store.orders();
        const index = previousOrders.findIndex((order) => order.id === id);
        if (index === -1) return;

        patchState(store, { orders: previousOrders.filter((order) => order.id !== id) });

        store.http.patch<{ message: string }>(`${ORDER_API_URL}/${id}/hide`, {}).subscribe({
          error: (error) => {
            patchState(store, { orders: previousOrders });
            fail(error, 'orders.hideError');
          },
        });
      },
    };
  }),

  withHooks({
    /**
     * NotificationService inject OrderStore ngay ở app root (mọi trang, kể cả /login) để có sẵn
     * cho luồng SSE — nếu load ngay lúc khởi tạo thì trang login cũng bắn 1 request /orders/me
     * chưa có token, ăn lỗi 401 vô nghĩa. Dùng effect() theo dõi trạng thái đăng nhập: chỉ load
     * khi đã login, và load lại mỗi lần chuyển từ chưa đăng nhập → đã đăng nhập.
     */
    onInit(store) {
      const authStore = inject(AuthStore);
      effect(() => {
        if (authStore.isAuthenticated()) {
          store.loadMyOrders();
        } else {
          patchState(store, { orders: [] });
        }
      });
    },
  }),
);
