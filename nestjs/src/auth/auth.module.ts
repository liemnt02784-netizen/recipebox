import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { CustomJwtModule } from './custom-jwt.module';
import { UserModule } from '../user/user.module';
import { MailModule } from '../mail/mail.module';
import { PasswordResetToken, PasswordResetTokenSchema } from './schemas/password-reset-token.schema';
import { RefreshToken, RefreshTokenSchema } from './schemas/refresh-token.schema';
import { EmailVerificationToken, EmailVerificationTokenSchema } from './schemas/email-verification-token.schema';

@Module({
  imports: [
    UserModule,
    MailModule,
    CustomJwtModule,
    MongooseModule.forFeature([
      { name: PasswordResetToken.name, schema: PasswordResetTokenSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema },
      { name: EmailVerificationToken.name, schema: EmailVerificationTokenSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AuthModule {}
