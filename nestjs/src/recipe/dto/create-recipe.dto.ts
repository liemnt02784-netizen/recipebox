import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';
import { IngredientDto } from './ingredient.dto';

export class CreateRecipeDto {
  @ApiProperty({ example: 'Salad Caprese' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'a@b.com' })
  @IsString()
  authorEmail!: string;

  @ApiProperty({ example: 'Món salad Ý đơn giản và thanh mát.' })
  @IsString()
  description!: string;

  @ApiProperty({ example: 'https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?w=600' })
  @IsString()
  imgUrl!: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  @ApiProperty({ type: [IngredientDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngredientDto)
  ingredients!: IngredientDto[];
}
