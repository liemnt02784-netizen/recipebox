import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';

/** BE-13: custom Pipe — validate route param là MongoDB ObjectId hợp lệ trước khi vào service, trả 400 rõ ràng thay vì lỗi Mongo khó hiểu. */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isValidObjectId(value)) {
      throw new BadRequestException(`"${value}" không phải là id hợp lệ`);
    }
    return value;
  }
}
