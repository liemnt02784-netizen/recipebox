import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { resolve4 } from 'node:dns/promises';

const GMAIL_SMTP_HOST = 'smtp.gmail.com';
const GMAIL_SMTP_PORT = 465;

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private readonly fromAddress: string;
  private readonly user: string;
  private readonly pass: string;

  constructor(private readonly configService: ConfigService) {
    this.user = this.configService.getOrThrow<string>('GMAIL_USER');
    this.pass = this.configService.getOrThrow<string>('GMAIL_APP_PASSWORD');
    this.fromAddress = this.user;
    // Transporter tạm dùng hostname thường — sẽ được thay bằng bản trỏ thẳng IPv4 ngay sau khi
    // module khởi động xong (onModuleInit), không chặn app boot vì resolve4() là bất đồng bộ.
    this.transporter = this.buildTransporter(GMAIL_SMTP_HOST);
  }

  /**
   * Nhiều host free (Render...) không định tuyến được IPv6 ra ngoài, nhưng DNS mặc định của môi
   * trường đó lại ưu tiên/chỉ trả AAAA (IPv6) cho smtp.gmail.com — khiến nodemailer luôn thử kết
   * nối IPv6 trước và bị "connect ENETUNREACH" (đã xác nhận bằng log thật trên Render). Đặt
   * `dns.setDefaultResultOrder('ipv4first')` KHÔNG đủ vì nodemailer tự resolve DNS riêng, không
   * qua đường mà setting đó ảnh hưởng tới.
   *
   * Cách chắc chắn: tự resolve4() (chỉ hỏi bản ghi A, không mơ hồ IPv4/IPv6) rồi đưa thẳng địa
   * chỉ IP đó cho nodemailer làm `host` — nodemailer thấy host đã là IP thì bỏ qua toàn bộ bước
   * tự resolve DNS của nó (xem net.isIP() check trong nodemailer/lib/shared/index.js), nên không
   * còn đường nào để nó tự chọn nhầm IPv6 nữa. Giữ `tls.servername` là hostname thật để chứng chỉ
   * TLS của Gmail vẫn verify đúng (nếu không, kết nối qua IP trần sẽ bị lỗi hostname mismatch).
   */
  async onModuleInit(): Promise<void> {
    try {
      const addresses = await resolve4(GMAIL_SMTP_HOST);
      if (addresses[0]) {
        this.transporter = this.buildTransporter(addresses[0]);
        this.logger.log(`MailService: ép kết nối SMTP qua IPv4 ${addresses[0]} (${GMAIL_SMTP_HOST})`);
      }
    } catch (error) {
      this.logger.warn(
        `Không tự resolve được địa chỉ IPv4 cho ${GMAIL_SMTP_HOST} — dùng hostname mặc định, có thể gặp lại lỗi kết nối IPv6: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private buildTransporter(host: string): nodemailer.Transporter {
    return nodemailer.createTransport({
      host,
      port: GMAIL_SMTP_PORT,
      secure: true,
      auth: { user: this.user, pass: this.pass },
      tls: { servername: GMAIL_SMTP_HOST },
      // Không set timeout thì nodemailer có thể treo VÔ THỜI HẠN nếu kết nối mạng có vấn đề —
      // khiến cả request HTTP đang await nó cũng treo theo, không bao giờ trả response. Ép nó
      // fail nhanh trong 10s.
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
