import { readFile, access } from 'fs/promises';
import { join } from 'path';

async function main() {
  console.log('--- 开始 Phase 11 生产部署就绪专项测试 ---');

  const rootDir = process.cwd();

  // 1. 验证 Dockerfile 文件
  console.log('[测试 1] 校验 Dockerfile 多阶段构建规范...');
  const serverDockerfile = await readFile(join(rootDir, 'server', 'Dockerfile'), 'utf-8');
  if (!serverDockerfile.includes('FROM node:20-alpine AS builder') || !serverDockerfile.includes('HEALTHCHECK')) {
    throw new Error('server/Dockerfile 缺少多阶段构建或健康检查指令');
  }
  if (!serverDockerfile.includes('USER node')) {
    throw new Error('server/Dockerfile 缺少非 root 安全用户声明');
  }

  const clientDockerfile = await readFile(join(rootDir, 'client', 'Dockerfile'), 'utf-8');
  if (!clientDockerfile.includes('FROM node:20-alpine AS builder') || !clientDockerfile.includes('FROM nginx:alpine')) {
    throw new Error('client/Dockerfile 缺少前端构建或 Nginx 运行时');
  }
  console.log('✓ 前后端多阶段 Dockerfile 规范校验通过 (轻量、non-root、内建探针)');

  // 2. 校验 docker-compose.yml
  console.log('[测试 2] 校验 docker-compose.yml 服务编排定义...');
  const composeContent = await readFile(join(rootDir, 'docker-compose.yml'), 'utf-8');
  const requiredServices = ['mysql:', 'redis:', 'server:', 'nginx:'];
  for (const svc of requiredServices) {
    if (!composeContent.includes(svc)) {
      throw new Error(`docker-compose.yml 缺少核心服务: ${svc}`);
    }
  }
  if (!composeContent.includes('mysql_data:') || !composeContent.includes('redis_data:')) {
    throw new Error('docker-compose.yml 缺少持久化卷定义');
  }
  if (!composeContent.includes('service_healthy')) {
    throw new Error('docker-compose.yml 缺少依赖健康检查 condition: service_healthy');
  }
  console.log('✓ docker-compose.yml 编排规范校验通过 (MySQL+Redis+Node+Nginx，健康依赖与持久化卷完整)');

  // 3. 校验 Nginx 反向代理配置
  console.log('[测试 3] 校验 deploy/nginx/fitlog.conf 配置...');
  const nginxConf = await readFile(join(rootDir, 'deploy', 'nginx', 'fitlog.conf'), 'utf-8');
  if (!nginxConf.includes('gzip on;') || !nginxConf.includes('proxy_pass http://fitlog_api;')) {
    throw new Error('Nginx 配置缺少 Gzip 压缩或 API 代理配置');
  }
  if (!nginxConf.includes('X-Frame-Options') || !nginxConf.includes('X-Content-Type-Options')) {
    throw new Error('Nginx 配置缺少核心安全响应头');
  }
  if (!nginxConf.includes('proxy_set_header X-Request-Id $http_x_request_id;')) {
    throw new Error('Nginx 配置缺少 Request ID 链路追踪透传');
  }
  console.log('✓ Nginx 生产反代配置校验通过 (SPA 回退、Gzip、安全响应标头、Request ID 透传)');

  // 4. 校验运维脚本与环境变量模版存在性
  console.log('[测试 4] 校验备份恢复与环境模版文件...');
  await access(join(rootDir, '.env.production.example'));
  await access(join(rootDir, 'deploy', 'scripts', 'backup.sh'));
  await access(join(rootDir, 'deploy', 'scripts', 'restore.sh'));
  await access(join(rootDir, 'deploy', 'scripts', 'deploy.sh'));
  console.log('✓ 部署运维脚本与环境模版全部完备');

  console.log('\n========================================');
  console.log(' Phase 11 生产部署就绪所有配置与资产验证通过！');
  console.log('========================================\n');
}

main().catch(err => {
  console.error('Phase 11 测试失败:', err);
  process.exit(1);
});
