import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SimpleChatPage } from "./views/chat/SimpleChatPage";
import { LoginPage } from "./views/auth/LoginPage";
import { RequireAuth } from "./components/guard/RequireAuth";
import { AdminLayout } from "./layouts/AdminLayout";
import DashboardPage from "./views/admin/DashboardPage";
import { ConfigGeneratorPage } from "./views/admin/ConfigGeneratorPage";
import { KnowledgePage } from "./views/admin/KnowledgePage";
import MonitorPage from "./views/admin/MonitorPage";
import { HotQuestionsPage } from "./views/admin/HotQuestionsPage";

function App() {
  // 前端不再初始化Agents，所有Agent都在服务端

  return (
    <BrowserRouter>
      <Routes>
        {/* 根路径重定向到dongli商户 */}
        <Route
          path="/"
          element={<Navigate to="/chat?merchant=dongli&userId=user_default&mode=text" replace />}
        />

        {/* 聊天页面 */}
        <Route path="/chat" element={<SimpleChatPage />} />

        {/* 登录页 */}
        <Route path="/login" element={<LoginPage />} />

        {/* 后台: 商家管理系统 (带鉴权，按商家编码隔离) */}
        {/* 访问格式: /merchant/dongli, /merchant/xicun 等 */}
        <Route
          path="/merchant/:merchantId"
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="knowledge" element={<KnowledgePage />} />
          <Route path="hot-questions" element={<HotQuestionsPage />} />
          <Route path="config" element={<ConfigGeneratorPage />} />
          <Route path="monitor" element={<MonitorPage />} />
        </Route>

        {/* 404 跳转 */}
        <Route
          path="*"
          element={<Navigate to="/chat?merchant=test&userId=user_default&mode=text" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
