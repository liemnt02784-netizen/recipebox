import { Injectable } from '@nestjs/common';
import { Task } from './entities/task.entity';

@Injectable()
export class TasksService {
    private tasks: Task[] = [];
    private nextId = 1;
    findAll(): Task[] {
        return this.tasks;
    }
    create(title: string): Task{
        const task: Task= { id: this.nextId++,title,done:false};
        this.tasks.push(task);
        return task;
    }
    findOne(id: number): Task | undefined {
  return this.tasks.find((task) => task.id === id);
}
markDone(id: number): Task | undefined {
  const task = this.findOne(id);
  if (task) {
    task.done = true;
  }
  return task;
}

}
