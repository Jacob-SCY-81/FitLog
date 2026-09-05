import { test, expect } from '@playwright/test';

test.describe('FitLog Phase 5: Body Measurements & Multi-metric Analytics E2E Tests', () => {
  test('身体围度新建、最新看板回显、多维趋势图表切换、记录在线编辑与删除全闭环', async ({ page }) => {
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

    // 2. 导航至身体数据页面
    await page.goto('/measurements');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1:has-text("身体数据")')).toBeVisible();

    // 3. 点击“+ 记录”弹出表单
    await page.locator('button:has-text("+ 记录")').click();
    const modal = page.locator('[data-testid="measurement-modal"]');
    await expect(modal).toBeVisible();

    // 4. 填写身体测量指标
    const testNotes = `Phase5_备注_${Date.now()}`;
    const testWeight = '76.8';
    const testBodyFat = '16.5';
    const testWaist = '83.5';
    const testChest = '103.0';

    await modal.locator('input[placeholder="0.0"]').nth(0).fill(testWeight); // 体重
    await modal.locator('input[placeholder="0.0"]').nth(1).fill(testBodyFat); // 体脂率
    await modal.locator('input[placeholder="0.0"]').nth(2).fill(testWaist); // 腰围
    await modal.locator('input[placeholder="0.0"]').nth(3).fill(testChest); // 胸围
    await modal.locator('textarea').fill(testNotes);

    await modal.locator('button[type="submit"]:has-text("保存记录")').click();
    await expect(modal).toHaveCount(0);

    // 5. 验证最新看板展示
    await expect(page.locator('text=最新体征看板')).toBeVisible();
    await expect(page.getByText(`${testWeight} kg`, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(`${testBodyFat}%`, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(`${testWaist} cm`, { exact: true }).first()).toBeVisible();

    // 6. 验证多维趋势图表切换
    await expect(page.locator('text=体重趋势 (kg)')).toBeVisible();

    // 切换到体脂率趋势
    await page.locator('button:has-text("体脂率")').first().click();
    await expect(page.locator('text=体脂率趋势 (%)')).toBeVisible();

    // 切换到腰围趋势
    await page.locator('button:has-text("腰围")').first().click();
    await expect(page.locator('text=腰围趋势 (cm)')).toBeVisible();

    // 7. 测试在线编辑单条记录
    const firstRow = page.locator(`div.bg-gray-900:has-text("${testNotes}")`).first();
    await expect(firstRow).toBeVisible();
    await firstRow.locator('button:has-text("编辑")').click();

    // 验证编辑弹窗标题
    await expect(page.locator('h2:has-text("编辑身体数据")')).toBeVisible();
    const editModal = page.locator('[data-testid="measurement-modal"]');

    // 修改体重为 75.2kg
    const editedWeight = '75.2';
    await editModal.locator('input[placeholder="0.0"]').nth(0).fill(editedWeight);
    await editModal.locator('button[type="submit"]:has-text("保存修改")').click();
    await expect(editModal).toHaveCount(0);

    // 验证看板与列表即时刷新
    await expect(page.getByText(`${editedWeight} kg`, { exact: true }).first()).toBeVisible();

    // 8. 测试安全删除该记录
    const updatedRow = page.locator(`div.bg-gray-900:has-text("${testNotes}")`).first();
    await updatedRow.locator('button:has-text("删除")').click();
    await expect(page.locator('text=确认删除身体记录？')).toBeVisible();
    await page.locator('button:has-text("确认删除")').click();
    await page.waitForTimeout(600);

    // 验证记录已彻底移除
    await expect(page.locator(`text=${testNotes}`)).toHaveCount(0);
  });
});
