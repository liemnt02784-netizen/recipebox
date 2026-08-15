import { Component, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { email, form, FormField, FormRoot, minLength, required, validate } from '@angular/forms/signals';
import { AuthStore } from '../auth-store';
import { I18nService } from '../i18n.service';
import { API_BASE_URL } from '../api-base';
import { extractErrorMessage } from '../http-error';
import { notifyError, notifySuccess } from '../notify';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { AuthUser, UpdateProfileRequest } from '../models';

interface AccountDetails {
  id: string;
  username: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  role: 'user' | 'admin';
  isEmailVerified?: boolean;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-account',
  imports: [RouterLink, FormField, FormRoot, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule],
  templateUrl: './account.html',
  styleUrl: './account.css',
})
export class Account {
  private readonly http = inject(HttpClient);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly i18n = inject(I18nService);

  protected readonly account = signal<AccountDetails | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly uploadError = signal<string | null>(null);
  protected readonly savingProfile = signal(false);
  protected readonly savingPassword = signal(false);
  protected readonly deleting = signal(false);
  protected readonly resendingVerification = signal(false);
  protected readonly showPassword = signal(false);

  /**
   * Google Account-style progressive disclosure: đổi mật khẩu và xoá tài khoản là các hành động
   * "nguy hiểm/ít dùng" — mặc định thu gọn, chỉ hiện form đầy đủ khi người dùng chủ động bấm mở,
   * thay vì luôn phơi hết mọi ô nhập trên màn hình chính.
   */
  protected readonly passwordSectionOpen = signal(false);
  protected readonly dangerZoneOpen = signal(false);

  protected togglePasswordVisibility(): void {
    this.showPassword.update((value) => !value);
  }

  protected togglePasswordSection(): void {
    const opening = !this.passwordSectionOpen();
    this.passwordSectionOpen.set(opening);
    if (!opening) {
      this.passwordModel.set({ currentPassword: '', password: '', confirmPassword: '' });
      this.showPassword.set(false);
    }
  }

  private readonly userId = this.authStore.user()?.id ?? '';

  protected readonly profileModel = signal({ name: '', email: '', avatarUrl: '' });
  protected readonly passwordModel = signal({ currentPassword: '', password: '', confirmPassword: '' });

  protected readonly avatarInitial = computed(() => (this.account()?.username ?? '?').charAt(0).toUpperCase());

  constructor() {
    if (!this.userId) {
      return;
    }
    this.http.get<AccountDetails>(`${API_BASE_URL}/user/${this.userId}`).subscribe({
      next: (account) => {
        this.account.set(account);
        this.profileModel.set({
          name: account.name ?? '',
          email: account.email,
          avatarUrl: account.avatarUrl ?? '',
        });
      },
      error: (error) => this.loadError.set(extractErrorMessage(error, this.i18n.t('account.loadError'), this.i18n.locale())),
    });
  }

  protected readonly profileForm = form(
    this.profileModel,
    (path) => {
      required(path.name, { message: () => this.i18n.t('account.err.nameRequired') });
      required(path.email, { message: () => this.i18n.t('account.err.emailRequired') });
      email(path.email, { message: () => this.i18n.t('account.err.emailInvalid') });
    },
    {
      submission: {
        action: async (field) => {
          const { name, email: newEmail, avatarUrl } = field().value();
          this.savingProfile.set(true);

          const payload: UpdateProfileRequest = { name, email: newEmail, avatarUrl };

          this.http.patch<AccountDetails>(`${API_BASE_URL}/user/${this.userId}`, payload).subscribe({
            next: (updated) => {
              this.savingProfile.set(false);
              this.account.set(updated);
              const currentUser = this.authStore.user();
              if (currentUser) {
                const syncedUser: AuthUser = { ...currentUser, username: updated.username, avatarUrl: updated.avatarUrl };
                this.authStore.syncSession(this.authStore.accessToken() ?? '', syncedUser);
              }
              notifySuccess(this.snackBar, this.i18n.t('account.saveSuccess'));
            },
            error: (error) => {
              this.savingProfile.set(false);
              notifyError(this.snackBar, extractErrorMessage(error, this.i18n.t('account.saveError'), this.i18n.locale()));
            },
          });
        },
      },
    },
  );

