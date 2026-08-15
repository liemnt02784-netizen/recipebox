import { MatSnackBar } from '@angular/material/snack-bar';

/**
 * Nhóm 1 (feedback trạng thái): thống nhất 1 điểm gọi cho MỌI toast trong app — trước đây mỗi
 * store tự gọi snackBar.open() với text trần, không phân biệt được thành công/lỗi bằng mắt,
 * chỉ đọc được qua nội dung chữ. Giờ success (xanh, icon check) và error (đỏ, icon cảnh báo)
 * tách bạch ngay từ màu sắc — không cần đọc hết câu mới biết thao tác có thành công hay không.
 */
export function notifySuccess(snackBar: MatSnackBar, message: string): void {
  snackBar.open(message, undefined, {
    duration: 3000,
    panelClass: ['app-snackbar', 'app-snackbar-success'],
  });
}

export function notifyError(snackBar: MatSnackBar, message: string): void {
  snackBar.open(message, undefined, {
    duration: 4500,
    panelClass: ['app-snackbar', 'app-snackbar-error'],
  });
}
