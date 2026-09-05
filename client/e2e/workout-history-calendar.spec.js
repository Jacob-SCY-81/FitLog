import { test, expect } from '@playwright/test';

test.describe('FitLog Phase 3.4: Workout History, Calendar & Detail Management E2E Tests', () => {
  test('历史列表分页、详情复盘、弹窗编辑备注、日历打卡与安全删除全流程', async ({ page }) => {
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

    // 2. 在录制器中生成一条测试训练
    await page.goto('/workouts/new');
    await page.waitForLoadState('networkidle');

    await page.locator('button:has-text("+ 动作")').click();
    const addModal = page.locator('div.fixed:has-text("添加动作")');
    await expect(addModal).toBeVisible();

    const searchInput = addModal.locator('input[placeholder="搜索动作..."]');
    await searchInput.fill('推');
    await page.waitForTimeout(400);
    const firstOption = addModal.locator('button:has-text("+")').first();
    await expect(firstOption).toBeVisible({ timeout: 5000 });
    await firstOption.click();
    await expect(addModal).not.toBeVisible({ timeout: 3000 });

    const testTag = `E2E日历历史_${Date.now().toString().slice(-4)}`;
    const row = page.locator('div.grid-cols-12').nth(1);
    await row.locator('input[inputmode="decimal"]').nth(0).fill('50');
    await row.locator('input[inputmode="numeric"]').fill('12');
    await row.locator('button:has-text("⬜")').click();

    // 关闭休息计时器
    const timerOverlay = page.locator('div.fixed:has-text("组间休息")');
    if (await timerOverlay.isVisible()) {
      await timerOverlay.locator('button:has-text("关闭")').click();
    }

    await page.locator('textarea[placeholder*="训练备注"]').fill(testTag);
    await page.locator('button:has-text("完成训练")').click();

    // 3. 验证历史记录列表页
    await page.waitForURL('**/workouts', { timeout: 8000 });
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1:has-text("训练历史")')).toBeVisible();

    const workoutLink = page.locator('a[href^="/workouts/"]', { hasText: testTag }).first();
    await expect(workoutLink).toBeVisible({ timeout: 8000 });

    // 4. 点击进入训练详情页
    await workoutLink.click();
    await page.waitForURL('**/workouts/**', { timeout: 8000 });
    await page.waitForLoadState('networkidle');
    await expect(page.locator(`text=${testTag}`)).toBeVisible();
    await expect(page.locator('text=总训练量')).toBeVisible();
    await expect(page.locator('text=600 kg')).toBeVisible(); // 50kg * 12reps = 600kg

    // 5. 点击详情页“编辑”按钮更新备注
    const editBtn = page.locator('button:has-text("编辑")');
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    const editModal = page.locator('div.fixed:has-text("编辑训练记录")');
    await expect(editModal).toBeVisible({ timeout: 5000 });

    const updatedTag = `${testTag}_已修改`;
    const notesInput = editModal.locator('textarea');
    await notesInput.fill(updatedTag);
    await editModal.locator('button:has-text("保存")').click();
    await expect(editModal).not.toBeVisible({ timeout: 5000 });

    // 验证详情页备注更新
    await expect(page.locator(`text=${updatedTag}`)).toBeVisible({ timeout: 5000 });

    // 6. 导航至训练日历页
    await page.goto('/calendar');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1:has-text("训练日历")')).toBeVisible();

    // 验证日历下方本月训练记录列表中包含更新后的训练
    await expect(page.locator('text=本月训练记录')).toBeVisible();
    await expect(page.locator('text=600 kg').first()).toBeVisible();

    // 7. 返回详情页并清理测试数据
    const workoutDetailUrl = page.url(); // 当前在 calendar
    await page.goto('/workouts');
    await page.waitForLoadState('networkidle');

    const updatedCard = page.locator('a[href^="/workouts/"]', { hasText: updatedTag }).first();
    await updatedCard.click();
    await page.waitForURL('**/workouts/**', { timeout: 8000 });

    const deleteBtn = page.locator('button:has-text("删除")');
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    const confirmModal = page.locator('div.fixed:has-text("确认删除")');
    await expect(confirmModal).toBeVisible({ timeout: 5000 });
    await confirmModal.locator('button:has-text("确认删除")').click();

    // 8. 验证彻底删除
    await page.waitForURL('**/workouts', { timeout: 8000 });
    await page.waitForLoadState('networkidle');
    await expect(page.locator(`text=${updatedTag}`)).toHaveCount(0);
  });
});
