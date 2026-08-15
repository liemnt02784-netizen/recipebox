import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { form, FormField, FormRoot, minLength, required, validate } from '@angular/forms/signals';
import { AuthStore } from '../auth-store';
import { extractErrorMessage } from '../http-error';
import { I18nService } from '../i18n.service';
import { AuthFooter } from '../auth-footer/auth-footer';
import { syncAutofillValue } from '../autofill-sync';

@Component({
  selector: 'app-reset-password',
  imports: [
    FormField, FormRoot, RouterLink, AuthFooter,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
  ],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css',
})
export class ResetPassword {
  private readonly authStore = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  private readonly queryParams = toSignal(this.route.queryParamMap);
  protected readonly token = () => this.queryParams()?.get('token') ?? '';

  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly passwordModel = signal({ newPassword: '', confirmPassword: '' });

  protected onAutofill(event: Event, field: 'newPassword' | 'confirmPassword'): void {
    syncAutofillValue(event, this.passwordModel, field);
  }

  protected readonly resetForm = form(
    this.passwordModel,
    (path) => {
      required(path.newPassword, { message: () => this.i18n.t('reset.err.passwordRequired') });
      minLength(path.newPassword, 6, { message: () => this.i18n.t('reset.err.passwordMinLength') });

      required(path.confirmPassword, { message: () => this.i18n.t('reset.err.confirmRequired') });
      validate(path.confirmPassword, (ctx) => {
        if (ctx.value() && ctx.value() !== ctx.valueOf(path.newPassword)) {
          return { kind: 'passwordMismatch', message: this.i18n.t('reset.err.confirmMismatch') };
        }
        return undefined;
      });
    },
    {
      submission: {
        action: async (field) => {
          this.errorMessage.set(null);
          this.successMessage.set(null);

          if (!this.token()) {
            this.errorMessage.set(this.i18n.t('reset.invalidToken'));
            return;
          }

          const { newPassword } = field().value(); // confirmPassword chỉ dùng để validate client-side, không gửi lên backend
          try {
            const res = await firstValueFrom(
              this.authStore.resetPassword({ token: this.token(), newPassword }),
            );
            this.successMessage.set(res.message);
            setTimeout(() => this.router.navigate(['/login']), 1500);
          } catch (error) {
            this.errorMessage.set(extractErrorMessage(error, this.i18n.t('reset.error.default'), this.i18n.locale()));
          }
        },
      },
    },
  );
}
