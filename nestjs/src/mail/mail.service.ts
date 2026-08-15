import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    const user = this.configService.getOrThrow<string>('GMAIL_USER');
    const pass = this.configService.getOrThrow<string>('GMAIL_APP_PASSWORD');
    this.fromAddress = user;
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
      // Không set timeout thì nodemailer có thể treo VÔ THỜI HẠN nếu môi trường mạng chặn/lọc
      // cổng SMTP ra ngoài (rất hay gặp ở gói hosting free như Render) — khiến cả request HTTP
      // đang await nó cũng treo theo, không bao giờ trả response. Ép nó fail nhanh trong 10s.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    });
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    await this.transporter.sendMail({
      from: `"My Recipe Box" <${this.fromAddress}>`,
      to,
      subject: 'Đặt lại mật khẩu',
      html: `
        <p>Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu cho tài khoản này.</p>
        <p><a href="${resetUrl}">Bấm vào đây để đặt lại mật khẩu</a> (link hết hạn sau 15 phút).</p>
        <p>Nếu không phải bạn yêu cầu, hãy bỏ qua email này.</p>
      `,
    });
    this.logger.log(`Đã gửi email reset password tới ${to}`);
  }

  async sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
    await this.transporter.sendMail({
      from: `"My Recipe Box" <${this.fromAddress}>`,
      to,
      subject: 'Xác thực email của bạn',
      html: `
        <p>Cảm ơn bạn đã đăng ký My Recipe Box!</p>
        <p><a href="${verifyUrl}">Bấm vào đây để xác thực email</a> (link hết hạn sau 24 giờ).</p>
        <p>Nếu không phải bạn đăng ký, hãy bỏ qua email này.</p>
      `,
    });
    this.logger.log(`Đã gửi email xác thực tới ${to}`);
  }
}
