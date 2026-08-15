import { Module } from '@nestjs/common';
import { CustomJwtService } from './custom-jwt.service';

/** BE-03: thay thế JwtModule của @nestjs/jwt — dùng chung 1 instance CustomJwtService cho AuthModule lẫn NotificationsModule. */
@Module({
  providers: [CustomJwtService],
  exports: [CustomJwtService],
})
export class CustomJwtModule {}
