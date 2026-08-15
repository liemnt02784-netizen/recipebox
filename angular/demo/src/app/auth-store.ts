import { computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { patchState, signalStore, withComputed, withHooks, withMethods, withProps, withState } from '@ngrx/signals';
import { tap } from 'rxjs';
import {
  AuthResponse,
  AuthUser,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
} from './models';
import { clearSession, getStoredRefreshToken, getStoredToken, getStoredUser, storeSession } from './token-storage';
import { API_BASE_URL } from './api-base';

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
};

const AUTH_API_URL = `${API_BASE_URL}/auth`;

export const AuthStore = signalStore(
  { providedIn: 'root' },

  withState<AuthState>({
    user: null,
    accessToken: null,
  }),

  withProps(() => ({
    http: inject(HttpClient),
  })),

  withComputed((store) => ({
    isAuthenticated: computed(() => !!store.accessToken()),
    isAdmin: computed(() => store.user()?.role === 'admin'),
  })),

  withMethods((store) => ({
    /** Đăng nhập; nếu thành công thì lưu access + refresh token và user vào localStorage và state. */
    login(credentials: LoginRequest) {
      return store.http.post<AuthResponse>(`${AUTH_API_URL}/login`, credentials).pipe(
        tap((res) => {
          storeSession(res.accessToken, res.refreshToken, res.user);
          patchState(store, { user: res.user, accessToken: res.accessToken });
        }),
      );
    },

    /** Đăng ký tài khoản mới; backend tự đăng nhập luôn sau khi tạo. */
    register(payload: RegisterRequest) {
      return store.http.post<AuthResponse>(`${AUTH_API_URL}/register`, payload).pipe(
        tap((res) => {
          storeSession(res.accessToken, res.refreshToken, res.user);
          patchState(store, { user: res.user, accessToken: res.accessToken });
        }),
      );
    },

    /**
     * BE-06: báo backend thu hồi refresh token trước khi xoá session cục bộ — best-effort, vẫn
     * đăng xuất ở client dù request thất bại (mất mạng, refresh token đã hết hạn sẵn...).
     */
    /** Gọi từ authInterceptor sau khi silent-refresh thành công — đồng bộ lại signal in-memory với localStorage. */
    syncSession(accessToken: string, user: AuthUser): void {
      patchState(store, { accessToken, user });
    },

    logout(): void {
      const refreshToken = getStoredRefreshToken();
      clearSession();
      patchState(store, { user: null, accessToken: null });
      if (refreshToken) {
        store.http.post(`${AUTH_API_URL}/logout`, { refreshToken }).subscribe({ error: () => {} });
      }
    },

    /** Gửi yêu cầu quên mật khẩu; backend luôn trả message chung chung để tránh lộ email nào đã đăng ký. */
    forgotPassword(payload: ForgotPasswordRequest) {
      return store.http.post<{ message: string }>(`${AUTH_API_URL}/forgot-password`, payload);
    },

    /** Đặt lại mật khẩu bằng token nhận được trong email. */
    resetPassword(payload: ResetPasswordRequest) {
      return store.http.post<{ message: string }>(`${AUTH_API_URL}/reset-password`, payload);
    },
  })),

  withHooks({
    onInit(store) {
      const token = getStoredToken();
      const user = getStoredUser();
      if (token && user) {
        patchState(store, { user, accessToken: token });
      }
    },
  }),
);
