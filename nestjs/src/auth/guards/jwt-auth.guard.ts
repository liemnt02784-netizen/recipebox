import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { CustomJwtService } from '../custom-jwt.service';
import { JwtVerificationError } from '../jwt.util';
import type { JwtPayload } from '../auth.service';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * BE-03/BE-12: guard tự viết, không kế thừa passport's AuthGuard('jwt') — tự đọc header
 * Authorization, tự verify chữ ký bằng CustomJwtService (crypto thuần), tự gắn req.user.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: CustomJwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('No auth token');
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      if (!payload?.sub) {
        throw new UnauthorizedException('Unauthorized');
      }
      request.user = { userId: payload.sub, username: payload.username, role: payload.role };
      return true;
    } catch (error) {
      if (error instanceof JwtVerificationError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) {
      return null;
    }
    const [type, token] = header.split(' ');
    return type === 'Bearer' && token ? token : null;
  }
}
