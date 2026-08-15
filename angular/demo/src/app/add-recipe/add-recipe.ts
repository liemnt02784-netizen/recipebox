import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { applyEach, email, form, FormField, FormRoot, min, minLength, required } from '@angular/forms/signals';
import { Ingredient, RecipeModel } from '../models';
import { RecipeStore } from '../recipe-store';
import { I18nService } from '../i18n.service';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-add-recipe',
  imports: [
    FormField, FormRoot, MatButtonModule, MatButtonToggleModule, RouterLink,
    MatFormFieldModule, MatInputModule, MatIconModule,
  ],
  templateUrl: './add-recipe.html',
  styleUrl: './add-recipe.css',
})
export class AddRecipe {
  protected readonly store = inject(RecipeStore);
  protected readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly params = toSignal(this.route.paramMap);

  /** Có id trên route (/recipes/:id/edit) thì đang ở chế độ sửa, ngược lại là thêm mới. */
  protected readonly editingId = computed(() => this.params()?.get('id') ?? null);

  protected readonly pageTitle = computed(() =>
    this.editingId() != null ? this.i18n.t('addRecipe.titleEdit') : this.i18n.t('addRecipe.titleNew'),
  );

  private createEmptyModel() {
    return {
      name: '',
      authorEmail: '',
      description: '',
      imgUrl: '',
      ingredients: [this.createIngredient()],
    };
  }

  private createModelFromRecipe(recipe: RecipeModel) {
    return {
      name: recipe.name,
      authorEmail: recipe.authorEmail,
      description: recipe.description,
      imgUrl: recipe.imgUrl,
      ingredients: recipe.ingredients.map((ingredient) => ({ ...ingredient })),
    };
  }

  protected readonly recipeModel = signal(this.createEmptyModel());

  /** Form không có field cho isFavorite — giữ nguyên giá trị cũ khi sửa. */
  private editingIsFavorite = false;
  private hasPrefilled = false;

  protected readonly imageMode = signal<'upload' | 'link'>('upload');
  protected readonly isDragOver = signal(false);
  protected readonly uploadError = signal<string | null>(null);
  protected readonly imageLoadError = signal(false);

  constructor() {
    effect(() => {
      const id = this.editingId();
      if (id == null || this.hasPrefilled) {
        return;
      }
      const recipe = this.store.getRecipeById(id);
      if (!recipe) {
        return;
      }
      this.editingIsFavorite = recipe.isFavorite;
      this.recipeModel.set(this.createModelFromRecipe(recipe));
      this.hasPrefilled = true;
    });
  }

  protected readonly recipeForm = form(
    this.recipeModel,
    (path) => {
      required(path.name, { message: () => this.i18n.t('addRecipe.err.nameRequired') });
      minLength(path.name, 3, { message: () => this.i18n.t('addRecipe.err.nameMinLength') });
      required(path.description, { message: () => this.i18n.t('addRecipe.err.descriptionRequired') });
      required(path.authorEmail, { message: () => this.i18n.t('addRecipe.err.emailRequired') });
      email(path.authorEmail, { message: () => this.i18n.t('addRecipe.err.emailInvalid') });
      required(path.imgUrl, { message: () => this.i18n.t('addRecipe.err.imageRequired') });

      applyEach(path.ingredients, (ingredient) => {
        required(ingredient.name, { message: () => this.i18n.t('addRecipe.err.ingredientNameRequired') });
        required(ingredient.unit, { message: () => this.i18n.t('addRecipe.err.ingredientUnitRequired') });
        min(ingredient.quantity, 0, { message: () => this.i18n.t('addRecipe.err.quantityMin') });
      });
    },
    {
      submission: {
        action: async (field) => {
          const { name, authorEmail, description, imgUrl, ingredients } = field().value();
          const id = this.editingId();

          if (id != null) {
            this.store.updateRecipe(id, {
              name,
              authorEmail,
              description,
              imgUrl,
              isFavorite: this.editingIsFavorite,
              ingredients,
            });
            this.router.navigate(['/admin/recipes']);
            return;
          }

          this.store.addRecipe({
            name,
            authorEmail,
            description,
            imgUrl,
            isFavorite: false,
            ingredients,
          });

          this.recipeModel.set(this.createEmptyModel());
          this.recipeForm().reset();
          this.uploadError.set(null);
          this.imageLoadError.set(false);
        },
      },
    },
  );

  private createIngredient(): Ingredient {
    return { name: '', quantity: 1, unit: '', measure: '' };
  }

  protected addIngredient(): void {
    this.recipeModel.update((model) => ({
      ...model,
      ingredients: [...model.ingredients, this.createIngredient()],
    }));
  }

  protected removeIngredient(index: number): void {
    if (this.recipeModel().ingredients.length <= 1) {
      return;
    }
    this.recipeModel.update((model) => ({
      ...model,
      ingredients: model.ingredients.filter((_, i) => i !== index),
    }));
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.processFile(file);
    }
    input.value = '';
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.processFile(file);
    }
  }

  private processFile(file: File): void {
    this.uploadError.set(null);
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      this.uploadError.set(this.i18n.t('addRecipe.err.imageType'));
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      this.uploadError.set(this.i18n.t('addRecipe.err.imageSize'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.imageLoadError.set(false);
      this.recipeModel.update((model) => ({ ...model, imgUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  }

  protected onImgUrlTyped(): void {
    this.imageLoadError.set(false);
  }

  protected onPreviewImgError(): void {
    this.imageLoadError.set(true);
  }

  protected clearImage(): void {
    this.recipeModel.update((model) => ({ ...model, imgUrl: '' }));
    this.uploadError.set(null);
    this.imageLoadError.set(false);
  }
}
