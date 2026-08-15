import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../i18n.service';

/** AD-03: bắt buộc nhập lý do trước khi admin chuyển đơn sang "Bị hủy". */
@Component({
  selector: 'app-cancel-reason-dialog',
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule],
  templateUrl: './cancel-reason-dialog.html',
  styleUrl: './cancel-reason-dialog.css',
})
export class CancelReasonDialog {
  protected readonly i18n = inject(I18nService);
  private readonly dialogRef = inject(MatDialogRef<CancelReasonDialog>);

  protected readonly reason = signal('');

  protected confirm(): void {
    if (!this.reason().trim()) {
      return;
    }
    this.dialogRef.close(this.reason().trim());
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}
