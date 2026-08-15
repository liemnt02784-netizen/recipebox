import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseExpiresIn, signJwt, verifyJwt } from './jwt.util';

/** BE-03: wrapper injectable quanh jwt.util — cùng "hình dạng" API với JwtService cũ (sign/verify) để phần còn lại của code không phải đổi cách gọi. */
@Injectable()
export class CustomJwtService {
  constructor(private readonly configService: ConfigService) {}

  sign(payload: object): string {
    const secret = this.configService.getOrThrow<string>('JWT_SECRET');
    const expiresInSeconds = parseExpiresIn(this.configService.get<string>('JWT_EXPIRES_IN') ?? '15m');
    return signJwt(payload, secret, expiresInSeconds);
  }

  verify<T extends object>(token: string): T {
    const secret = this.configService.getOrThrow<string>('JWT_SECRET');
    return verifyJwt<T>(token, secret);
  }
}
