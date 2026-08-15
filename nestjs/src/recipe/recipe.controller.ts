import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RecipeService } from './recipe.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';

@ApiTags('recipe')
@ApiBearerAuth('access-token')
@Controller('recipe')
export class RecipeController {
  constructor(private readonly recipeService: RecipeService) {}

  @Post()
  create(@Body() createRecipeDto: CreateRecipeDto) {
    return this.recipeService.create(createRecipeDto);
  }

  @Get()
  findAll(@Query('search') search?: string) {
    return this.recipeService.findAll(search);
  }

  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.recipeService.findOne(id);
  }

  /** Chỉ admin được sửa recipe. */
  @Roles('admin')
  @Patch(':id')
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() updateRecipeDto: UpdateRecipeDto) {
    return this.recipeService.update(id, updateRecipeDto);
  }

  /** Chỉ admin được xóa recipe. */
  @Roles('admin')
  @Delete(':id')
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.recipeService.remove(id);
  }
}
