import { Message } from './types';

// 定义任务池接口
interface TaskPoolItem {
  id: string;
  task: Message;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  assignedTo?: 'A' | 'B' | 'C' | 'D';
  timestamp: number;
  retries: number;
}

// ANP (Async Named Pipe) 任务池系统 - 服务端版本
class ANPBus {
  private listeners: Map<string, Array<(msg: Message) => void>> = new Map();
  private taskPool: Map<string, TaskPoolItem> = new Map(); // 任务池
  private readonly MAX_RETRIES = 3;

  constructor() {
    console.log('[ANP Bus] 任务池系统已启动');
  }

  /**
   * 发布消息到总线
   */
  async emit(msg: Message): Promise<void> {
    // 将消息添加到任务池
    const poolId = `pool_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const task: TaskPoolItem = {
      id: poolId,
      task: msg,
      status: 'pending',
      timestamp: Date.now(),
      retries: 0
    };

    this.taskPool.set(poolId, task);

    // 通知对应的监听器
    const listenerKey = `${msg.from}→${msg.to}`;
    const wildcardListeners = this.listeners.get('*') || [];

    const specificListeners = this.listeners.get(listenerKey) || [];

    // 执行所有匹配的监听器
    const allListeners = [...specificListeners, ...wildcardListeners];

    for (const listener of allListeners) {
      try {
        await Promise.resolve(listener(msg));
      } catch (error) {
        console.error(`Error in listener for ${listenerKey}:`, error);
      }
    }
  }

  /**
   * 订阅消息
   */
  on(event: string, callback: (msg: Message) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * 取消订阅
   */
  off(event: string, callback: (msg: Message) => void): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 获取指定Agent的任务
   */
  peekTasksForAgent(agent: 'A' | 'B' | 'C' | 'D', limit: number = 10): TaskPoolItem[] {
    const tasks: TaskPoolItem[] = [];

    for (const task of this.taskPool.values()) {
      if (task.status === 'pending' && task.task.to === agent) {
        tasks.push(task);
        if (tasks.length >= limit) {
          break;
        }
      }
    }

    return tasks;
  }

  /**
   * 标记任务完成
   */
  completeTask(taskId: string): boolean {
    const task = this.taskPool.get(taskId);
    if (task) {
      task.status = 'completed';
      this.taskPool.set(taskId, task);
      return true;
    }
    return false;
  }

  /**
   * 获取总线统计
   */
  getStats() {
    const stats = {
      totalTasks: this.taskPool.size,
      queueSizes: {
        A: 0,
        B: 0,
        C: 0,
        D: 0
      },
      processingTasks: 0
    };

    for (const task of this.taskPool.values()) {
      if (task.status === 'processing') {
        stats.processingTasks++;
      }

      if (task.task.to in stats.queueSizes) {
        stats.queueSizes[task.task.to as keyof typeof stats.queueSizes]++;
      }
    }

    return stats;
  }
}

export const anpBus = new ANPBus();