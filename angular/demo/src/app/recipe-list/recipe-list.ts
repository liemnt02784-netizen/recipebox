import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RecipeStore } from '../recipe-store';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { I18nService } from '../i18n.service';

/** FE-06.1: chờ người dùng ngừng gõ trước khi gọi API. */
const DEBOUNCE_MS = 350;
/** FE-06.3: không search ở ký tự đầu tiên — chỉ gửi request khi keyword đạt độ dài này. */
const MIN_SEARCH_LENGTH = 2;

@Component({
  selector: 'recipe-list',
  imports: [
    RouterLink, FormsModule,
    MatFormFieldModule, MatInputModule,
    MatIconModule, MatButtonModule, MatCardModule,
  ],
  templateUrl: './recipe-list.html',
  styleUrl: './recipe-list.css'
})
export class RecipeList {
  protected readonly store = inject(RecipeStore);
  protected readonly i18n = inject(I18nService);
  protected readonly title = signal('My Recipe Box');

  protected readonly visibleRecipes = this.store.visibleRecipes;
  protected readonly searchInput = signal('');

  private debounceHandle: ReturnType<typeof setTimeout> | null = null;
  private lastQuery: string | null = null;

  /** FE-06: search chỉ gọi qua API (RecipeStore.search) — không filter phía client. */
  protected onSearchChange(value: string): void {
    this.searchInput.set(value);
    if (this.debounceHandle) {
      clearTimeout(this.debounceHandle);
    }
    this.debounceHandle = setTimeout(() => this.runSearch(value), DEBOUNCE_MS);
  }

  private runSearch(rawValue: string): void {
    // FE-06.2: chống khoảng trắng — trim ra rỗng thì coi như không có từ khoá.
    const keyword = rawValue.trim();

    if (keyword.length === 0) {
      this.lastQuery = null;
      this.store.clearSearch();
      return;
    }
    // FE-06.3: chưa đạt độ dài tối thiểu thì chưa gửi request (vẫn hiện toàn bộ danh sách).
    if (keyword.length < MIN_SEARCH_LENGTH) {
      return;
    }
    // FE-06.4: keyword giống hệt lần tìm trước — không gửi lại request.
    if (keyword === this.lastQuery) {
      return;
    }
    this.lastQuery = keyword;
    this.store.search(keyword);
  }
}
