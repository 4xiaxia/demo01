import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

interface MerchantGuardProps {
  children: React.ReactNode;
}

export const MerchantGuard = ({ children }: MerchantGuardProps) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const merchantParam = searchParams.get("merchant");
  const isValidParam = !!(merchantParam && /^[a-zA-Z0-9_-]+$/.test(merchantParam));

  useEffect(() => {
    if (!isValidParam) {
      // 如果没有商户参数或参数无效，重定向到带test参数的URL
      navigate("/chat?merchant=test", { replace: true });
    }
  }, [isValidParam, navigate]);

  if (!isValidParam) {
    // 参数还在验证中或已启动重定向，显示加载状态
    return (
      <div className="flex h-full items-center justify-center text-white/50 animate-pulse">
        验证访问权限中...
      </div>
    );
  }

  // 参数有效，渲染子组件
  return <>{children}</>;
};
