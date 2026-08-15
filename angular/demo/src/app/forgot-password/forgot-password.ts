import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { email, form, FormField, FormRoot, required } from '@angular/forms/signals';
import { AuthStore } from '../auth-store';
import { extractErrorMessage } from '../http-error';
import { I18nService } from '../i18n.service';
import { AuthFooter } from '../auth-footer/auth-footer';
import { syncAutofillValue } from '../autofill-sync';

@Component({
  selector: 'app-forgot-password',
  imports: [
    FormField, FormRoot, RouterLink, AuthFooter,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
  ],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css',
})
export class ForgotPassword {
  private readonly authStore = inject(AuthStore);
  protected readonly i18n = inject(I18nService);

  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly emailModel = signal({ email: '' });

  protected onAutofill(event: Event, field: 'email'): void {
    syncAutofillValue(event, this.emailModel, field);
  }

  protected readonly forgotForm = form(
    this.emailModel,
    (path) => {
      required(path.email, { message: () => this.i18n.t('forgot.err.emailRequired') });
      email(path.email, { message: () => this.i18n.t('forgot.err.emailInvalid') });
    },
    {
      submission: {
        action: async (field) => {
          this.errorMessage.set(null);
          this.successMessage.set(null);
          const { email: emailValue } = field().value();
          try {
            // Backend luôn trả message chung chung để tránh lộ email nào đã đăng ký
            // (không dùng res.message) — frontend tự hiện lời nhắc rõ ràng, thân thiện hơn.
            await firstValueFrom(this.authStore.forgotPassword({ email: emailValue }));
            this.successMessage.set(this.i18n.t('forgot.success'));
          } catch (error) {
            this.errorMessage.set(extractErrorMessage(error, this.i18n.t('forgot.error.default'), this.i18n.locale()));
          }
        },
      },
    },
  );
}
