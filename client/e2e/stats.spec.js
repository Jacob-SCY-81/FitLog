import { test, expect } from '@playwright/test';

test.describe('FitLog Phase 3.5: Training Analytics & Progression E2E Tests', () => {
  test('全局训练看板渲染、时间跨度筛选、容量走势与单动作力量曲线交互全覆盖', async ({ page }) => {
    // 1. 登录管理员
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.locator('text=使用旧版邮箱登录').click();
    await expect(page.locator('text=邮箱验证码登录')).toBeVisible();
    await page.locator('input[placeholder*="you@example.com"]').fill('admin@admin');
    await page.locator('button:has-text("发送邮箱验证码")').click();

    await expect(page.locator('input[placeholder="000000"]')).toBeVisible({ timeout: 5000 });
    await page.locator('input[placeholder="000000"]').fill('123456');
    await page.locator('button[type="submit"]:has-text("登录")').click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });

    // 2. 导航至数据统计页
    await page.goto('/stats');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1:has-text("数据统计")')).toBeVisible();

    // 3. 验证时间范围切换选择器存在
    await expect(page.locator('button:has-text("7天")')).toBeVisible();
    await expect(page.locator('button:has-text("30天")')).toBeVisible();
    await expect(page.locator('button:has-text("90天")')).toBeVisible();
    await expect(page.locator('button:has-text("180天")')).toBeVisible();

    // 4. 验证全局概览看板或空数据占位
    const hasDashboard = await page.locator('text=训练看板').isVisible();
    const hasEmptyState = await page.locator('text=还没有训练数据').isVisible();
    expect(hasDashboard || hasEmptyState).toBeTruthy();

    if (hasDashboard) {
      await expect(page.locator('text=总训练容量')).toBeVisible();
      await expect(page.locator('text=总训练次数')).toBeVisible();
      await expect(page.locator('text=累计训练时长')).toBeVisible();
      await expect(page.locator('text=总组数 / 次数')).toBeVisible();

      // 切换到 7 天范围
      await page.locator('button:has-text("7天")').click();
      await page.waitForTimeout(500);
      await expect(page.locator('text=总训练容量')).toBeVisible();

      // 切换到 90 天范围
      await page.locator('button:has-text("90天")').click();
      await page.waitForTimeout(500);

      // 5. 测试单动作展开分析（如果存在使用过的动作列表）
      const exerciseBtns = page.locator('[data-testid="exercise-buttons"] button');
      if (await exerciseBtns.count() > 0) {
        const firstExBtn = exerciseBtns.first();
        await firstExBtn.click();
        await page.waitForTimeout(600);

        // 验证 1RM 力量曲线卡片呈现
        await expect(page.locator('text=1RM 力量曲线')).toBeVisible();
        await expect(page.locator('text=平均组间休息')).toBeVisible();

        // 再次点击收起分析
        await page.locator('button:has-text("收起分析")').click();
        await expect(page.locator('text=1RM 力量曲线')).toHaveCount(0);
      }
    }
  });
});
