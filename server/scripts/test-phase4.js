import { PrismaClient } from '@prisma/client';
import http from 'http';
import app from '../src/app.js';
import * as exerciseService from '../src/modules/exercise/exercise.service.js';
import { createExerciseSchema, updateExerciseSchema } from '../src/modules/exercise/exercise.validator.js';

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== FitLog Phase 4: 动作库媒体体验与安全体系全景测试 ===\n');

  let testUserA = null;
  let testUserB = null;
  let testExerciseA = null;
  let server = null;
  let baseUrl = '';

  try {
    // 0. 清理旧测试数据
    const oldUsers = await prisma.user.findMany({
      where: { email: { startsWith: 'phase4_media_test_' } },
      select: { id: true },
    });
    for (const u of oldUsers) {
      await prisma.exercise.deleteMany({ where: { createdById: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }

    // 1. 创建测试用户
    testUserA = await prisma.user.create({
      data: {
        email: `phase4_media_test_a_${Date.now()}@test.com`,
        nickname: 'Media Test User A',
      },
    });

    testUserB = await prisma.user.create({
      data: {
        email: `phase4_media_test_b_${Date.now()}@test.com`,
        nickname: 'Media Test User B',
      },
    });

    // --- 1. mediaUrl 安全校验规则 (Validator Unit Tests) ---
    console.log('--- 1. mediaUrl 安全校验规则测试 ---');

    // 拦截 javascript: XSS
    const xssResult = createExerciseSchema.safeParse({
      name: '恶意动作',
      targetMuscle: 'chest',
      mediaUrl: 'javascript:alert(1)',
    });
    assert(!xssResult.success, '成功拦截 javascript: 危险伪协议注入');

    // 拦截 data: 协议
    const dataUriResult = createExerciseSchema.safeParse({
      name: 'Data URI 动作',
      targetMuscle: 'chest',
      mediaUrl: 'data:text/html,<script>alert(1)</script>',
    });
    assert(!dataUriResult.success, '成功拦截 data:text/html 危险注入');

    // 拦截超长 URL (> 500 字符)
    const longUrlResult = createExerciseSchema.safeParse({
      name: '超长 URL 动作',
      targetMuscle: 'chest',
      mediaUrl: 'https://example.com/' + 'a'.repeat(510),
    });
    assert(!longUrlResult.success, '成功拦截超过 500 字符的畸形媒体链接');

    // 允许合法相对路径 (/media/...)
    const validRelative = createExerciseSchema.safeParse({
      name: '相对路径动作',
      targetMuscle: 'chest',
      mediaUrl: '/media/exercises-dataset/01qpYSe.gif',
    });
    assert(validRelative.success, '允许合法的站内相对路径 /media/exercises-dataset/...');

    // 允许合法绝对 HTTP/HTTPS URL
    const validHttp = createExerciseSchema.safeParse({
      name: '外部视频动作',
      targetMuscle: 'back',
      mediaUrl: 'https://cdn.example.com/exercises/lat-pulldown.mp4',
    });
    assert(validHttp.success, '允许合法的外部 HTTPS 视频/动图地址');

    // 允许空链接或省略
    const emptyMedia = createExerciseSchema.safeParse({
      name: '无图动作',
      targetMuscle: 'legs',
      mediaUrl: null,
    });
    assert(emptyMedia.success, '允许 mediaUrl 为 null');

    // --- 2. 自定义动作媒体创建与更新业务逻辑 (Service Tests) ---
    console.log('\n--- 2. 自定义动作媒体持久化与全生命周期测试 ---');

    // 创建带媒体链接的动作
    testExerciseA = await exerciseService.createExercise(
      {
        name: '哑铃上斜卧推(自编示范)',
        targetMuscle: 'chest',
        equipment: 'dumbbell',
        notes: '动作顶端挤压胸肌',
        mediaUrl: '/media/exercises-dataset/01qpYSe.gif',
      },
      testUserA.id
    );
    assert(testExerciseA.mediaUrl === '/media/exercises-dataset/01qpYSe.gif', '创建自定义动作时成功持久化 mediaUrl');

    // 查询验证
    const fetchedEx = await exerciseService.getExercise(testExerciseA.id, testUserA.id);
    assert(fetchedEx.mediaUrl === '/media/exercises-dataset/01qpYSe.gif', '查询动作详情准确返回 mediaUrl');

    // 更新为外部安全视频链接
    const updatedEx = await exerciseService.updateExercise(
      testExerciseA.id,
      {
        mediaUrl: 'https://cdn.example.com/videos/incline-press.mp4',
      },
      testUserA.id
    );
    assert(updatedEx.mediaUrl === 'https://cdn.example.com/videos/incline-press.mp4', '更新自定义动作成功修改 mediaUrl');

    // 清空媒体链接
    const clearedEx = await exerciseService.updateExercise(
      testExerciseA.id,
      {
        mediaUrl: null,
      },
      testUserA.id
    );
    assert(clearedEx.mediaUrl === null, '成功清空自定义动作 mediaUrl');

    // --- 3. 越权防护与官方动作防篡改测试 ---
    console.log('\n--- 3. 越权防护与官方动作防篡改测试 ---');

    // 用户 B 无法修改用户 A 动作的媒体
    let forbiddenCaught = false;
    try {
      await exerciseService.updateExercise(
        testExerciseA.id,
        { mediaUrl: '/media/exercises-dataset/03lzqwk.gif' },
        testUserB.id
      );
    } catch (err) {
      if (err.statusCode === 403) forbiddenCaught = true;
    }
    assert(forbiddenCaught, '非作者用户试图修改自定义动作媒体被严格拦截 (403 FORBIDDEN)');

    // 官方动作禁止篡改
    const officialEx = await prisma.exercise.findFirst({
      where: { isOfficial: true, deletedAt: null },
    });
    if (officialEx) {
      let officialModifyCaught = false;
      try {
        await exerciseService.updateExercise(
          officialEx.id,
          { mediaUrl: '/media/test.gif' },
          testUserA.id
        );
      } catch (err) {
        if (err.statusCode === 400 && err.errorCode === 'CANNOT_MODIFY_OFFICIAL') {
          officialModifyCaught = true;
        }
      }
      assert(officialModifyCaught, '官方动作媒体禁止任何用户篡改 (400 CANNOT_MODIFY_OFFICIAL)');
    }

    // --- 4. 静态媒体文件分发与 HTTP 缓存头验证 ---
    console.log('\n--- 4. 静态媒体文件分发与 HTTP 缓存策略验证 ---');

    // 启动本地 HTTP 实例
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    // 请求存在的动图 /media/exercises-dataset/01qpYSe.gif
    const mediaRes = await fetch(`${baseUrl}/media/exercises-dataset/01qpYSe.gif`);
    assert(mediaRes.status === 200, '静态媒体文件接口正确分发真实存在的 GIF 资源 (HTTP 200)');
    
    const contentType = mediaRes.headers.get('content-type') || '';
    assert(contentType.includes('image/gif'), `媒体响应头包含正确的 Content-Type (实际: ${contentType})`);

    const cacheControl = mediaRes.headers.get('cache-control') || '';
    assert(
      cacheControl.includes('max-age') || cacheControl.includes('public'),
      `媒体响应头设置了客户端与代理长期缓存 (实际 Cache-Control: ${cacheControl})`
    );

    // 请求不存在的媒体资源
    const notFoundRes = await fetch(`${baseUrl}/media/exercises-dataset/non-existent-image-404.gif`);
    assert(notFoundRes.status === 404, '请求不存在的媒体资源返回标准 404，无服务内部崩溃');

  } catch (error) {
    console.error('测试执行发生未捕获异常:', error);
    failed++;
  } finally {
    // 清理资源
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (testExerciseA) {
      await prisma.exercise.deleteMany({ where: { id: testExerciseA.id } });
    }
    if (testUserA) {
      await prisma.user.deleteMany({ where: { id: testUserA.id } });
    }
    if (testUserB) {
      await prisma.user.deleteMany({ where: { id: testUserB.id } });
    }
    await prisma.$disconnect();

    console.log('\n========================================');
    console.log(`Phase 4 媒体与安全体系测试汇总: 通过 ${passed}, 失败 ${failed}`);
    console.log('========================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  }
}

runTests();
