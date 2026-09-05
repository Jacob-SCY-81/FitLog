import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logFile = path.resolve(__dirname, '../../scratch/dev-sms-e2e.log');

test.describe('FitLog Phase 3.1: Exercise Library & Custom Exercise CRUD E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // 确保开发日志文件清空
    try {
      if (fs.existsSync(logFile)) {
        fs.writeFileSync(logFile, '');
      }
    } catch {
      // ignore
    }
  });

  test('动作库浏览、筛选、自定义动作创建、编辑与删除全流程', async ({ page }) => {
    // 1. 登录用户 (使用老用户快捷通道)
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // 切换到旧版邮箱登录
    await page.locator('text=使用旧版邮箱登录').click();
    await expect(page.locator('text=邮箱验证码登录')).toBeVisible();
    await page.locator('input[placeholder*="you@example.com"]').fill('admin@admin');
    await page.locator('button:has-text("发送邮箱验证码")').click();

    // 等待并输入验证码
    await expect(page.locator('input[placeholder="000000"]')).toBeVisible({ timeout: 5000 });
    await page.locator('input[placeholder="000000"]').fill('123456');
    await page.locator('button[type="submit"]:has-text("登录")').click();

    // 等待登录成功跳转到首页
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });

    // 2. 导航进入动作库
    await page.goto('/exercises');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1:has-text("动作库")')).toBeVisible();

    // 3. 点击“+ 自定义”按钮
    const createBtn = page.locator('button:has-text("+ 自定义")');
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // 弹出创建弹窗，限定在弹窗内部操作
    const createModal = page.locator('div.fixed:has-text("新建自定义动作")');
    await expect(createModal).toBeVisible();

    const customName = `E2E测试动作_${Date.now().toString().slice(-4)}`;
    await createModal.locator('input[placeholder="如：弹力带侧平举"]').fill(customName);
    await createModal.locator('select').selectOption('chest');
    await createModal.locator('input[placeholder="如：弹力带、哑铃、自重"]').fill('哑铃');

    // 提交创建并等待弹窗消失
    await createModal.locator('button[type="submit"]:has-text("创建")').click();
    await expect(createModal).not.toBeVisible({ timeout: 5000 });

    // 4. 在搜索栏中搜索刚创建的自定义动作
    await page.waitForLoadState('networkidle');
    const searchInput = page.locator('input[placeholder*="搜索动作名称"]');
    await searchInput.fill(customName);
    await page.waitForTimeout(500);

    // 验证自定义动作出现在搜索结果中
    const customCard = page.locator(`text=${customName}`).first();
    await expect(customCard).toBeVisible({ timeout: 8000 });

    // 5. 点击进入详情页
    await customCard.click();
    await page.waitForURL('**/exercises/**', { timeout: 8000 });
    await expect(page.locator(`h1:has-text("${customName}")`)).toBeVisible();

    // 6. 验证存在编辑和删除按钮
    const editBtn = page.locator('button:has-text("编辑")');
    const deleteBtn = page.locator('button:has-text("删除")');
    await expect(editBtn).toBeVisible();
    await expect(deleteBtn).toBeVisible();

    // 7. 点击编辑，限定在编辑弹窗内修改备注
    await editBtn.click();
    const editModal = page.locator('div.fixed:has-text("编辑自定义动作")');
    await expect(editModal).toBeVisible();
    await editModal.locator('textarea[placeholder="动作细节或注意点"]').fill('E2E测试备注更新');
    await editModal.locator('button[type="submit"]:has-text("保存修改")').click();
    await expect(editModal).not.toBeVisible({ timeout: 5000 });

    // 8. 验证页面更新
    await expect(page.locator('text=E2E测试备注更新')).toBeVisible();

    // 9. 点击删除自定义动作
    await deleteBtn.click();
    // 弹出确认框
    const confirmModal = page.locator('div.fixed:has-text("确认删除")');
    await expect(confirmModal).toBeVisible();
    await confirmModal.locator('button:has-text("确认删除")').click();
    await expect(confirmModal).not.toBeVisible({ timeout: 5000 });

    // 10. 验证跳转回动作库，且该动作已被移除
    await page.waitForURL('**/exercises', { timeout: 8000 });
    await page.waitForLoadState('networkidle');
    await searchInput.fill(customName);
    await page.waitForTimeout(500);
    await expect(page.locator(`text=${customName}`)).toHaveCount(0);
  });
});
