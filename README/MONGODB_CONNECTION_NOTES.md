# MongoDB 连接说明

## 📋 Zeabur 提供的连接信息

### 内部服务名 (Zeabur 平台内部使用)

```
主机名: service-696a0d772952d01a4bce4dfd
端口: 27017 (默认MongoDB端口)
用户名: mongo
密码: ylU753MuO0TNiez4fmsRY8t96o12CxKD
连接字符串: mongodb://mongo:ylU753MuO0TNiez4fmsRY8t96o12CxKD@service-696a0d772952d01a4bce4dfd:27017
```

**注意**: `service-696a0d772952d01a4bce4dfd` 是 Zeabur 的内部服务名，只能在 Zeabur 平台内部访问。

---

## 🔍 本地开发环境连接

如果您在本地开发环境运行服务器，需要使用**外部访问地址**。

### 可能的外部地址格式

```
mongodb://mongo:ylU753MuO0TNiez4fmsRY8t96o12CxKD@cgk1.clusters.zeabur.com:PORT
```

### 如何获取外部访问地址

1. 登录 Zeabur 控制台
2. 进入 MongoDB 服务
3. 查找 "外部访问" 或 "Public Access" 设置
4. 获取公网访问地址和端口

---

## 🚀 部署到 Zeabur

如果您将整个项目部署到 Zeabur 平台，那么可以使用内部服务名：

```env
MONGODB_URI=mongodb://mongo:ylU753MuO0TNiez4fmsRY8t96o12CxKD@service-696a0d772952d01a4bce4dfd:27017
```

这样在 Zeabur 平台内部，服务之间可以通过内部网络通信，速度更快。

---

## ✅ 当前配置

已更新 `.env` 文件为内部服务名：

```env
MONGODB_URI=mongodb://mongo:ylU753MuO0TNiez4fmsRY8t96o12CxKD@service-696a0d772952d01a4bce4dfd:27017
```

**如果本地测试失败**，请：

1. 检查 Zeabur 控制台获取外部访问地址
2. 更新`.env`文件使用外部地址
3. 重启服务器

---

## 📊 连接测试

### 预期成功日志

```
[Database] 初始化数据库服务...
[Database] ✅ MongoDB连接成功
[Database] 数据库: smart_guide
```

### 预期失败日志 (本地无法访问内部服务名)

```
[Database] MongoDB连接失败，将使用本地文件系统: MongoServerSelectionError
```

---

**创建时间**: 2026-01-16 23:24
