import { MiddlewareConsumer, Module, NestModule, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { FriendlyThrottlerGuard } from './common/friendly-throttler.guard';
import { RequestLoggerMiddleware } from './common/request-logger.middleware';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CatModule } from './cat/cat.module';
import { UserModule } from './user/user.module';
import { RecipeModule } from './recipe/recipe.module';
import { TasksModule } from './tasks/tasks.module';
import { AuthModule } from './auth/auth.module';
import { OrderModule } from './order/order.module';
import { NotificationsModule } from './notifications/notifications.module';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('MONGODB_URI'),
      }),
    }),
    /** Giới hạn chung cho cả API — chặn spam/DoS thô sơ. Endpoint nhạy cảm
     *  (login, forgot-password) override giới hạn chặt hơn bằng @Throttle(). */
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    CatModule,
    UserModule,
    RecipeModule,
    TasksModule,
    AuthModule,
    OrderModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true }) },
    { provide: APP_GUARD, useClass: FriendlyThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  /** BE-11: middleware tự viết, áp cho toàn bộ route — xem RequestLoggerMiddleware. */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
