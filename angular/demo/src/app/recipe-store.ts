import { computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { patchState, signalStore, withComputed, withHooks, withMethods, withProps, withState } from '@ngrx/signals';
import { RecipeModel } from './models';
import { API_BASE_URL } from './api-base';
import { I18nService } from './i18n.service';
import { extractErrorMessage } from './http-error';
import { notifyError, notifySuccess } from './notify';

type RecipeState = {
  /** Toàn bộ recipe đã tải — nguồn cho getRecipeById() (recipe-detail, add-recipe cần tra cứu theo id
   *  bất kể có đang search hay không, nên KHÔNG được ghi đè mảng này bằng kết quả search). */
  recipes: RecipeModel[];
  /** null = chưa search (danh sách hiển thị = recipes); mảng = kết quả search qua API (FE-06). */
  searchResults: RecipeModel[] | null;
  /** Chỉ true cho lần tải đầu tiên — dùng để hiện skeleton thay vì để trắng/nhảy sang "không có kết quả". */
  loading: boolean;
};

/** Backend CRUD của chính mình (NestJS) — nguồn dữ liệu duy nhất cho recipe. */
const RECIPE_API_URL = `${API_BASE_URL}/recipe`;

export const RecipeStore = signalStore(
  { providedIn: 'root' },

  withState<RecipeState>({
    recipes: [],
    searchResults: null,
    loading: true,
  }),

  withProps(() => ({
    http: inject(HttpClient),
    i18n: inject(I18nService),
    snackBar: inject(MatSnackBar),
  })),

  withComputed((store) => ({
    /** Danh sách để hiển thị: kết quả search nếu có, ngược lại toàn bộ recipe. */
    visibleRecipes: computed(() => store.searchResults() ?? store.recipes()),
  })),

  withMethods((store) => {
    /** Mọi lỗi API của recipe đều phải hiện ra cho người dùng thấy — im lặng khi lỗi còn tệ hơn message kỹ thuật. */
    function fail(error: unknown, fallbackKey: string): void {
      notifyError(store.snackBar, extractErrorMessage(error, store.i18n.t(fallbackKey), store.i18n.locale()));
    }

    return {
      /** Nạp toàn bộ recipe từ NestJS — dùng lúc khởi tạo store, không lọc theo search. */
      loadRecipes(): void {
        patchState(store, { loading: true });
        store.http.get<RecipeModel[]>(RECIPE_API_URL).subscribe({
          next: (recipes) => patchState(store, { recipes, loading: false }),
          error: (error) => {
            patchState(store, { loading: false });
            fail(error, 'recipes.loadError');
          },
        });
      },

      /** FE-06: search gọi qua RESTful API — không filter phía client. */
      search(keyword: string): void {
        store.http.get<RecipeModel[]>(`${RECIPE_API_URL}?search=${encodeURIComponent(keyword)}`).subscribe({
          next: (searchResults) => patchState(store, { searchResults }),
          error: (error) => fail(error, 'recipes.loadError'),
        });
      },

      /** Xoá từ khoá — quay lại hiển thị toàn bộ recipe đã nạp sẵn. */
      clearSearch(): void {
        patchState(store, { searchResults: null });
      },

      /** Gửi recipe mới lên NestJS; id do backend cấp. */
      addRecipe(newRecipe: Omit<RecipeModel, 'id'>): void {
        store.http.post<RecipeModel>(RECIPE_API_URL, newRecipe).subscribe({
          next: (created) => {
            patchState(store, (state) => ({ recipes: [...state.recipes, created] }));
            notifySuccess(store.snackBar, store.i18n.t('recipes.saveSuccess'));
          },
          error: (error) => fail(error, 'recipes.saveError'),
        });
      },

      /** Sửa recipe đã có trên NestJS. */
      updateRecipe(id: string, changes: Omit<RecipeModel, 'id'>): void {
        store.http.patch<RecipeModel>(`${RECIPE_API_URL}/${id}`, changes).subscribe({
          next: (updated) => {
            patchState(store, (state) => ({
              recipes: state.recipes.map((recipe) => (recipe.id === id ? updated : recipe)),
              searchResults: state.searchResults?.map((recipe) => (recipe.id === id ? updated : recipe)) ?? null,
            }));
            notifySuccess(store.snackBar, store.i18n.t('recipes.saveSuccess'));
          },
          error: (error) => fail(error, 'recipes.saveError'),
        });
      },

      /** Xóa recipe khỏi NestJS. */
      deleteRecipe(id: string): void {
        store.http.delete<void>(`${RECIPE_API_URL}/${id}`).subscribe({
          next: () =>
            patchState(store, (state) => ({
              recipes: state.recipes.filter((recipe) => recipe.id !== id),
              searchResults: state.searchResults?.filter((recipe) => recipe.id !== id) ?? null,
            })),
          error: (error) => fail(error, 'recipes.deleteError'),
        });
      },

      getRecipeById(id: string): RecipeModel | undefined {
        return store.recipes().find((recipe) => recipe.id === id) ?? store.searchResults()?.find((recipe) => recipe.id === id);
      },
    };
  }),

  withHooks({
    onInit(store) {
      store.loadRecipes();
    },
  }),
);
