import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from './auth-store';

/** AD-09: khu vực quản trị phải tách bạch hoàn toàn — chặn cả user thường lẫn guest. */
export const adminGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (!authStore.isAuthenticated()) {
    return router.parseUrl('/login');
  }
  if (!authStore.isAdmin()) {
    return router.parseUrl('/recipes');
  }
  return true;
};
