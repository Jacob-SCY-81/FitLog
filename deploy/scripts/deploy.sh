#!/bin/sh
# ==========================================
# FitLog 生产环境一键自动化部署脚本
# ==========================================

set -e

echo "=== 开始执行 FitLog 生产部署 ==="

# 1. 拉取远端最新已发布代码
echo "[DEPLOY] 拉取最新 Git 代码 (origin/main)..."
git pull origin main

# 2. 检查环境变量文件
if [ ! -f ".env" ]; then
  echo "[DEPLOY] 错误: 未检测到 .env 配置文件，请从 .env.production.example 复制并填写！"
  exit 1
fi

# 3. 构建并拉起容器编排
echo "[DEPLOY] 正在拉取基础镜像并构建应用镜像..."
docker compose build --pull

echo "[DEPLOY] 启动容器编排服务..."
docker compose up -d

# 4. 等待数据库与后端就绪
echo "[DEPLOY] 等待后端服务与数据库连通就绪..."
ATTEMPTS=0
MAX_ATTEMPTS=20
until docker compose exec -T server curl -s http://localhost:3000/health/ready | grep -q '"status":"ready"'; do
  ATTEMPTS=$((ATTEMPTS+1))
  if [ $ATTEMPTS -ge $MAX_ATTEMPTS ]; then
    echo "[DEPLOY] 错误: 服务启动超时，未能在规定时间内就绪！"
    docker compose logs server
    exit 1
  fi
  echo "[DEPLOY] 等待服务健康就绪 ($ATTEMPTS/$MAX_ATTEMPTS)..."
  sleep 3
done

# 5. 执行生产数据库版本迁移 (严禁使用 db push)
echo "[DEPLOY] 执行 Prisma 生产数据库安全迁移..."
docker compose exec -T server npx prisma migrate deploy

echo "=== FitLog 生产部署成功！所有容器健康运转 ==="
docker compose ps
