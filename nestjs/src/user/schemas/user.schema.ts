import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type Role = 'user' | 'admin';

@Schema({
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret['id'] = ret['_id']?.toString();
      delete ret['_id'];
      delete ret['__v'];
      delete ret['passwordHash'];
    },
  },
})
export class User {
  @Prop({ required: true, unique: true, trim: true })
  username: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop()
  name?: string;

  /** US-12: avatar dạng data URL (base64) hoặc link ảnh — không lưu file lên đĩa server. */
  @Prop()
  avatarUrl?: string;

  @Prop({ required: true, enum: ['user', 'admin'], default: 'user' })
  role: Role;

  /** BE-04: đánh dấu email đã được xác thực qua link gửi lúc đăng ký. */
  @Prop({ default: false })
  isEmailVerified: boolean;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

/** Hình dạng trả về sau toJSON() — có thêm `id` (string) do transform sinh ra. */
export interface UserWithId extends User {
  id: string;
}