  protected readonly passwordForm = form(
    this.passwordModel,
    (path) => {
      required(path.currentPassword, { message: () => this.i18n.t('account.err.currentPasswordRequired') });
      required(path.password, { message: () => this.i18n.t('register.err.passwordRequired') });
      minLength(path.password, 6, { message: () => this.i18n.t('account.err.passwordMinLength') });
      required(path.confirmPassword, { message: () => this.i18n.t('register.err.confirmRequired') });
      validate(path.confirmPassword, (ctx) => {
        if (ctx.value() && ctx.value() !== ctx.valueOf(path.password)) {
          return { kind: 'passwordMismatch', message: this.i18n.t('account.err.confirmMismatch') };
        }
        return undefined;
      });
    },
    {
      submission: {
        action: async (field) => {
          const { currentPassword, password } = field().value();
          this.savingPassword.set(true);

          this.http.patch<AccountDetails>(`${API_BASE_URL}/user/${this.userId}`, { password, currentPassword }).subscribe({
            next: () => {
              this.savingPassword.set(false);
              this.passwordModel.set({ currentPassword: '', password: '', confirmPassword: '' });
              this.showPassword.set(false);
              this.passwordSectionOpen.set(false);
              notifySuccess(this.snackBar, this.i18n.t('account.passwordSaveSuccess'));
            },
            error: (error) => {
              this.savingPassword.set(false);
              notifyError(this.snackBar, extractErrorMessage(error, this.i18n.t('account.saveError'), this.i18n.locale()));
            },
          });
        },
      },
    },
  );

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.processFile(file);
    }
    input.value = '';
  }

  private processFile(file: File): void {
    this.uploadError.set(null);
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      this.uploadError.set(this.i18n.t('addRecipe.err.imageType'));
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      this.uploadError.set(this.i18n.t('addRecipe.err.imageSize'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.profileModel.update((m) => ({ ...m, avatarUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  }

  /** BE-04: gửi lại email xác thực — chỉ hiện khi tài khoản chưa xác thực. */
  protected resendVerification(): void {
    this.resendingVerification.set(true);
    this.http.post<{ message: string }>(`${API_BASE_URL}/auth/resend-verification`, {}).subscribe({
      next: () => {
        this.resendingVerification.set(false);
        notifySuccess(this.snackBar, this.i18n.t('account.verificationSent'));
      },
      error: (error) => {
        this.resendingVerification.set(false);
        notifyError(this.snackBar, extractErrorMessage(error, this.i18n.t('account.saveError'), this.i18n.locale()));
      },
    });
  }

  /** FE-13: xoá tài khoản là hành động không thể hoàn tác — bắt buộc xác nhận lại. */
  protected confirmDeleteAccount(): void {
    this.dialog
      .open(ConfirmDialog, {
        width: '400px',
        maxWidth: '90vw',
        autoFocus: false,
        panelClass: 'confirm-dialog-panel',
        data: {
          title: this.i18n.t('account.deleteDialogTitle'),
          message: this.i18n.t('account.deleteDialogMessage'),
          itemName: this.account()?.username,
          confirmLabel: this.i18n.t('account.deleteConfirm'),
          cancelLabel: this.i18n.t('common.cancel'),
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.deleteAccount();
        }
      });
  }

  private deleteAccount(): void {
    this.deleting.set(true);
    this.http.delete<void>(`${API_BASE_URL}/user/${this.userId}`).subscribe({
      next: () => {
        this.authStore.logout();
        this.router.navigate(['/login']);
      },
      error: (error) => {
        this.deleting.set(false);
        notifyError(this.snackBar, extractErrorMessage(error, this.i18n.t('account.deleteError'), this.i18n.locale()));
      },
    });
  }
}
