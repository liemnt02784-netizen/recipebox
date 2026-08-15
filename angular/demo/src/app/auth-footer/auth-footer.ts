import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService, Locale } from '../i18n.service';

@Component({
  selector: 'app-auth-footer',
  imports: [RouterLink],
  templateUrl: './auth-footer.html',
})
export class AuthFooter {
  protected readonly i18n = inject(I18nService);

  protected onLocaleChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as Locale;
    this.i18n.setLocale(value);
  }
}
