import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role, User, UserDocument, UserWithId } from './schemas/user.schema';

const SALT_ROUNDS = 10;

/** Các tài khoản admin cố định để test phân quyền — mật khẩu bị reset về giá trị seed mỗi lần app khởi động. */
const SEED_ADMINS: { username: string; password: string; email: string; name: string }[] = [
  { username: 'THANH LIEM', password: '123456', email: 'thanhliem.admin@example.com', name: 'THANH LIEM' },
  { username: 'tliem21', password: '123456', email: 'thanhliem21112006@gmail.com', name: 'tliem21' },
];

@Injectable()
export class UserService implements OnModuleInit {
  private readonly logger = new Logger(UserService.name);

  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async onModuleInit(): Promise<void> {
    for (const admin of SEED_ADMINS) {
      const passwordHash = await bcrypt.hash(admin.password, SALT_ROUNDS);
      await this.userModel
        .updateOne(
          { username: admin.username },
          { $set: { passwordHash, role: 'admin', name: admin.name, email: admin.email, isEmailVerified: true } },
          { upsert: true },
        )
        .exec();
      this.logger.log(`Đã đảm bảo tài khoản admin "${admin.username}" tồn tại (role=admin).`);
    }
  }

  async create(createUserDto: CreateUserDto): Promise<UserWithId> {
    const existing = await this.userModel
      .findOne({ $or: [{ username: createUserDto.username }, { email: createUserDto.email }] })
      .exec();
    if (existing) {
      const field = existing.username === createUserDto.username ? 'Username' : 'Email';
      throw new ConflictException(`${field} đã tồn tại`);
    }
    const passwordHash = await bcrypt.hash(createUserDto.password, SALT_ROUNDS);
    const created = await this.userModel.create({
      username: createUserDto.username,
      email: createUserDto.email,
      name: createUserDto.name,
      passwordHash,
    });
    return created.toJSON() as UserWithId;
  }

  /** AD-05/FE-07: lọc theo role (vd. chỉ xem admin) và tìm theo username/email/name. */
  async findAll(role?: Role, search?: string): Promise<UserWithId[]> {
    const filter: Record<string, unknown> = {};
    if (role) {
      filter.role = role;
    }
    const keyword = search?.trim();
    if (keyword) {
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ username: regex }, { email: regex }, { name: regex }];
    }
    const docs = await this.userModel.find(filter).exec();
    return docs.map((doc) => doc.toJSON() as UserWithId);
  }

  async findOne(id: string): Promise<UserWithId> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException(`User #${id} not found`);
    }
    const doc = await this.userModel.findById(id).exec();
    if (!doc) {
      throw new NotFoundException(`User #${id} not found`);
    }
    return doc.toJSON() as UserWithId;
  }

  /** Dùng nội bộ cho AuthService — trả về cả passwordHash để so sánh, không dùng toJSON(). */
  async findByUsername(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username }).exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  /** Đăng nhập chấp nhận cả username lẫn email trong cùng 1 ô — thử khớp cả hai field. */
  async findByIdentifier(identifier: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ $or: [{ username: identifier }, { email: identifier.toLowerCase() }] })
      .exec();
  }

  /** Đặt lại password thẳng bằng userId — dùng sau khi đã xác thực reset token hợp lệ. */
  async setPassword(id: string, newPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.userModel.findByIdAndUpdate(id, { passwordHash }).exec();
  }

  /** BE-04: đánh dấu email hiện tại của user đã được xác thực. */
  async markEmailVerified(id: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, { isEmailVerified: true }).exec();
  }

  /**
   * US-12: sửa profile (name/email/avatar/mật khẩu) — username/email đổi phải kiểm tra trùng trước khi ghi.
   * `requesterId`: id người đang gọi API. Nếu người này tự đổi mật khẩu của chính mình (requesterId === id)
   * thì bắt buộc phải xác thực đúng `currentPassword` trước — admin đổi mật khẩu người khác thì bỏ qua
   * bước này (đã có quyền admin, không có "mật khẩu hiện tại" của người khác để xác thực).
   */
  async update(id: string, updateUserDto: UpdateUserDto, requesterId?: string): Promise<UserWithId> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException(`User #${id} not found`);
    }
    if (updateUserDto.username || updateUserDto.email) {
      const existing = await this.userModel
        .findOne({
          _id: { $ne: id },
          $or: [
            ...(updateUserDto.username ? [{ username: updateUserDto.username }] : []),
            ...(updateUserDto.email ? [{ email: updateUserDto.email }] : []),
          ],
        })
        .exec();
      if (existing) {
        const field = existing.username === updateUserDto.username ? 'Username' : 'Email';
        throw new ConflictException(`${field} đã tồn tại`);
      }
    }

    const { password, currentPassword, ...rest } = updateUserDto;
    const update: Record<string, unknown> = { ...rest };
    if (password) {
      if (requesterId === id) {
        const doc = await this.userModel.findById(id).exec();
        const matches = doc && currentPassword ? await bcrypt.compare(currentPassword, doc.passwordHash) : false;
        if (!matches) {
          throw new BadRequestException('Mật khẩu hiện tại không đúng');
        }
      }
      update.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    }
    // Đổi email = địa chỉ chưa được xác thực lại — bắt verify lại từ đầu, tránh user đổi
    // sang email không phải của mình mà vẫn giữ trạng thái "đã xác thực" cũ.
    if (updateUserDto.email) {
      update.isEmailVerified = false;
    }
    const doc = await this.userModel
      .findByIdAndUpdate(id, update, { returnDocument: 'after' })
      .exec();
    if (!doc) {
      throw new NotFoundException(`User #${id} not found`);
    }
    return doc.toJSON() as UserWithId;
  }

  /**
   * AD-06/AD-07: cấp/thu hồi quyền admin. `currentUserId` là admin đang thực hiện thao tác —
   * chặn tự thu hồi quyền của chính mình để tránh tự khoá mình khỏi trang quản trị.
   */
  async updateRole(id: string, role: Role, currentUserId: string): Promise<UserWithId> {
    if (id === currentUserId) {
      throw new ConflictException('Không thể tự thay đổi quyền của chính mình');
    }
    if (!isValidObjectId(id)) {
      throw new NotFoundException(`User #${id} not found`);
    }
    const doc = await this.userModel.findByIdAndUpdate(id, { role }, { returnDocument: 'after' }).exec();
    if (!doc) {
      throw new NotFoundException(`User #${id} not found`);
    }
    return doc.toJSON() as UserWithId;
  }

  async remove(id: string): Promise<void> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException(`User #${id} not found`);
    }
    const doc = await this.userModel.findByIdAndDelete(id).exec();
    if (!doc) {
      throw new NotFoundException(`User #${id} not found`);
    }
  }
}
