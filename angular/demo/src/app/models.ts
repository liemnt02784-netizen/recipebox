  export interface Ingredient {
    name: string;
    measure: string;
    quantity: number | null ;
    unit: string;
  }

  export interface RecipeModel {
    /** ObjectId của MongoDB, dạng chuỗi 24 ký tự hex. */
    id: string;
    name: string;
    authorEmail: string;
    description: string;
    imgUrl: string;
    isFavorite: boolean;
    ingredients: Ingredient[] ;
  }

  export interface AuthUser {
    id: string;
    username: string;
    role: 'user' | 'admin';
    avatarUrl?: string;
  }

  export interface UpdateProfileRequest {
    name?: string;
    email?: string;
    avatarUrl?: string;
    password?: string;
    currentPassword?: string;
  }

  export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
  }

  export interface LoginRequest {
    identifier: string;
    password: string;
  }

  export interface RegisterRequest {
    username: string;
    email: string;
    password: string;
    name?: string;
  }

  export interface ForgotPasswordRequest {
    email: string;
  }

  export interface ResetPasswordRequest {
    token: string;
    newPassword: string;
  }

  export type OrderStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

  export interface OrderModel {
    id: string;
    userId: string;
    recipeId: string;
    portions: number;
    status: OrderStatus;
    cancelReason?: string;
    createdAt: string;
    updatedAt: string;
    recipe: { id: string; name: string; imgUrl: string } | null;
  }

  export interface CreateOrderRequest {
    recipeId: string;
    portions: number;
  }

  /** Đơn nhìn từ phía admin — có thêm thông tin người đặt. */
  export interface AdminOrderModel extends OrderModel {
    user: { id: string; username: string; email: string } | null;
  }

  export interface UpdateOrderStatusRequest {
    status: OrderStatus;
    cancelReason?: string;
  }

  export interface AdminUserModel {
    id: string;
    username: string;
    email: string;
    name?: string;
    role: 'user' | 'admin';
  }

  export interface OrderStats {
    totalOrders: number;
    byStatus: Record<OrderStatus, number>;
    topRecipes: { recipe: { id: string; name: string } | null; totalOrders: number; totalPortions: number }[];
  }
