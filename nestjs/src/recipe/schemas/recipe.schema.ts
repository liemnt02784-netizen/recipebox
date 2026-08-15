import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class Ingredient {
  @Prop({ required: true })
  name: string;

  @Prop({ default: '' })
  measure: string;

  @Prop({ type: Number, default: null })
  quantity: number | null;

  @Prop({ default: '' })
  unit: string;
}

const IngredientSchema = SchemaFactory.createForClass(Ingredient);

@Schema({
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret['id'] = ret['_id']?.toString();
      delete ret['_id'];
      delete ret['__v'];
    },
  },
})
export class Recipe {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  authorEmail: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  imgUrl: string;

  @Prop({ default: false })
  isFavorite: boolean;

  @Prop({ type: [IngredientSchema], default: [] })
  ingredients: Ingredient[];
}

export type RecipeDocument = HydratedDocument<Recipe>;
export const RecipeSchema = SchemaFactory.createForClass(Recipe);
