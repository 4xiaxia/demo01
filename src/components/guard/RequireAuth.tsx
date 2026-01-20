import { Navigate, useLocation, useParams } from "react-router-dom";

/**
 * 后台鉴权守卫
 *
 * 验证逻辑：
 * 1. 检查是否已登录（localStorage.isAuthenticated）
 * 2. 检查登录的商家编码是否与当前访问的商家匹配
 *
 * 设计理念：每个商家只能访问自己的"房间"
 */
export const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { merchantId } = useParams<{ merchantId: string }>();

  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
  const loggedInMerchant = localStorage.getItem("merchantId");

  // 未登录 → 跳转到登录页（带上商家编码）
  if (!isAuthenticated) {
    const loginUrl = merchantId ? `/login?merchant=${merchantId}` : "/login";
    return <Navigate to={loginUrl} state={{ from: location }} replace />;
  }

  // 已登录但商家编码不匹配 → 跳转到正确商家的登录页
  // 防止 dongli 登录后尝试访问 /merchant/xicun
  if (merchantId && loggedInMerchant && merchantId !== loggedInMerchant) {
    console.warn(`[RequireAuth] 权限不匹配: 登录的是 ${loggedInMerchant}，试图访问 ${merchantId}`);
    return <Navigate to={`/login?merchant=${merchantId}`} state={{ from: location }} replace />;
  }

  return children;
};
