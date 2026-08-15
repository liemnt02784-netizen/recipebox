import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * pending: vừa đặt, chưa được admin xử lý — chỉ ở trạng thái này user mới được
 * sửa số khẩu phần (US-09). in_progress/completed/cancelled do admin gán (AD-02).
 */
export type OrderStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret['id'] = ret['_id']?.toString();
      delete ret['_id'];
      delete ret['__v'];
    },
  },
})
export class Order {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Recipe', required: true })
  recipeId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  portions: number;

  @Prop({ required: true, enum: ['pending', 'in_progress', 'completed', 'cancelled'], default: 'pending' })
  status: OrderStatus;

  /** Lý do huỷ — bắt buộc khi admin huỷ (AD-03), hiển thị lại cho user (US-11). */
  @Prop()
  cancelReason?: string;

  /**
   * Ẩn mềm khỏi danh sách tương ứng để dọn bớt đơn cũ khi danh sách dài — bản ghi vẫn còn
   * nguyên trong DB, KHÔNG ảnh hưởng thống kê dashboard (AD-04 vẫn tính trên toàn bộ đơn).
   * 2 cờ độc lập vì user và admin xem 2 danh sách khác nhau, ẩn ở bên này không ảnh hưởng bên kia.
   */
  @Prop({ default: false })
  hiddenByUser: boolean;

  @Prop({ default: false })
  hiddenByAdmin: boolean;
}

export type OrderDocument = HydratedDocument<Order>;
export const OrderSchema = SchemaFactory.createForClass(Order);
