import { test, expect } from '@playwright/test';

test.describe('FitLog Phase 3.3: Workout Recorder & Dynamic Sets E2E Tests', () => {
  test('动态增组、类型选择、参数配置、打钩计时、提交历史与级联清理全闭环', async ({ page }) => {
    // 1. 登录用户
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

    // 2. 进入新建训练页面
    await page.goto('/workouts/new');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1:has-text("训练记录")')).toBeVisible();

    // 3. 点击“+ 动作”按钮添加动作
    await page.locator('button:has-text("+ 动作")').click();
    const modal = page.locator('div.fixed:has-text("添加动作")');
    await expect(modal).toBeVisible();

    // 搜索并选择动作
    const searchInput = modal.locator('input[placeholder="搜索动作..."]');
    await searchInput.fill('推');
    await page.waitForTimeout(400);

    const firstItem = modal.locator('button:has-text("+")').first();
    await expect(firstItem).toBeVisible({ timeout: 5000 });
    await firstItem.click();

    // 弹窗关闭，训练器渲染动作卡片
    await expect(modal).not.toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=+ 添加组')).toBeVisible();

    // 4. 配置第 1 组参数
    const firstSetRow = page.locator('div.grid-cols-12').nth(1); // 第0个是表头
    // 组类型选择
    await firstSetRow.locator('select').selectOption('warmup');
    // 重量 40
    await firstSetRow.locator('input[inputmode="decimal"]').nth(0).fill('40');
    // 次数 15
    await firstSetRow.locator('input[inputmode="numeric"]').fill('15');
    // RPE 7.0
    await firstSetRow.locator('input[inputmode="decimal"]').nth(1).fill('7.0');

    // 打钩完成第 1 组
    const completeBtn = firstSetRow.locator('button:has-text("⬜")');
    await completeBtn.click();

    // 5. 验证休息计时器弹出
    const timerOverlay = page.locator('div.fixed:has-text("组间休息")');
    await expect(timerOverlay).toBeVisible({ timeout: 5000 });
    // 手动关闭休息计时器
    await timerOverlay.locator('button:has-text("关闭")').click();
    await expect(timerOverlay).not.toBeVisible({ timeout: 3000 });

    // 6. 点击“+ 添加组”增加第 2 组
    await page.locator('button:has-text("+ 添加组")').click();
    const secondSetRow = page.locator('div.grid-cols-12').nth(2);
    await expect(secondSetRow).toBeVisible();

    // 配置第 2 组参数：标准组，80kg，10次
    await secondSetRow.locator('select').selectOption('standard');
    await secondSetRow.locator('input[inputmode="decimal"]').nth(0).fill('80');
    await secondSetRow.locator('input[inputmode="numeric"]').fill('10');
    await secondSetRow.locator('button:has-text("⬜")').click();

    // 关闭第二次休息计时器
    if (await timerOverlay.isVisible()) {
      await timerOverlay.locator('button:has-text("关闭")').click();
      await expect(timerOverlay).not.toBeVisible();
    }

    // 7. 填写训练备注
    const testNotes = `E2E测试训练_${Date.now().toString().slice(-4)}`;
    await page.locator('textarea[placeholder*="训练备注"]').fill(testNotes);

    // 8. 提交训练记录
    const submitBtn = page.locator('button:has-text("完成训练")');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // 验证跳转到历史记录列表
    await page.waitForURL('**/workouts', { timeout: 8000 });
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1:has-text("训练历史")')).toBeVisible();

    // 9. 验证新训练卡片展示
    const workoutCard = page.locator('a[href^="/workouts/"]', { hasText: testNotes }).first();
    await expect(workoutCard).toBeVisible({ timeout: 8000 });
    await expect(workoutCard.locator('text=2 组')).toBeVisible();

    // 10. 点击进入训练详情页
    await workoutCard.click();
    await page.waitForURL('**/workouts/**', { timeout: 8000 });
    await page.waitForLoadState('networkidle');
    await expect(page.locator(`text=${testNotes}`)).toBeVisible();

    // 11. 删除该训练记录以清理测试数据
    const deleteBtn = page.locator('button:has-text("删除")');
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    const confirmModal = page.locator('div.fixed:has-text("确认删除")');
    await expect(confirmModal).toBeVisible({ timeout: 5000 });
    await confirmModal.locator('button:has-text("确认删除")').click();

    // 12. 验证跳转回历史列表且已无该记录
    await page.waitForURL('**/workouts', { timeout: 8000 });
    await page.waitForLoadState('networkidle');
    await expect(page.locator(`text=${testNotes}`)).toHaveCount(0);
  });
});
