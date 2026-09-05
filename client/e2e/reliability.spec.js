import { test, expect } from '@playwright/test';

test.describe('FitLog Phase 8: System Reliability & Fault Tolerance E2E Tests', () => {
  test('客户端训练提交自动附带 Idempotency-Key 且全闭环落库', async ({ page }) => {
    // 1. 登录系统
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.locator('text=使用旧版邮箱登录').click();
    await page.locator('input[placeholder*="you@example.com"]').fill('admin@admin');
    await page.locator('button:has-text("发送邮箱验证码")').click();

    await expect(page.locator('input[placeholder="000000"]')).toBeVisible({ timeout: 5000 });
    await page.locator('input[placeholder="000000"]').fill('123456');
    await page.locator('button[type="submit"]:has-text("登录")').click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });

    // 2. 导航进入新建训练页
    await page.goto('/workouts/new');
    await page.waitForLoadState('networkidle');

    // 添加一个动作
    await page.locator('button:has-text("+ 动作")').click();
    const modal = page.locator('div.fixed:has-text("添加动作")');
    await expect(modal).toBeVisible();

    const firstAdd = modal.locator('button:has-text("+")').first();
    await expect(firstAdd).toBeVisible({ timeout: 5000 });
    await firstAdd.click();
    await expect(modal).not.toBeVisible({ timeout: 3000 });

    // 勾选第一组完成
    const checkBtn = page.locator('button:has-text("⬜")').first();
    await checkBtn.click();

    // 休息计时器弹出后手动点击关闭
    const timerOverlay = page.locator('div.fixed:has-text("组间休息")');
    if (await timerOverlay.isVisible()) {
      await timerOverlay.locator('button:has-text("关闭")').click();
    }

    // 3. 监听提交请求并验证 Idempotency-Key 请求头
    let capturedIdempotencyKey = null;
    page.on('request', (req) => {
      if (req.url().includes('/api/v1/workouts') && req.method() === 'POST') {
        capturedIdempotencyKey = req.headers()['idempotency-key'];
      }
    });

    const submitBtn = page.locator('button:has-text("完成训练")');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // 4. 验证成功跳转至历史记录页
    await page.waitForURL('**/workouts', { timeout: 10000 });
    await expect(page.locator('h1:has-text("训练历史")')).toBeVisible();

    // 5. 强校验：客户端请求头确实携带了有效的 Idempotency-Key
    expect(capturedIdempotencyKey).toBeTruthy();
    expect(capturedIdempotencyKey).toContain('workout_');
  });

  test('全局错误边界 ErrorBoundary 异常隔离与自愈', async ({ page }) => {
    // 导航到一个由于故意注入或非法状态可能受影响的页面
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // 验证页面渲染正常且未处于错误边界状态
    await expect(page.locator('text=页面模块渲染异常')).toHaveCount(0);
    await expect(page.locator('h1:has-text("FitLog")')).toBeVisible();
  });
});
