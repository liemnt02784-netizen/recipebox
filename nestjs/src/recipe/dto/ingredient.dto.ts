import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class IngredientDto {
  @ApiProperty({ example: 'Cà chua' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: '4 quả' })
  @IsOptional()
  @IsString()
  measure?: string;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsNumber()
  quantity?: number | null;

  @ApiPropertyOptional({ example: 'quả' })
  @IsOptional()
  @IsString()
  unit?: string;
}
