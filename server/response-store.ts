// 简单的内存存储，用于暂存Agent的回复以便前端轮询
export class ResponseStore {
  private responses = new Map<string, unknown>();
  private lastAccess = new Map<string, number>();

  // 保存回复
  save(traceId: string, data: unknown) {
    this.responses.set(traceId, data);
    this.lastAccess.set(traceId, Date.now());

    // 简单的清理逻辑
    if (this.responses.size > 1000) {
      this.cleanup();
    }
  }

  // 获取并删除回复（一次性读取）
  get(traceId: string) {
    const data = this.responses.get(traceId);
    if (data) {
      this.lastAccess.set(traceId, Date.now());
    }
    return data;
  }

  // 清理过期数据
  private cleanup() {
    const now = Date.now();
    for (const [key, time] of this.lastAccess) {
      if (now - time > 10 * 60 * 1000) {
        // 10分钟过期
        this.responses.delete(key);
        this.lastAccess.delete(key);
      }
    }
  }
}

export const responseStore = new ResponseStore();
