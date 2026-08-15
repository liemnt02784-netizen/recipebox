import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Chặn spam tạo tài khoản hàng loạt: tối đa 5 lần/phút/IP. */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Public()
  @Post('register')
  register(@Body() createUserDto: CreateUserDto, @Headers('origin') origin?: string) {
    return this.authService.register(createUserDto, origin);
  }

  /** Chặn dò mật khẩu (brute-force): tối đa 5 lần/phút/IP. */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /** Chặn spam gửi email đặt lại mật khẩu: tối đa 3 lần/phút/IP. */
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
    @Headers('origin') origin?: string,
  ) {
    return this.authService.forgotPassword(forgotPasswordDto, origin);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  /** BE-05: cấp access token mới từ refresh token — @Public() vì access token cũ lúc này đã hết hạn. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  /** BE-06: thu hồi refresh token — @Public() để vẫn đăng xuất được kể cả khi access token đã hết hạn. */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  /** BE-04: xác thực email bằng token nhận được trong mail lúc đăng ký. */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  /** BE-04: gửi lại email xác thực — dùng khi lỡ mất mail đầu tiên hoặc vừa đổi email trong profile. */
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('resend-verification')
  resendVerification(@CurrentUser() currentUser: AuthenticatedUser, @Headers('origin') origin?: string) {
    return this.authService.resendVerificationEmail(currentUser.userId, origin);
  }
}
