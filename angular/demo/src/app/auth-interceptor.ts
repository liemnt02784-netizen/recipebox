import { inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { clearSession, getStoredRefreshToken, getStoredToken, storeSession } from './token-storage';
import { API_BASE_URL } from './api-base';
import { AuthResponse } from './models';
import { AuthStore } from './auth-store';

/**
 * Chia sẻ 1 lần gọi /auth/refresh cho mọi request 401 xảy ra cùng lúc (vd nhiều API gọi song song
 * khi access token vừa hết hạn) — nếu không dedupe, request thứ 2 sẽ dùng refresh token đã bị
 * request thứ 1 revoke (rotation ở BE-05), gây fail dây chuyền dù token đầu vẫn hợp lệ.
 */
let refreshInFlight$: Observable<AuthResponse> | null = null;

function refreshAccessToken(http: HttpClient, authStore: InstanceType<typeof AuthStore>): Observable<AuthResponse> {
  if (refreshInFlight$) {
    return refreshInFlight$;
  }
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    return throwError(() => new Error('Không có refresh token'));
  }
  refreshInFlight$ = http.post<AuthResponse>(`${API_BASE_URL}/auth/refresh`, { refreshToken }).pipe(
    tap((res) => {
      storeSession(res.accessToken, res.refreshToken, res.user);
      // Đồng bộ lại signal trong AuthStore — nếu không, state trong bộ nhớ vẫn giữ access token cũ
      // dù localStorage đã có token mới, gây lệch pha giữa 2 nguồn sự thật.
      authStore.syncSession(res.accessToken, res.user);
    }),
    shareReplay(1),
    finalize(() => {
      refreshInFlight$ = null;
    }),
  );
  return refreshInFlight$;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const http = inject(HttpClient);
  const authStore = inject(AuthStore);
  const token = getStoredToken();
  const authorizedReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authorizedReq).pipe(
    catchError((error: unknown) => {
      const isAuthEndpoint = req.url.includes('/auth/refresh') || req.url.includes('/auth/login');
      if (error instanceof HttpErrorResponse && error.status === 401 && !isAuthEndpoint) {
        // FE-03: access token hết hạn — thử làm mới bằng refresh token (BE-05) trước khi bắt đăng nhập lại.
        return refreshAccessToken(http, authStore).pipe(
          switchMap((res) => {
            const retriedReq = req.clone({ setHeaders: { Authorization: `Bearer ${res.accessToken}` } });
            return next(retriedReq);
          }),
          catchError(() => {
            // Refresh token cũng không dùng được nữa — phiên thật sự đã hết, redirect về login.
            clearSession();
            router.navigate(['/login']);
            return throwError(() => error);
          }),
        );
      }
      return throwError(() => error);
    }),
  );
};
