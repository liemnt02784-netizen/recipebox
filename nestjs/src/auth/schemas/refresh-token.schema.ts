import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** BE-05/BE-06: refresh token dài hạn — cho phép cấp lại access token mà không bắt đăng nhập lại, và có thể thu hồi. */
@Schema({ timestamps: true })
export class RefreshToken {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  /** Lưu SHA-256 của token gốc — token thật chỉ trả về client 1 lần, không bao giờ lưu plain-text trong DB. */
  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ required: true })
  expiresAt: Date;

  /** true khi đã bị thu hồi (logout, hoặc đã dùng để rotate sang token mới) — refresh token dùng 1 lần. */
  @Prop({ default: false })
  revoked: boolean;
}

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;
export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
