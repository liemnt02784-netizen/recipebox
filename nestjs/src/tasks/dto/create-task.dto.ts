import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({ example: 'Mua sữa' })
  @IsString()
  @IsNotEmpty()
  title!: string;
}
