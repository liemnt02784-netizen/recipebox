import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../i18n.service';

@Component({
  selector: 'app-privacy',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './privacy.html',
})
export class Privacy {
  protected readonly i18n = inject(I18nService);
}
