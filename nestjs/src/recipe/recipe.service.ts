import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { Recipe, RecipeDocument } from './schemas/recipe.schema';

const SEED_RECIPES: CreateRecipeDto[] = [
  {
    name: 'Spaghetti Carbonara',
    authorEmail: 'liem21112006@gmail.com',
    description: 'Món mì Ý truyền thống với trứng và thịt xông khói.',
    imgUrl: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=600',
    isFavorite: false,
    ingredients: [
      { name: 'Mì Spaghetti', quantity: 200, unit: 'g', measure: '200g' },
      { name: 'Thịt má heo Guanciale', quantity: 100, unit: 'g', measure: '100 g' },
      { name: 'Lòng đỏ trứng', quantity: 4, unit: 'cái', measure: '4 cái' },
      { name: 'Phô mai Pecorino Romano', quantity: 50, unit: 'g', measure: '50 g' },
      { name: 'Tiêu đen', quantity: 1, unit: 'thìa cà phê', measure: '1 thìa cà phê' },
    ],
  },
  {
    name: 'Salad Caprese',
    authorEmail: 'liem21112006@gmail.com',
    description: 'Món salad Ý đơn giản và thanh mát.',
    imgUrl: 'https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?w=600',
    isFavorite: false,
    ingredients: [
      { name: 'Cà chua', quantity: 4, unit: 'quả', measure: '4 quả' },
      { name: 'Phô mai Mozzarella tươi', quantity: 200, unit: 'g', measure: '200g' },
      { name: 'Lá húng quế tươi', quantity: 1, unit: 'nắm', measure: '1 nắm' },
      { name: 'Dầu ô liu nguyên chất', quantity: 2, unit: 'thìa canh', measure: '2 thìa canh' },
    ],
  },
  {
    name: 'Pizza',
    description: 'Món Pizza nóng hỏi.',
    authorEmail: 'liem21112006@gmail.com',
    imgUrl: 'https://cdn.britannica.com/08/177308-050-94D9D6BE/Food-Pizza-Basil-Tomato.jpg',
    isFavorite: true,
    ingredients: [
      { name: 'Cà chua', quantity: 4, unit: 'quả', measure: '4 quả' },
      { name: 'Phô mai Mozzarella tươi', quantity: 200, unit: 'g', measure: '200g' },
      { name: 'Lá húng quế tươi', quantity: 1, unit: 'nắm', measure: '1 nắm' },
      { name: 'Mật Ong', quantity: 2, unit: 'thìa canh', measure: '2 thìa canh' },
    ],
  },
  {
    name: 'Cá Tím',
    description: 'Món đến từ biển chết',
    authorEmail: 'liem21112006@gmail.com',
    imgUrl: 'https://i.pinimg.com/1200x/c5/f7/af/c5f7af1d9994665533892ba0713273fa.jpg',
    isFavorite: true,
    ingredients: [
      { name: 'Quả Việt Quốc', quantity: 4, unit: 'quả', measure: '4 quả' },
      { name: 'Củ dền', quantity: 2, unit: 'quả', measure: '2 quả' },
      { name: 'Cá hồi', quantity: 1, unit: 'miếng', measure: '1 miếng' },
    ],
  },
];

@Injectable()
export class RecipeService implements OnModuleInit {
  private readonly logger = new Logger(RecipeService.name);

  constructor(@InjectModel(Recipe.name) private readonly recipeModel: Model<RecipeDocument>) {}

  /** DB trống thì nạp sẵn 4 recipe mẫu, để trải nghiệm giống lúc còn lưu mảng trong bộ nhớ. */
  async onModuleInit(): Promise<void> {
    const count = await this.recipeModel.countDocuments();
    if (count === 0) {
      await this.recipeModel.insertMany(SEED_RECIPES);
      this.logger.log(`Đã seed ${SEED_RECIPES.length} recipe mẫu vào MongoDB.`);
    }
  }

  async create(createRecipeDto: CreateRecipeDto): Promise<Recipe> {
    const created = await this.recipeModel.create(createRecipeDto);
    return created.toJSON();
  }

  /** FE-06: search phải chạy qua API — lọc theo tên món, không trả toàn bộ để filter phía client. */
  async findAll(search?: string): Promise<Recipe[]> {
    const keyword = search?.trim();
    const filter = keyword ? { name: new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } : {};
    const docs = await this.recipeModel.find(filter).exec();
    return docs.map((doc) => doc.toJSON());
  }

  async findOne(id: string): Promise<Recipe> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException(`Recipe #${id} not found`);
    }
    const doc = await this.recipeModel.findById(id).exec();
    if (!doc) {
      throw new NotFoundException(`Recipe #${id} not found`);
    }
    return doc.toJSON();
  }

  async update(id: string, updateRecipeDto: UpdateRecipeDto): Promise<Recipe> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException(`Recipe #${id} not found`);
    }
    const doc = await this.recipeModel
      .findByIdAndUpdate(id, updateRecipeDto, { returnDocument: 'after' })
      .exec();
    if (!doc) {
      throw new NotFoundException(`Recipe #${id} not found`);
    }
    return doc.toJSON();
  }

  async remove(id: string): Promise<void> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException(`Recipe #${id} not found`);
    }
    const doc = await this.recipeModel.findByIdAndDelete(id).exec();
    if (!doc) {
      throw new NotFoundException(`Recipe #${id} not found`);
    }
  }
}
