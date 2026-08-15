import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule, MatSelectChange } from '@angular/material/select';
import { I18nService, Locale } from '../i18n.service';

@Component({
  selector: 'app-settings',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatFormFieldModule, MatSelectModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings {
  protected readonly i18n = inject(I18nService);

  protected onLocaleChange(event: MatSelectChange): void {
    this.i18n.setLocale(event.value as Locale);
  }
}
