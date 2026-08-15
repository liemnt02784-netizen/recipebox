import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

/**
 * Gửi email qua Resend (HTTPS API, cổng 443) thay vì SMTP (cổng 465/587) — Render (gói Free)
 * chặn hẳn cổng SMTP ra ngoài, đã xác nhận bằng log thật ("Connection timeout" dù đã ép đúng
 * IPv4). HTTPS thì gần như không host nào chặn nên đây là hướng ổn định hơn cho môi trường
 * hosting free, không phải do code SMTP trước đó sai.
 *
 * RESEND_FROM: theo mặc định (chưa xác minh domain riêng), Resend chỉ cho gửi từ
 * "onboarding@resend.dev" và CHỈ gửi tới đúng email đã đăng ký tài khoản Resend — đủ để demo/
 * test dự án. Muốn gửi tới bất kỳ ai thì phải xác minh 1 domain riêng trên Resend rồi đổi
 * RESEND_FROM thành địa chỉ thuộc domain đó.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.getOrThrow<string>('RESEND_API_KEY');
    this.resend = new Resend(apiKey);
    this.fromAddress = this.configService.get<string>('RESEND_FROM') ?? 'My Recipe Box <onboarding@resend.dev>';
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.fromAddress,
      to,
      subject: 'Đặt lại mật khẩu',
      html: `
        <p>Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu cho tài khoản này.</p>
        <p><a href="${resetUrl}">Bấm vào đây để đặt lại mật khẩu</a> (link hết hạn sau 15 phút).</p>
        <p>Nếu không phải bạn yêu cầu, hãy bỏ qua email này.</p>
      `,
    });
    if (error) {
      throw new Error(`Resend trả lỗi: ${error.message}`);
    }
    this.logger.log(`Đã gửi email reset password tới ${to}`);
  }

  async sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.fromAddress,
      to,
      subject: 'Xác thực email của bạn',
      html: `
        <p>Cảm ơn bạn đã đăng ký My Recipe Box!</p>
        <p><a href="${verifyUrl}">Bấm vào đây để xác thực email</a> (link hết hạn sau 24 giờ).</p>
        <p>Nếu không phải bạn đăng ký, hãy bỏ qua email này.</p>
      `,
    });
    if (error) {
      throw new Error(`Resend trả lỗi: ${error.message}`);
    }
    this.logger.log(`Đã gửi email xác thực tới ${to}`);
  }
}
