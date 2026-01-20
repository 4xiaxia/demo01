import { useOutletContext, useParams } from "react-router-dom";

interface MerchantContext {
  merchantId: string;
}

/**
 * 获取当前商家编码的 Hook
 *
 * 使用方式：
 * ```tsx
 * const merchantId = useMerchantId();
 * ```
 *
 * 获取商家编码的优先级：
 * 1. 从路由参数获取 (useParams)
 * 2. 从 Outlet context 获取 (AdminLayout 传递)
 * 3. 从 localStorage 获取 (登录时保存)
 * 4. 默认返回 'dongli'
 */
export function useMerchantId(): string {
  // 尝试从路由参数获取
  const { merchantId: paramMerchantId } = useParams<{ merchantId: string }>();

  // 尝试从 Outlet context 获取
  let contextMerchantId: string | undefined;
  try {
    const context = useOutletContext<MerchantContext>();
    contextMerchantId = context?.merchantId;
  } catch {
    // 不在 Outlet 内部，忽略
  }

  // 优先级: 路由参数 > context > localStorage > 默认值
  const merchantId =
    paramMerchantId || contextMerchantId || localStorage.getItem("merchantId") || "dongli";

  return merchantId;
}

/**
 * 获取当前商家的 API 基础路径
 *
 * 使用方式：
 * ```tsx
 * const apiBase = useMerchantApiBase();
 * // apiBase = '/api/merchant/dongli'
 * ```
 */
export function useMerchantApiBase(): string {
  const merchantId = useMerchantId();
  return `/api/merchant/${merchantId}`;
}
