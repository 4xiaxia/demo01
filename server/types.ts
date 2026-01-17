/**
 * 服务端类型定义
 */

export interface Message {
  traceId: string;
  from: string;
  to: string;
  action: string;
  merchantId: string;
  userId: string;
  sessionId: string;
  timestamp: number;
  data: Record<string, unknown>;
}

export function createMessage(
  from: string,
  to: string,
  merchantId: string,
  userId: string,
  sessionId: string,
  action: string,
  data: Record<string, unknown>,
  traceId: string
): Message {
  return {
    traceId,
    from,
    to,
    action,
    merchantId,
    userId,
    sessionId,
    timestamp: Date.now(),
    data,
  };
}

export function createNotifyD(
  from: string,
  traceId: string,
  merchantId: string,
  userId: string,
  sessionId: string,
  action: string,
  data: Record<string, unknown>
): Message {
  return createMessage(from, "D", merchantId, userId, sessionId, action, data, traceId);
}
