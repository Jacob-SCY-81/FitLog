import { test, expect } from '@playwright/test';

test.describe('FitLog Phase 3.2: Workout Templates CRUD & Sets Planning E2E Tests', () => {
  test('训练模板创建、编辑微调、拉起训练会话与安全删除全流程', async ({ page }) => {
    // 1. 登录系统
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // 切换到旧版邮箱登录
    await page.locator('text=使用旧版邮箱登录').click();
    await expect(page.locator('text=邮箱验证码登录')).toBeVisible();
    await page.locator('input[placeholder*="you@example.com"]').fill('admin@admin');
    await page.locator('button:has-text("发送邮箱验证码")').click();

    // 输入验证码登录
    await expect(page.locator('input[placeholder="000000"]')).toBeVisible({ timeout: 5000 });
    await page.locator('input[placeholder="000000"]').fill('123456');
    await page.locator('button[type="submit"]:has-text("登录")').click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });

    // 2. 导航进入模板管理页
    await page.goto('/templates');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1:has-text("训练模板")')).toBeVisible();

    // 3. 点击“+ 新建模板”
    const createBtn = page.locator('button:has-text("+ 新建模板")');
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // 4. 在新建弹窗中填入数据
    const modal = page.locator('div.fixed:has-text("新建训练模板")');
    await expect(modal).toBeVisible();

    const tplName = `E2E测试模板_${Date.now().toString().slice(-4)}`;
    await modal.locator('input[placeholder="例如：推拉腿 Day 1"]').fill(tplName);
    await modal.locator('textarea[placeholder*="训练要点"]').fill('E2E初始模板备注');

    // 点击“+ 添加动作”打开选择器
    await modal.locator('button:has-text("+ 添加动作")').click();
    const picker = modal.locator('div.absolute:has-text("选择动作")');
    await expect(picker).toBeVisible();

    // 搜索“推”并选择首个动作
    const searchInput = picker.locator('input[placeholder="搜索动作..."]');
    await searchInput.fill('推');
    await page.waitForTimeout(400);
    const firstOption = picker.locator('button:has-text("+")').first();
    await expect(firstOption).toBeVisible({ timeout: 5000 });
    await firstOption.click();

    // 选择器关闭，检查动作已加入列表
    await expect(picker).not.toBeVisible({ timeout: 3000 });
    await expect(modal.locator('text=目标组数')).toBeVisible();

    // 调整目标组数和参考重量
    const setsInput = modal.locator('input[type="number"]').nth(0);
    await setsInput.fill('4');
    const weightInput = modal.locator('input[type="number"]').nth(2);
    await weightInput.fill('65');

    // 点击创建模板
    await modal.locator('button:has-text("创建模板")').click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // 5. 验证模板出现在列表中
    const tplCard = page.locator(`text=${tplName}`).first();
    await expect(tplCard).toBeVisible({ timeout: 8000 });

    // 6. 点击“编辑”按钮打开编辑弹窗
    const cardContainer = page.locator('div.bg-gray-900', { hasText: tplName });
    const editBtn = cardContainer.locator('button:has-text("编辑")');
    await editBtn.click();

    const editModal = page.locator('div.fixed:has-text("编辑训练模板")');
    await expect(editModal).toBeVisible({ timeout: 5000 });

    // 修改模板名称
    const updatedTplName = `${tplName}_已更新`;
    const nameInput = editModal.locator('input[placeholder="例如：推拉腿 Day 1"]');
    await nameInput.fill(updatedTplName);

    // 保存修改
    await editModal.locator('button:has-text("保存修改")').click();
    await expect(editModal).not.toBeVisible({ timeout: 5000 });

    // 验证列表中名称更新
    await expect(page.locator(`text=${updatedTplName}`).first()).toBeVisible({ timeout: 8000 });

    // 7. 点击“开始训练”一键拉起
    const updatedCard = page.locator('div.bg-gray-900', { hasText: updatedTplName });
    await updatedCard.locator('button:has-text("开始训练")').click();

    // 验证跳转进入记录器，且预设已导入
    await page.waitForURL('**/workouts/new', { timeout: 8000 });
    await page.waitForLoadState('networkidle');
    await expect(page.locator('button:has-text("完成训练")')).toBeVisible();

    // 8. 重新回到 /templates 页面执行清理
    await page.goto('/templates');
    await page.waitForLoadState('networkidle');

    // 9. 点击“删除”按钮并二次确认
    const deleteCard = page.locator('div.bg-gray-900', { hasText: updatedTplName });
    await deleteCard.locator('button:has-text("删除")').click();

    const confirmModal = page.locator('div.fixed:has-text("确认删除")');
    await expect(confirmModal).toBeVisible({ timeout: 5000 });
    await confirmModal.locator('button:has-text("确认删除")').click();
    await expect(confirmModal).not.toBeVisible({ timeout: 5000 });

    // 10. 验证模板已被完全移除
    await expect(page.locator(`text=${updatedTplName}`)).toHaveCount(0);
  });
});
