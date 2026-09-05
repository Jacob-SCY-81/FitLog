import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logFilePath = path.join(__dirname, '..', '..', 'scratch', 'dev-sms-e2e.log');

// 辅助函数：从日志文件中等待并获取指定手机号最新发送的验证码
async function getLatestCodeForPhone(phone, timeoutMs = 8000) {
  const start = Date.now();
  const normalized = phone.startsWith('+86') ? phone : `+86${phone}`;

  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(logFilePath)) {
      const content = fs.readFileSync(logFilePath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (line.startsWith(normalized + ':')) {
          return line.split(':')[1].trim();
        }
      }
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timeout waiting for verification code for phone ${phone}`);
}

test.describe('FitLog Phase 2.3: Phone Authentication E2E Tests', () => {
  test.beforeAll(() => {
    // 确保日志文件存在并清空
    const dir = path.dirname(logFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(logFilePath, '');
  });

  test.afterAll(() => {
    try {
      execSync('node ../server/scripts/clean-e2e-data.js', { stdio: 'ignore' });
    } catch {
      // ignore clean error
    }
  });

  // ----------------------------------------------------
  // 场景 1：手机号登录与页面刷新 Session 重水合
  // ----------------------------------------------------
  test('场景 1: 默认手机号登录、获取验证码、登录成功并在页面刷新后保持 Session', async ({ page }) => {
    const testPhone = '13812345678';

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // 1. 验证默认展示手机号快捷登录
    await expect(page.locator('text=手机号快捷登录')).toBeVisible();
    await expect(page.locator('text=+86')).toBeVisible();
    await expect(page.locator('input[type="tel"]')).toBeVisible();
    await expect(page.locator('text=获取验证码')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('登录 / 注册');

    // 2. 输入手机号并点击获取验证码
    await page.locator('input[type="tel"]').fill(testPhone);
    await page.locator('button:has-text("获取验证码")').click();

    // 3. 验证进入倒计时
    await expect(page.locator('button:has-text("后重试")')).toBeVisible({ timeout: 5000 });

    // 4. 从 DEV 日志捕获 6 位验证码并填入
    const code = await getLatestCodeForPhone(testPhone);
    expect(code).toHaveLength(6);
    await page.locator('input[placeholder="6位验证码"]').fill(code);

    // 5. 点击登录 / 注册
    await page.locator('button[type="submit"]').click();

    // 6. 验证成功进入主界面 (导航条或训练记录页可见)
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });

    // 7. 刷新页面验证 Session 重水合 (不弹回 /login)
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/login/);
  });

  // ----------------------------------------------------
  // 场景 2：次级入口 Email 登录回归测试
  // ----------------------------------------------------
  test('场景 2: 切换到邮箱登录入口，使用邮箱验证码正常登录', async ({ page }) => {
    await page.goto('/profile');
    // 如果处于登录态先退出
    const logoutBtn = page.locator('button:has-text("退出登录")');
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await page.waitForURL(/\/login/);
    } else {
      await page.goto('/login');
    }

    // 1. 点击切换为邮箱登录
    await page.locator('text=使用旧版邮箱登录').click();
    await expect(page.locator('text=邮箱验证码登录')).toBeVisible();
    await expect(page.locator('input[placeholder*="you@example.com"]')).toBeVisible();

    // 2. 输入管理员邮箱 admin@admin
    await page.locator('input[placeholder*="you@example.com"]').fill('admin@admin');
    await page.locator('button:has-text("发送邮箱验证码")').click();

    // 3. 进入验证码输入步骤
    await expect(page.locator('input[placeholder="000000"]')).toBeVisible({ timeout: 5000 });

    // 4. 输入管理员万能码 123456
    await page.locator('input[placeholder="000000"]').fill('123456');
    await page.locator('button[type="submit"]:has-text("登录")').click();

    // 5. 验证成功登录进入主页
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
  });

  // ----------------------------------------------------
  // 场景 3：老用户绑定手机号与绑定后手机号登录
  // ----------------------------------------------------
  test('场景 3: 老用户登录后在 Profile 页面绑定手机号，退出后可使用手机号登录', async ({ page }) => {
    const bindPhone = '13888886666';

    // 1. 确保以老用户 admin@admin 登录并进入个人中心
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/login')) {
      await page.locator('text=使用旧版邮箱登录').click();
      await page.locator('input[placeholder*="you@example.com"]').fill('admin@admin');
      await page.locator('button:has-text("发送邮箱验证码")').click();
      await expect(page.locator('input[placeholder="000000"]')).toBeVisible({ timeout: 5000 });
      await page.locator('input[placeholder="000000"]').fill('123456');
      await page.locator('button[type="submit"]:has-text("登录")').click();
      await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
      await page.goto('/profile');
      await page.waitForLoadState('networkidle');
    }

    // 2. 点击“绑定手机号”
    await page.locator('button:has-text("绑定手机号")').click();
    await expect(page.locator('text=绑定中国大陆手机号')).toBeVisible();

    // 3. 输入待绑定手机号并获取验证码
    await page.request.post('http://localhost:3000/api/v1/auth/test/clear-rate-limit');
    fs.writeFileSync(logFilePath, '');
    await page.locator('div[role="dialog"], .fixed input[type="tel"]').fill(bindPhone);
    await page.locator('button:has-text("获取验证码")').click();

    // 4. 获取验证码并填入
    const code = await getLatestCodeForPhone(bindPhone);
    expect(code).toHaveLength(6);
    await page.locator('div[role="dialog"], .fixed input[placeholder="6位验证码"]').fill(code);

    // 5. 提交绑定
    await page.locator('button:has-text("确认绑定")').click();
    await expect(page.locator('text=手机号绑定成功')).toBeVisible({ timeout: 5000 });

    // 6. 验证资料页展示已绑定状态
    await expect(page.locator('text=已绑定')).toBeVisible({ timeout: 5000 });

    // 7. 退出登录
    await page.locator('button:has-text("退出登录")').click();
    await page.waitForURL(/\/login/);

    // 8. 清除限流冷却，使用刚绑定的手机号在默认登录页登录
    await page.request.post('http://localhost:3000/api/v1/auth/test/clear-rate-limit');
    fs.writeFileSync(logFilePath, '');
    await page.locator('input[type="tel"]').fill(bindPhone);
    await page.locator('button:has-text("获取验证码")').click();
    const loginCode = await getLatestCodeForPhone(bindPhone);
    await page.locator('input[placeholder="6位验证码"]').fill(loginCode);
    await page.locator('button[type="submit"]').click();

    // 9. 验证登录成功进入主系统
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });

    // 10. 进入 Profile 确认账户为 admin@admin (User.id 与历史邮箱数据保持完好)
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=admin@admin').first()).toBeVisible();
  });
});
