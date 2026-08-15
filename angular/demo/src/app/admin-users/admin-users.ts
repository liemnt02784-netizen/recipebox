import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';
import { AdminUserStore } from '../admin-user-store';
import { AuthStore } from '../auth-store';
import { I18nService } from '../i18n.service';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { AdminUserModel } from '../models';

/** AD-05/AD-06/AD-07: danh sách quản trị viên + cấp/thu hồi quyền admin. */
@Component({
  selector: 'admin-users',
  imports: [FormsModule, MatCardModule, MatIconModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.css',
})
export class AdminUsers {
  protected readonly store = inject(AdminUserStore);
  protected readonly authStore = inject(AuthStore);
  protected readonly i18n = inject(I18nService);
  private readonly dialog = inject(MatDialog);

  protected readonly searchTerm = signal('');
  private searchDebounceHandle: ReturnType<typeof setTimeout> | null = null;

  protected readonly grantSearchTerm = signal('');
  protected readonly grantCandidates = signal<AdminUserModel[]>([]);
  private grantDebounceHandle: ReturnType<typeof setTimeout> | null = null;
  private lastGrantQuery = '';

  constructor() {
    this.store.loadUsers('admin');
  }

  /** AD-06: gõ tên/email user thường để tìm và cấp quyền admin — có debounce (FE-06.1). */
  protected onGrantSearchChange(value: string): void {
    this.grantSearchTerm.set(value);
    if (this.grantDebounceHandle) {
      clearTimeout(this.grantDebounceHandle);
    }
    const keyword = value.trim();
    if (keyword.length < 2) {
      this.grantCandidates.set([]);
      return;
    }
    this.grantDebounceHandle = setTimeout(() => {
      /** FE-06.4: keyword giống hệt lần tìm trước — không gửi lại request. */
      if (keyword === this.lastGrantQuery) {
        return;
      }
      this.lastGrantQuery = keyword;
      this.store.searchGrantCandidates(keyword).subscribe((candidates) => this.grantCandidates.set(candidates));
    }, 350);
  }

  protected grant(user: AdminUserModel): void {
    this.store.grantAdmin(user.id);
    this.grantCandidates.set(this.grantCandidates().filter((c) => c.id !== user.id));
    this.grantSearchTerm.set('');
  }

  /** FE-06.1: debounce input tìm kiếm thành viên quản trị. */
  protected onSearchChange(value: string): void {
    this.searchTerm.set(value);
    if (this.searchDebounceHandle) {
      clearTimeout(this.searchDebounceHandle);
    }
    this.searchDebounceHandle = setTimeout(() => {
      this.store.loadUsers('admin', this.searchTerm());
    }, 350);
  }

  protected isSelf(user: AdminUserModel): boolean {
    return user.id === this.authStore.user()?.id;
  }

  /** FE-13: thu hồi quyền admin là hành động quan trọng — bắt buộc xác nhận lại. */
  protected confirmRevoke(user: AdminUserModel): void {
    this.dialog
      .open(ConfirmDialog, {
        width: '400px',
        maxWidth: '90vw',
        autoFocus: false,
        panelClass: 'confirm-dialog-panel',
        data: {
          title: this.i18n.t('adminUsers.revokeDialogTitle'),
          message: this.i18n.t('adminUsers.revokeDialogMessage'),
          itemName: user.username,
          confirmLabel: this.i18n.t('adminUsers.revokeConfirm'),
          cancelLabel: this.i18n.t('common.cancel'),
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.store.revokeAdmin(user.id);
        }
      });
  }
}
