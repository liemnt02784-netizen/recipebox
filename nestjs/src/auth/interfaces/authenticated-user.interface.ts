import type { JwtPayload } from '../auth.service';

export interface AuthenticatedUser {
  userId: string;
  username: string;
  role: JwtPayload['role'];
}
