/**
 * 服务端ANP Bus - 异步命名管道总线
 *
 * 核心设计：
 * 1. 中央任务池 - 所有任务都丢这里
 * 2. Agent轮询模式 - 各Agent自己从池子取任务
 * 3. 全局广播 - 支持bus.on('*')监听所有消息
 *
 * 按照原始设计：
 * - 池子是黑板，Agent是临时工
 * - 临时工自己看黑板有没有活
 */

import EventEmitter from "events";
import type { Message } from "./types";

interface TaskPoolItem {
  id: string;
  task: Message;
  status: "pending" | "processing" | "completed" | "failed";
  assignedTo: string | null;
  createdAt: Date;
  retries: number;
}

class ANPBus extends EventEmitter {
  private taskPool: Map<string, TaskPoolItem> = new Map();
  private maxRetries = 3;

  constructor() {
    super();
    console.log("[ANP Bus] 任务池系统已启动");
  }

  /**
   * 发送消息到池子
   */
  /**
   * 发送消息到池子
   */
  async publish(task: Message): Promise<string> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const poolItem: TaskPoolItem = {
      id: taskId,
      task,
      status: "pending",
      assignedTo: null,
      createdAt: new Date(),
      retries: 0,
    };

    this.taskPool.set(taskId, poolItem);

    // 广播消息（D用来监控）
    super.emit("*", task);
    super.emit(`${task.from}→${task.to}`, task);

    // 特殊处理：如果是给USER的，直接通知不入池
    if (task.to === "USER") {
      super.emit("B→USER", task);
      this.taskPool.delete(taskId);
    }

    return taskId;
  }

  /**
   * Agent查看池子里有没有自己的任务（不取走）
   */
  peekTasksForAgent(agentName: string, limit: number = 10): TaskPoolItem[] {
    const tasks: TaskPoolItem[] = [];

    for (const [, item] of this.taskPool) {
      if (item.task.to === agentName && item.status === "pending") {
        tasks.push(item);
        if (tasks.length >= limit) break;
      }
    }

    return tasks;
  }

  /**
   * Agent从池子取走任务开始处理
   */
  claimTask(taskId: string, agentName: string): TaskPoolItem | null {
    const item = this.taskPool.get(taskId);

    if (!item || item.status !== "pending") {
      return null;
    }

    item.status = "processing";
    item.assignedTo = agentName;
    this.taskPool.set(taskId, item);

    return item;
  }

  /**
   * 任务完成
   */
  completeTask(taskId: string): void {
    const item = this.taskPool.get(taskId);
    if (item) {
      item.status = "completed";
      this.taskPool.set(taskId, item);

      // 完成的任务5秒后清理
      setTimeout(() => {
        this.taskPool.delete(taskId);
      }, 5000);
    }
  }

  /**
   * 任务失败
   */
  failTask(taskId: string): void {
    const item = this.taskPool.get(taskId);
    if (!item) return;

    if (item.retries < this.maxRetries) {
      // 重试：重新标记为pending
      item.status = "pending";
      item.assignedTo = null;
      item.retries += 1;
      this.taskPool.set(taskId, item);
    } else {
      // 超过重试次数，标记为失败
      item.status = "failed";
      this.taskPool.set(taskId, item);

      // 失败的任务5秒后清理
      setTimeout(() => {
        this.taskPool.delete(taskId);
      }, 5000);
    }
  }

  /**
   * 获取池子状态（用于监控）
   */
  getPoolStatus() {
    const status = {
      total: this.taskPool.size,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    for (const [, item] of this.taskPool) {
      status[item.status] += 1;
    }

    return status;
  }
}

export const anpBus = new ANPBus();
