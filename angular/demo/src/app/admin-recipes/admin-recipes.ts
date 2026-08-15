import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RecipeStore } from '../recipe-store';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { I18nService } from '../i18n.service';

/** Khoảng thời gian được "Hoàn tác" trước khi món thật sự bị xóa khỏi NestJS. */
const UNDO_WINDOW_MS = 5000;
/** FE-06.1/FE-06.3: debounce + độ dài tối thiểu trước khi gọi API tìm kiếm (FE-07: tương tự trang user). */
const DEBOUNCE_MS = 350;
const MIN_SEARCH_LENGTH = 2;

/**
 * AD-08/AD-09: trang quản trị Recipe (Create/Edit/Delete) — tách bạch hoàn toàn khỏi
 * trang xem/đặt món của user (recipe-list), không dùng chung component hay layout.
 */
@Component({
  selector: 'admin-recipes',
  imports: [
    RouterLink, FormsModule,
    MatFormFieldModule, MatInputModule,
    MatIconModule, MatButtonModule, MatCardModule,
  ],
  templateUrl: './admin-recipes.html',
  styleUrl: './admin-recipes.css',
})
export class AdminRecipes {
  protected readonly store = inject(RecipeStore);
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly visibleRecipes = this.store.visibleRecipes;
  protected readonly searchInput = signal('');

  private debounceHandle: ReturnType<typeof setTimeout> | null = null;
  private lastQuery: string | null = null;

  /** FE-07: search trang quản trị recipe cũng phải qua API, cùng logic debounce/chống spam như FE-06. */
  protected onSearchChange(value: string): void {
    this.searchInput.set(value);
    if (this.debounceHandle) {
      clearTimeout(this.debounceHandle);
    }
    this.debounceHandle = setTimeout(() => this.runSearch(value), DEBOUNCE_MS);
  }

  private runSearch(rawValue: string): void {
    const keyword = rawValue.trim();
    if (keyword.length === 0) {
      this.lastQuery = null;
      this.store.clearSearch();
      return;
    }
    if (keyword.length < MIN_SEARCH_LENGTH) {
      return;
    }
    if (keyword === this.lastQuery) {
      return;
    }
    this.lastQuery = keyword;
    this.store.search(keyword);
  }

  protected editRecipe(id: string): void {
    this.router.navigate(['/admin/recipes', id, 'edit']);
  }

  protected deleteRecipe(id: string, name: string): void {
    this.dialog
      .open(ConfirmDialog, {
        width: '400px',
        maxWidth: '90vw',
        autoFocus: false,
        panelClass: 'confirm-dialog-panel',
        data: {
          title: this.i18n.t('recipes.deleteDialogTitle'),
          message: this.i18n.t('recipes.deleteDialogMessage', { seconds: UNDO_WINDOW_MS / 1000 }),
          itemName: name,
          confirmLabel: this.i18n.t('recipes.deleteConfirm'),
          cancelLabel: this.i18n.t('recipes.deleteCancel'),
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.confirmDelete(id, name);
        }
      });
  }

  private confirmDelete(id: string, name: string): void {
    const recipeBeforeDelete = this.store.getRecipeById(id);
    this.store.deleteRecipe(id);

    const snackBarRef = this.snackBar.open(
      this.i18n.t('recipes.deletedToast', { name }),
      this.i18n.t('recipes.undo'),
      { duration: UNDO_WINDOW_MS },
    );

    snackBarRef.onAction().subscribe(() => {
      if (!recipeBeforeDelete) {
        return;
      }
      const { id: _discardOldId, ...recipeWithoutId } = recipeBeforeDelete;
      this.store.addRecipe(recipeWithoutId);
    });
  }
}
