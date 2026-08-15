import { Controller, Get, Post, Body, Patch, Param, NotFoundException, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('tasks')
@ApiBearerAuth('access-token')
@Controller('tasks')
export class TasksController {
    constructor(private readonly tasksService: TasksService) { }
    @Get()
    findAll() {
        return this.tasksService.findAll();
    }

    @Post()
    create(@Body() createTaskDto: CreateTaskDto) {
        return this.tasksService.create(createTaskDto.title);
    }
    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        const task = this.tasksService.findOne(id);
        if (!task) {
            throw new NotFoundException(`Task #${id} not found`);
        }
        return task;
    }

    /** Chỉ admin được đánh dấu task done. */
    @Roles('admin')
    @Patch(':id/done')
    markDone(@Param('id', ParseIntPipe) id: number) {
        const task = this.tasksService.markDone(id);
        if (!task) {
            throw new NotFoundException(`Task #${id} not found`);
        }
        return task;
    }

}
