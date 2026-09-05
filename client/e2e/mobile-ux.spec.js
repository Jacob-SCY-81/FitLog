import { test, expect } from '@playwright/test';

test.describe('FitLog Phase 7: Mobile UX & Touch Controls E2E Tests', () => {
  test.use({
    viewport: { width: 390, height: 844 }, // iPhone 12/13/14 真实移动视口
    hasTouch: true,
  });

  test('真实移动视口下单手快捷加减步进、组间休息全屏与常驻浮条无缝切换、开练全闭环', async ({ page }) => {
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

    // 2. 导航进入新建训练
    await page.goto('/workouts/new');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1:has-text("训练记录")')).toBeVisible();

    // 3. 添加一个动作
    await page.locator('button:has-text("+ 动作")').click();
    const modal = page.locator('div.fixed:has-text("添加动作")');
    await expect(modal).toBeVisible();

    // 选择首个动作
    const firstAdd = modal.locator('button:has-text("+")').first();
    await expect(firstAdd).toBeVisible({ timeout: 5000 });
    await firstAdd.click();
    await expect(modal).not.toBeVisible({ timeout: 3000 });

    // 4. 测试快捷步进微调药丸
    // 点击组号 1 展开快捷步进栏
    const setNumBtn = page.locator('button[title="点击展开快捷微调"]').first();
    await expect(setNumBtn).toBeVisible();
    await setNumBtn.click();

    // 验证快捷微调药丸展示并点击 +2.5 步进
    const plus25Btn = page.locator('button:has-text("+2.5")');
    await expect(plus25Btn).toBeVisible({ timeout: 5000 });
    await plus25Btn.click();

    // 再次点击 +5 步进
    const plus5Btn = page.locator('button:has-text("+5")');
    await plus5Btn.click();

    // 断言重量输入框的值变为 7.5
    const weightInput = page.locator('input[inputMode="decimal"]').first();
    await expect(weightInput).toHaveValue('7.5');

    // 点击次数 +1 步进
    const plus1RepBtn = page.locator('button:has-text("+1")');
    await plus1RepBtn.click();
    const repsInput = page.locator('input[inputMode="numeric"]').first();
    await expect(repsInput).toHaveValue('1');

    // 5. 点击完成该组 (打钩)
    const checkBtn = page.locator('button:has-text("⬜")').first();
    await checkBtn.click();

    // 6. 验证全屏组间休息计时器弹出
    const fullTimer = page.locator('[data-testid="full-rest-timer"]');
    await expect(fullTimer).toBeVisible({ timeout: 5000 });

    // 测试快捷加时 +30s
    const add30Btn = fullTimer.locator('button:has-text("+30 秒")');
    if (await add30Btn.isVisible()) {
      await add30Btn.click();
    }

    // 点击最小化为底部浮条
    const minimizeBtn = fullTimer.locator('button:has-text("最小化")');
    await minimizeBtn.click();

    // 验证全屏计时器收起，底部浮动计时器出现
    await expect(fullTimer).not.toBeVisible();
    const floatingTimer = page.locator('[data-testid="floating-rest-timer"]');
    await expect(floatingTimer).toBeVisible({ timeout: 5000 });

    // 测试浮动条上的“跳过”按钮
    const skipBtn = floatingTimer.locator('button:has-text("跳过")');
    await skipBtn.click();
    await expect(floatingTimer).not.toBeVisible({ timeout: 3000 });

    // 7. 点击“完成训练”并成功提交
    const submitBtn = page.locator('button:has-text("完成训练")');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // 验证成功跳转至历史记录页
    await page.waitForURL('**/workouts', { timeout: 10000 });
    await expect(page.locator('h1:has-text("训练历史")')).toBeVisible();
  });

  test('移动端离线网络状态感知 (Offline / Online) 与提示胶囊自愈', async ({ page, context }) => {
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

    // 2. 模拟断网 (Offline)
    await context.setOffline(true);

    // 触发浏览器的 offline 事件
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });

    // 3. 验证离线感知指示胶囊展示
    const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
    await expect(offlineIndicator).toBeVisible({ timeout: 5000 });
    await expect(offlineIndicator).toContainText('离线模式');

    // 4. 恢复网络连接 (Online)
    await context.setOffline(false);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });

    // 5. 验证胶囊切换为恢复提示
    await expect(offlineIndicator).toContainText('网络已恢复连接', { timeout: 5000 });
  });
});
