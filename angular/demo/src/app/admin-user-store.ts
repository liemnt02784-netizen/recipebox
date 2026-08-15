import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { patchState, signalStore, withMethods, withProps, withState } from '@ngrx/signals';
import { AdminUserModel } from './models';
import { API_BASE_URL } from './api-base';
import { I18nService } from './i18n.service';
import { extractErrorMessage } from './http-error';
import { notifyError, notifySuccess } from './notify';

type AdminUserState = {
  users: AdminUserModel[];
  loading: boolean;
};

const USER_API_URL = `${API_BASE_URL}/user`;

/** AD-05/AD-06/AD-07: danh sách + cấp/thu hồi quyền admin. */
export const AdminUserStore = signalStore(
  { providedIn: 'root' },

  withState<AdminUserState>({
    users: [],
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
      /** search lọc theo username/email/name; role mặc định 'admin' cho trang AD-05, có thể bỏ để xem tất cả. */
      loadUsers(role?: 'user' | 'admin', search?: string): void {
        patchState(store, { loading: true });
        const params = new URLSearchParams();
        if (role) params.set('role', role);
        if (search?.trim()) params.set('search', search.trim());
        const query = params.toString();
        store.http.get<AdminUserModel[]>(`${USER_API_URL}${query ? '?' + query : ''}`).subscribe({
          next: (users) => patchState(store, { users, loading: false }),
          error: (error) => {
            patchState(store, { loading: false });
            fail(error, 'adminUsers.loadError');
          },
        });
      },

      grantAdmin(id: string): void {
        this.setRole(id, 'admin');
      },

      /** AD-06: tìm user thường theo username/email để cấp quyền — không đụng tới danh sách admin đang hiển thị. */
      searchGrantCandidates(search: string) {
        const params = new URLSearchParams({ role: 'user', search });
        return store.http.get<AdminUserModel[]>(`${USER_API_URL}?${params.toString()}`);
      },

      revokeAdmin(id: string): void {
        this.setRole(id, 'user');
      },

      /**
       * Đổi role rồi luôn nạp lại toàn bộ danh sách 'admin' thay vì chỉ patch từng phần tử —
       * vì grant thêm 1 user mới thành admin nghĩa là người đó chưa từng có mặt trong
       * state.users (danh sách đang lọc role=admin), map() theo id sẽ không thêm được họ vào.
       */
      setRole(id: string, role: 'user' | 'admin'): void {
        store.http.patch<AdminUserModel>(`${USER_API_URL}/${id}/role`, { role }).subscribe({
          next: () => {
            this.loadUsers('admin');
            notifySuccess(store.snackBar, store.i18n.t(role === 'admin' ? 'adminUsers.grantSuccess' : 'adminUsers.revokeSuccess'));
          },
          error: (error) => fail(error, 'adminUsers.roleError'),
        });
      },
    };
  }),
);
