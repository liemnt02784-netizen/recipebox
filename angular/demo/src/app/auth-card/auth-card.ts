import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { email, form, FormField, FormRoot, minLength, required, validate } from '@angular/forms/signals';
import { AuthStore } from '../auth-store';
import { extractErrorMessage } from '../http-error';
import { notifySuccess } from '../notify';
import { I18nService } from '../i18n.service';
import { AuthFooter } from '../auth-footer/auth-footer';
import { syncAutofillValue } from '../autofill-sync';

type AuthMode = 'login' | 'register';

/**
 * Đăng nhập + Đăng ký gộp chung 1 component (thay vì 2 route/component tách biệt trước đây) —
 * bắt buộc phải gộp để hiệu ứng "thẻ lật" (overlay trượt + nghiêng 3D nhẹ giữa 2 form) chạy mượt:
 * nếu còn là 2 route riêng, chuyển route sẽ phá huỷ/tạo lại component, animation không thể liền mạch.
 * Vẫn giữ 2 URL /login và /register hoạt động bình thường (đọc route.data để biết mở form nào),
 * và khi người dùng bấm chuyển form ngay trong thẻ thì chỉ đổi URL bằng Location.go() (không qua
 * Router) để không kích hoạt điều hướng thật — animation không bị ngắt giữa chừng.
 */
@Component({
  selector: 'app-auth-card',
  imports: [
    FormField, FormRoot, RouterLink, AuthFooter,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
  ],
  templateUrl: './auth-card.html',
  styleUrl: './auth-card.css',
})
export class AuthCard {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly i18n = inject(I18nService);

  protected readonly mode = signal<AuthMode>((this.route.snapshot.data['mode'] as AuthMode) ?? 'login');
  /** Hướng đang chạy animation lật — null nghĩa là không lật (đứng yên ở vị trí hiện tại). */
  protected readonly turning = signal<'left' | 'right' | null>(null);

  protected switchMode(target: AuthMode): void {
    if (this.mode() === target) {
      return;
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.mode.set(target);
    this.location.go(target === 'register' ? '/register' : '/login');
    if (!reduceMotion) {
      this.turning.set(target === 'register' ? 'left' : 'right');
    }
  }

  protected onOverlayAnimationEnd(): void {
    this.turning.set(null);
  }

  // ============================================================
  // ĐĂNG NHẬP
  // ============================================================
  protected readonly loginErrorMessage = signal<string | null>(null);
  protected readonly credentialsModel = signal({ identifier: '', password: '' });

  protected onLoginAutofill(event: Event, field: 'identifier' | 'password'): void {
    syncAutofillValue(event, this.credentialsModel, field);
  }

  protected readonly loginForm = form(
    this.credentialsModel,
    (path) => {
      required(path.identifier, { message: () => this.i18n.t('login.err.usernameRequired') });
      required(path.password, { message: () => this.i18n.t('login.err.passwordRequired') });
    },
    {
      submission: {
        action: async (field) => {
          this.loginErrorMessage.set(null);
          const { identifier, password } = field().value();
          try {
            await firstValueFrom(this.authStore.login({ identifier, password }));
            this.router.navigate(['/recipes']);
          } catch (error) {
            this.loginErrorMessage.set(extractErrorMessage(error, this.i18n.t('login.error.default'), this.i18n.locale()));
          }
        },
      },
    },
  );

  // ============================================================
  // ĐĂNG KÝ
  // ============================================================
  protected readonly registerErrorMessage = signal<string | null>(null);
  protected readonly registerModel = signal({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
  });

  protected onRegisterAutofill(event: Event, field: 'username' | 'email' | 'password' | 'confirmPassword' | 'name'): void {
    syncAutofillValue(event, this.registerModel, field);
  }

  protected readonly registerForm = form(
    this.registerModel,
    (path) => {
      required(path.username, { message: () => this.i18n.t('register.err.usernameRequired') });
      minLength(path.username, 3, { message: () => this.i18n.t('register.err.usernameMinLength') });
      required(path.email, { message: () => this.i18n.t('register.err.emailRequired') });
      email(path.email, { message: () => this.i18n.t('register.err.emailInvalid') });
      required(path.password, { message: () => this.i18n.t('register.err.passwordRequired') });
      minLength(path.password, 6, { message: () => this.i18n.t('register.err.passwordMinLength') });

      required(path.confirmPassword, { message: () => this.i18n.t('register.err.confirmRequired') });
      validate(path.confirmPassword, (ctx) => {
        if (ctx.value() && ctx.value() !== ctx.valueOf(path.password)) {
          return { kind: 'passwordMismatch', message: this.i18n.t('register.err.confirmMismatch') };
        }
        return undefined;
      });
    },
    {
      submission: {
        action: async (field) => {
          this.registerErrorMessage.set(null);
          const { username, email: emailValue, password, name } = field().value();
          try {
            await firstValueFrom(
              this.authStore.register({
                username,
                email: emailValue,
                password,
                name: name || undefined,
              }),
            );
            notifySuccess(this.snackBar, this.i18n.t('register.success'));
            this.router.navigate(['/recipes']);
          } catch (error) {
            this.registerErrorMessage.set(extractErrorMessage(error, this.i18n.t('register.error.default'), this.i18n.locale()));
          }
        },
      },
    },
  );
}
