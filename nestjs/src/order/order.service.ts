import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument, OrderStatus } from './schemas/order.schema';
import { Recipe, RecipeDocument } from '../recipe/schemas/recipe.schema';
import { User, UserDocument } from '../user/schemas/user.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { NotificationsService } from '../notifications/notifications.service';

/** Ký tự đặc biệt trong regex phải escape trước khi nhét keyword người dùng nhập vào — tránh lỗi cú pháp hoặc ReDoS. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class OrderService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Recipe.name) private readonly recipeModel: Model<RecipeDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** BE-18(b): đơn tạo mới từ user → bắn SSE cho admin theo dõi realtime. */
  async create(userId: string, dto: CreateOrderDto) {
    const recipe = await this.recipeModel.findById(dto.recipeId).exec();
    if (!recipe) {
      throw new NotFoundException('Không tìm thấy món ăn');
    }

    const order = await this.orderModel.create({
      userId,
      recipeId: dto.recipeId,
      portions: dto.portions,
      status: 'pending',
    });

    this.notificationsService.emit({
      type: 'order_created',
      orderId: order.id as string,
      userId,
      recipeName: recipe.name,
      status: order.status,
      message: `Đơn mới: ${recipe.name} (x${dto.portions})`,
    });

    return this.toResponse(order, recipe);
  }

  async findAllForUser(userId: string) {
    const orders = await this.orderModel
      .find({ userId, hiddenByUser: { $ne: true } })
      .sort({ createdAt: -1 })
      .exec();
    return this.attachRelated(orders);
  }

  /** Ẩn đơn khỏi "Đơn của tôi" — chỉ đơn đã xong (completed/cancelled), không ảnh hưởng dữ liệu/thống kê. */
  async hideForUser(userId: string, id: string): Promise<{ message: string }> {
    const order = await this.findOwnedOrder(userId, id);
    if (order.status !== 'completed' && order.status !== 'cancelled') {
      throw new BadRequestException('Chỉ ẩn được đơn đã hoàn thành hoặc đã huỷ');
    }
    order.hiddenByUser = true;
    await order.save();
    return { message: 'Đã ẩn đơn khỏi danh sách' };
  }

  /** Ẩn đơn khỏi trang quản trị đơn — chỉ đơn đã xong, độc lập với hiddenByUser. */
  async hideForAdmin(id: string): Promise<{ message: string }> {
    const order = await this.orderModel.findById(id).exec();
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn đặt món');
    }
    if (order.status !== 'completed' && order.status !== 'cancelled') {
      throw new BadRequestException('Chỉ ẩn được đơn đã hoàn thành hoặc đã huỷ');
    }
    order.hiddenByAdmin = true;
    await order.save();
    return { message: 'Đã ẩn đơn khỏi danh sách' };
  }

  async findOne(userId: string, id: string) {
    const order = await this.findOwnedOrder(userId, id);
    const recipe = await this.recipeModel.findById(order.recipeId).exec();
    return this.toResponse(order, recipe);
  }

  /** US-09: chỉ được sửa số khẩu phần khi đơn còn "pending" — chưa được admin bắt đầu xử lý. */
  async update(userId: string, id: string, dto: UpdateOrderDto) {
    const order = await this.findOwnedOrder(userId, id);
    if (order.status !== 'pending') {
      throw new BadRequestException('Chỉ có thể sửa đơn khi đơn đang chờ xử lý');
    }
    order.portions = dto.portions;
    await order.save();
    const recipe = await this.recipeModel.findById(order.recipeId).exec();
    return this.toResponse(order, recipe);
  }

  /** US-10/BE-18(a): user tự huỷ đơn — chỉ khi đơn chưa hoàn thành/đã huỷ, bắn SSE báo đổi status. */
  async cancel(userId: string, id: string) {
    const order = await this.findOwnedOrder(userId, id);
    if (order.status === 'completed' || order.status === 'cancelled') {
      throw new BadRequestException('Đơn đã hoàn thành hoặc đã huỷ, không thể huỷ thêm');
    }
    order.status = 'cancelled';
    order.cancelReason = 'Huỷ bởi người dùng';
    await order.save();
    const recipe = await this.recipeModel.findById(order.recipeId).exec();

    this.notificationsService.emit({
      type: 'order_status_changed',
      orderId: order.id as string,
      userId,
      recipeName: recipe?.name ?? '',
      status: order.status,
      message: `Đơn "${recipe?.name ?? ''}" đã bị huỷ bởi người dùng`,
    });

    return this.toResponse(order, recipe);
  }

  /** AD-01/FE-07: danh sách toàn bộ đơn cho admin, lọc theo trạng thái và/hoặc tìm theo tên món / người đặt. */
  async findAllAdmin(status?: OrderStatus, search?: string) {
    const filter: Record<string, unknown> = { hiddenByAdmin: { $ne: true } };
    if (status) {
      filter.status = status;
    }

    const keyword = search?.trim();
    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), 'i');
      const [matchingRecipes, matchingUsers] = await Promise.all([
        this.recipeModel.find({ name: regex }).select('_id').exec(),
        this.userModel.find({ $or: [{ username: regex }, { email: regex }, { name: regex }] }).select('_id').exec(),
      ]);
      const recipeIds = matchingRecipes.map((r) => r._id);
      const userIds = matchingUsers.map((u) => u._id);
      if (recipeIds.length === 0 && userIds.length === 0) {
        return [];
      }
      filter.$or = [{ recipeId: { $in: recipeIds } }, { userId: { $in: userIds } }];
    }

    const orders = await this.orderModel.find(filter).sort({ createdAt: -1 }).exec();
    return this.attachRelated(orders);
  }

  /** AD-02/AD-03/BE-18(a): admin đổi trạng thái đơn — bắt buộc lý do huỷ, bắn SSE cho chủ đơn + các admin khác. */
  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const order = await this.orderModel.findById(id).exec();
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn đặt món');
    }
    if (dto.status === 'cancelled' && !dto.cancelReason?.trim()) {
      throw new BadRequestException('Vui lòng nhập lý do huỷ đơn');
    }

    order.status = dto.status;
    order.cancelReason = dto.status === 'cancelled' ? dto.cancelReason : undefined;
    await order.save();
    const [recipe, user] = await Promise.all([
      this.recipeModel.findById(order.recipeId).exec(),
      this.userModel.findById(order.userId).exec(),
    ]);

    this.notificationsService.emit({
      type: 'order_status_changed',
      orderId: order.id as string,
      userId: order.userId.toString(),
      recipeName: recipe?.name ?? '',
      status: order.status,
      message: `Đơn "${recipe?.name ?? ''}" đã chuyển sang trạng thái "${this.statusLabel(order.status)}"`,
    });

    return this.toResponse(order, recipe, user);
  }

  private statusLabel(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
      pending: 'Chờ xử lý',
      in_progress: 'Đang làm',
      completed: 'Hoàn thành',
      cancelled: 'Bị hủy',
    };
    return labels[status];
  }

  /** AD-04: số liệu cho dashboard — đếm theo trạng thái + top món được đặt nhiều nhất. */
  async getStats() {
    const [statusCounts, topRecipesRaw] = await Promise.all([
      this.orderModel.aggregate<{ _id: OrderStatus; count: number }>([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.orderModel.aggregate<{ _id: string; totalOrders: number; totalPortions: number }>([
        { $group: { _id: '$recipeId', totalOrders: { $sum: 1 }, totalPortions: { $sum: '$portions' } } },
        { $sort: { totalOrders: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const recipeIds = topRecipesRaw.map((r) => r._id);
    const recipes = await this.recipeModel.find({ _id: { $in: recipeIds } }).exec();
    const recipeById = new Map(recipes.map((recipe) => [recipe.id as string, recipe]));

    const byStatus: Record<OrderStatus, number> = { pending: 0, in_progress: 0, completed: 0, cancelled: 0 };
    for (const entry of statusCounts) {
      byStatus[entry._id] = entry.count;
    }

    const topRecipes = topRecipesRaw.map((entry) => ({
      recipe: recipeById.get(entry._id.toString()) ? { id: entry._id.toString(), name: recipeById.get(entry._id.toString())!.name } : null,
      totalOrders: entry.totalOrders,
      totalPortions: entry.totalPortions,
    }));

    return {
      totalOrders: Object.values(byStatus).reduce((sum, n) => sum + n, 0),
      byStatus,
      topRecipes,
    };
  }

  private async findOwnedOrder(userId: string, id: string): Promise<OrderDocument> {
    const order = await this.orderModel.findById(id).exec();
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn đặt món');
    }
    if (order.userId.toString() !== userId) {
      throw new ForbiddenException('Bạn không có quyền truy cập đơn này');
    }
    return order;
  }

  private async attachRelated(orders: OrderDocument[]) {
    const recipeIds = [...new Set(orders.map((order) => order.recipeId.toString()))];
    const userIds = [...new Set(orders.map((order) => order.userId.toString()))];
    const [recipes, users] = await Promise.all([
      this.recipeModel.find({ _id: { $in: recipeIds } }).exec(),
      this.userModel.find({ _id: { $in: userIds } }).exec(),
    ]);
    const recipeById = new Map(recipes.map((recipe) => [recipe.id as string, recipe]));
    const userById = new Map(users.map((user) => [user.id as string, user]));
    return orders.map((order) =>
      this.toResponse(order, recipeById.get(order.recipeId.toString()) ?? null, userById.get(order.userId.toString()) ?? null),
    );
  }

  private toResponse(order: OrderDocument, recipe: RecipeDocument | null, user: UserDocument | null = null) {
    const json = order.toJSON() as unknown as Record<string, unknown>;
    return {
      ...json,
      recipe: recipe ? { id: recipe.id, name: recipe.name, imgUrl: recipe.imgUrl } : null,
      user: user ? { id: user.id, username: user.username, email: user.email } : null,
    };
  }
}
