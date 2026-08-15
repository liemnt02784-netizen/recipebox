import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** BE-04: token xác thực email gửi qua mail lúc đăng ký — tách riêng khỏi PasswordResetToken vì khác mục đích/vòng đời. */
@Schema()
export class EmailVerificationToken {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: false })
  used: boolean;
}

export type EmailVerificationTokenDocument = HydratedDocument<EmailVerificationToken>;
export const EmailVerificationTokenSchema = SchemaFactory.createForClass(EmailVerificationToken);
