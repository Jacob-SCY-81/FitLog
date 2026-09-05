import { test, expect } from '@playwright/test';

test.describe('FitLog Phase 6: Template Duplication & Favorites Integration E2E Tests', () => {
  test('模板一键复制(深拷贝)与拉起开练完整闭环', async ({ page }) => {
    // 1. 登录系统
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

    // 2. 导航进入模板管理页
    await page.goto('/templates');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1:has-text("训练模板")')).toBeVisible();

    // 3. 点击“+ 新建模板”
    const testSuffix = Date.now().toString().slice(-4);
    const originName = `深拷贝源_${testSuffix}`;
    const copyName = `${originName} (副本)`;

    await page.locator('button:has-text("+ 新建模板")').click();
    const modal = page.locator('div.fixed:has-text("新建训练模板")');
    await expect(modal).toBeVisible();

    await modal.locator('input[placeholder="例如：推拉腿 Day 1"]').fill(originName);
    await modal.locator('textarea[placeholder*="训练要点"]').fill('Phase 6 测试备注');

    // 添加动作
    await modal.locator('button:has-text("+ 添加动作")').click();
    const picker = modal.locator('div.absolute:has-text("选择动作")');
    await expect(picker).toBeVisible();

    // 验证收藏过滤 Tab 渲染正常
    await expect(picker.locator('button:has-text("全部动作")')).toBeVisible();
    await expect(picker.locator('button:has-text("仅看收藏")')).toBeVisible();

    // 选择第一个可用动作
    const firstAddBtn = picker.locator('button:has-text("+")').first();
    await expect(firstAddBtn).toBeVisible({ timeout: 5000 });
    await firstAddBtn.click();

    // 保存模板
    await modal.locator('button:has-text("创建模板")').click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // 4. 在列表中找到刚刚创建的模板卡片
    const originCard = page.locator('div.bg-gray-900').filter({ hasText: originName }).first();
    await expect(originCard).toBeVisible({ timeout: 5000 });

    // 5. 点击卡片上的“复制”按钮
    const duplicateBtn = originCard.locator('button:has-text("复制")');
    await expect(duplicateBtn).toBeVisible();
    await duplicateBtn.click();

    // 6. 验证副本模板生成并呈现在列表中
    const copyCard = page.locator('div.bg-gray-900').filter({ hasText: copyName }).first();
    await expect(copyCard).toBeVisible({ timeout: 8000 });

    // 7. 测试对副本模板点击“开始训练”
    const startWorkoutBtn = copyCard.locator('button:has-text("开始训练")');
    await startWorkoutBtn.click();

    // 应跳转到记录页面且加载了模板
    await page.waitForURL('**/workouts/new', { timeout: 8000 });
    await page.waitForLoadState('networkidle');
    await expect(page.locator('button:has-text("完成训练")')).toBeVisible({ timeout: 8000 });

    // 8. 返回模板页清理测试数据
    await page.goto('/templates');
    await page.waitForLoadState('networkidle');

    // 删除副本
    const copyCardDel = page.locator('div.bg-gray-900').filter({ hasText: copyName }).first();
    if (await copyCardDel.isVisible()) {
      await copyCardDel.locator('button:has-text("删除")').click();
      const confirmModal = page.locator('div.fixed:has-text("确认删除")');
      await expect(confirmModal).toBeVisible();
      await confirmModal.locator('button:has-text("确认删除")').click();
      await expect(page.locator('div.bg-gray-900').filter({ hasText: copyName })).toHaveCount(0, { timeout: 5000 });
    }

    // 删除源模板
    const originCardDel = page.locator('div.bg-gray-900').filter({ hasText: originName }).first();
    if (await originCardDel.isVisible()) {
      await originCardDel.locator('button:has-text("删除")').click();
      const confirmModal = page.locator('div.fixed:has-text("确认删除")');
      await expect(confirmModal).toBeVisible();
      await confirmModal.locator('button:has-text("确认删除")').click();
      await expect(page.locator('div.bg-gray-900').filter({ hasText: originName })).toHaveCount(0, { timeout: 5000 });
    }
  });

  test('模板动作选择器中联动收藏夹筛选与快捷添加', async ({ page }) => {
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

    // 2. 进入动作库先确保至少有一个收藏动作
    await page.goto('/exercises');
    await page.waitForLoadState('networkidle');

    // 找到第一个未收藏的心形按钮进行收藏
    const addFavBtn = page.locator('button[title="收藏"]').first();
    if (await addFavBtn.isVisible({ timeout: 4000 })) {
      await addFavBtn.click();
      await page.waitForTimeout(600);
    }

    // 3. 导航到模板页并打开新建弹窗
    await page.goto('/templates');
    await page.waitForLoadState('networkidle');
    await page.locator('button:has-text("+ 新建模板")').click();

    const modal = page.locator('div.fixed:has-text("新建训练模板")');
    await expect(modal).toBeVisible();

    // 4. 打开动作选择器
    await modal.locator('button:has-text("+ 添加动作")').click();
    const picker = modal.locator('div.absolute:has-text("选择动作")');
    await expect(picker).toBeVisible();

    // 5. 点击“❤️ 仅看收藏”筛选胶囊
    const favTab = picker.locator('button:has-text("仅看收藏")');
    await expect(favTab).toBeVisible();
    await favTab.click();

    // 验证列表中动作均带有 ❤️ 标识
    const favExBtn = picker.locator('button:has-text("+")').first();
    await expect(favExBtn).toBeVisible({ timeout: 5000 });
    await expect(picker.locator('text=❤️').first()).toBeVisible();

    // 6. 点击添加该收藏动作
    await favExBtn.click();

    // 验证成功加入到模板动作列表
    await expect(picker).not.toBeVisible({ timeout: 3000 });
    await expect(modal.locator('text=目标组数')).toBeVisible();

    // 关闭弹窗取消创建
    await modal.locator('button:has-text("✕")').first().click();
    await expect(modal).not.toBeVisible();
  });
});
