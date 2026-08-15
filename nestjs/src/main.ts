import { setDefaultResultOrder } from 'node:dns';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

// Nhiều host free (Render...) không định tuyến được IPv6 ra ngoài, nhưng DNS của Gmail SMTP trả
// về địa chỉ IPv6 trước — Node.js mặc định thử kết nối IPv6 trước, gây lỗi "connect ENETUNREACH"
// và treo/fail việc gửi mail. Ép toàn bộ app ưu tiên IPv4 khi resolve DNS, áp dụng từ sớm nhất
// có thể (trước khi bất kỳ module nào — kể cả MailService — mở kết nối mạng ra ngoài).
setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  // Avatar được gửi dạng base64 trong body JSON (US-12) — mặc định Express giới hạn 100kb,
  // không đủ cho ảnh vài trăm KB-vài MB đã encode base64 (~+33% dung lượng gốc), gây lỗi
  // 413 Payload Too Large. Nới lên 10mb, khớp với giới hạn 5MB gốc phía frontend.
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('NestJS Learning API')
    .setDescription('Recipe / Tasks / User / Auth — kèm JWT + phân quyền admin/user')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
