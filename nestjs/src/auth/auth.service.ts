import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Role } from '../user/schemas/user.schema';
import {
  PasswordResetToken,
  PasswordResetTokenDocument,
} from './schemas/password-reset-token.schema';
import { RefreshToken, RefreshTokenDocument } from './schemas/refresh-token.schema';
import {
  EmailVerificationToken,
  EmailVerificationTokenDocument,
} from './schemas/email-verification-token.schema';
import { MailService } from '../mail/mail.service';
import { CustomJwtService } from './custom-jwt.service';

export interface JwtPayload {
  sub: string;
  username: string;
  role: Role;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; username: string; role: Role; avatarUrl?: string };
}

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
/** BE-05: refresh token sống lâu hơn nhiều so với access token — cho phép "nhớ đăng nhập" 30 ngày. */
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** BE-04: hạn của link xác thực email — dài hơn reset password vì không nhạy cảm bằng, người dùng có thể để email vài ngày mới đọc. */
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: CustomJwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    @InjectModel(PasswordResetToken.name)
    private readonly resetTokenModel: Model<PasswordResetTokenDocument>,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshTokenDocument>,
    @InjectModel(EmailVerificationToken.name)
    private readonly verificationTokenModel: Model<EmailVerificationTokenDocument>,
  ) {}

  async register(createUserDto: CreateUserDto, originHeader?: string): Promise<AuthResult> {
    const user = await this.userService.create(createUserDto);
    // BE-04: gửi email xác thực ngay sau khi tạo tài khoản — không chặn đăng nhập, chỉ để
    // người dùng tự xác nhận email của mình là có thật (best-effort, giống forgotPassword).
    await this.sendVerificationEmail(user.id, user.email, originHeader);
    return this.issueTokens(user.id, user.username, user.role, user.avatarUrl);
  }

  async login(loginDto: LoginDto): Promise<AuthResult> {
    const userDoc = await this.userService.findByIdentifier(loginDto.identifier);
    if (!userDoc) {
      throw new UnauthorizedException('Sai username hoặc password');
    }
    const isMatch = await bcrypt.compare(loginDto.password, userDoc.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Sai username hoặc password');
    }
    return this.issueTokens(userDoc.id as string, userDoc.username, userDoc.role, userDoc.avatarUrl);
  }

  /**
   * BE-05: dùng refresh token còn hiệu lực để cấp access token mới mà không bắt đăng nhập lại.
   * Xoay vòng (rotation): refresh token cũ bị thu hồi ngay, trả về refresh token mới — nếu ai đó
   * đánh cắp refresh token cũ và cố dùng lại, request đó sẽ thất bại vì token đã bị revoke.
   */
  async refresh(rawRefreshToken: string): Promise<AuthResult> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.refreshTokenModel.findOne({ tokenHash }).exec();

    if (!stored || stored.revoked || stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }

    stored.revoked = true;
    await stored.save();

    const user = await this.userService.findOne(stored.userId.toString());
    return this.issueTokens(user.id, user.username, user.role, user.avatarUrl);
  }

  /** BE-06: thu hồi refresh token khi user đăng xuất — access token cũ tự hết hạn theo TTL, không cần blacklist riêng. */
  async logout(rawRefreshToken: string): Promise<{ message: string }> {
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.refreshTokenModel.updateOne({ tokenHash }, { revoked: true }).exec();
    return { message: 'Đã đăng xuất' };
  }

  /** BE-04: gửi (hoặc gửi lại) email xác thực — tách riêng để register() và endpoint resend đều dùng được. */
  async sendVerificationEmail(userId: string, email: string, originHeader?: string): Promise<void> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    await this.verificationTokenModel.deleteMany({ userId });
    await this.verificationTokenModel.create({
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
    });

    const frontendUrl = this.resolveFrontendUrl(originHeader);
    const verifyUrl = `${frontendUrl}/verify-email?token=${rawToken}`;

    // KHÔNG await — gửi mail là tác vụ mạng ra ngoài (có thể chậm/bị chặn tuỳ môi trường host,
    // đã có timeout phòng hờ ở MailService) — không được để nó chặn response HTTP của
    // register()/resendVerificationEmail() phía trên, đúng như comment "best-effort" đã ghi.
    this.mailService.sendVerificationEmail(email, verifyUrl).catch((error: unknown) => {
      this.logger.error(
        `Gửi email xác thực tới ${email} thất bại — kiểm tra GMAIL_USER/GMAIL_APP_PASSWORD trong .env`,
        error instanceof Error ? error.stack : String(error),
      );
    });
  }

  /** Dùng khi user đổi email (bị reset isEmailVerified) hoặc lỡ mất mail xác thực đầu tiên. */
  async resendVerificationEmail(userId: string, originHeader?: string): Promise<{ message: string }> {
    const user = await this.userService.findOne(userId);
    if (user.isEmailVerified) {
      return { message: 'Email này đã được xác thực' };
    }
    await this.sendVerificationEmail(user.id, user.email, originHeader);
    return { message: 'Đã gửi lại email xác thực' };
  }

  /** BE-04: xác thực email bằng token gửi qua mail — đánh dấu user đã verify, token dùng 1 lần. */
  async verifyEmail(rawToken: string): Promise<{ message: string }> {
    const tokenHash = this.hashToken(rawToken);
    const verificationToken = await this.verificationTokenModel.findOne({ tokenHash }).exec();

    if (!verificationToken || verificationToken.used || verificationToken.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Link xác thực không hợp lệ hoặc đã hết hạn');
    }

    await this.userService.markEmailVerified(verificationToken.userId.toString());
    verificationToken.used = true;
    await verificationToken.save();

    return { message: 'Xác thực email thành công' };
  }

  /**
   * Luôn trả message chung chung dù email có tồn tại hay không — tránh lộ thông tin ai đã đăng ký.
   *
   * `originHeader` là Origin mà trình duyệt tự gắn vào request (vd: http://192.168.1.5:4200,
   * https://myapp.com) — dùng cái này để build link reset thay vì hardcode FRONTEND_URL trong
   * .env, vì địa chỉ LAN của máy chạy dev server có thể đổi bất cứ lúc nào (DHCP) và domain
   * thật khi deploy production cũng không giống .env. FRONTEND_URL chỉ còn là fallback cho các
   * trường hợp gọi API không qua trình duyệt (Postman, script...).
   */
  async forgotPassword(dto: ForgotPasswordDto, originHeader?: string): Promise<{ message: string }> {
    const genericResult = { message: 'Nếu email tồn tại, một link đặt lại mật khẩu đã được gửi.' };

    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      return genericResult;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    await this.resetTokenModel.deleteMany({ userId: user._id });
    await this.resetTokenModel.create({
      userId: user._id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    });

    const frontendUrl = this.resolveFrontendUrl(originHeader);
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    // KHÔNG await — gửi mail là tác vụ mạng ra ngoài, có thể chậm hoặc bị chặn tuỳ môi trường
    // host (đã có timeout phòng hờ ở MailService) — response trả về generic message NGAY, không
    // chờ email, vừa nhanh vừa đúng bảo mật (không lộ qua độ trễ việc email có tồn tại hay không).
    this.mailService.sendPasswordResetEmail(user.email, resetUrl).catch((error: unknown) => {
      this.logger.error(
        `Gửi email reset password tới ${user.email} thất bại — kiểm tra GMAIL_USER/GMAIL_APP_PASSWORD trong .env`,
        error instanceof Error ? error.stack : String(error),
      );
    });

    return genericResult;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const tokenHash = this.hashToken(dto.token);
    const resetToken = await this.resetTokenModel.findOne({ tokenHash }).exec();

    if (!resetToken || resetToken.used || resetToken.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn');
    }

    await this.userService.setPassword(resetToken.userId.toString(), dto.newPassword);
    resetToken.used = true;
    await resetToken.save();

    return { message: 'Đặt lại mật khẩu thành công' };
  }

  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /** Origin header do client tự gửi — chỉ chấp nhận nếu là URL http(s) hợp lệ, tránh chèn link lạ vào email. */
  private sanitizeOrigin(originHeader?: string): string | null {
    if (!originHeader) {
      return null;
    }
    try {
      const url = new URL(originHeader);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return null;
      }
      return url.origin;
    } catch {
      return null;
    }
  }

  private resolveFrontendUrl(originHeader?: string): string {
    return (
      this.sanitizeOrigin(originHeader) ??
      this.configService.get<string>('FRONTEND_URL') ??
      'http://localhost:4200'
    );
  }

  private async issueTokens(
    userId: string,
    username: string,
    role: Role,
    avatarUrl?: string,
  ): Promise<AuthResult> {
    const payload: JwtPayload = { sub: userId, username, role };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.createRefreshToken(userId);
    return {
      accessToken,
      refreshToken,
      user: { id: userId, username, role, avatarUrl },
    };
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const rawToken = crypto.randomBytes(40).toString('hex');
    await this.refreshTokenModel.create({
      userId,
      tokenHash: this.hashToken(rawToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });
    return rawToken;
  }
}
