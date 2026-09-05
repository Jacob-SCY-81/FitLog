import { test, expect } from '@playwright/test';

test.describe('FitLog Phase 4: Exercise Media & Mobile Lightbox Preview E2E Tests', () => {
  test('动作库媒体渲染、全屏沉浸画廊(Lightbox)、自定义动作媒体配置与实时预览全闭环', async ({ page }) => {
    // 1. 登录管理员账号
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

    // 2. 导航至动作库，验证卡片缩略图渲染
    await page.goto('/exercises');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1:has-text("动作库")')).toBeVisible();

    // 验证至少渲染了一个动作卡片
    const firstCard = page.locator('a[href^="/exercises/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 5000 });

    // 3. 点击第一个动作进入详情页
    await firstCard.click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=目标肌群')).toBeVisible();

    // 验证媒体大图展示区存在
    const mediaContainer = page.locator('.aspect-\\[4\\/3\\]').first();
    await expect(mediaContainer).toBeVisible();

    // 4. 点击大图区域拉起全屏沉浸预览画廊 (Mobile Lightbox)
    await mediaContainer.click();
    const lightboxModal = page.locator('[data-testid="media-lightbox-modal"]');
    await expect(lightboxModal).toBeVisible({ timeout: 5000 });

    // 验证关闭按钮并点击退出全屏
    const closeBtn = page.locator('[data-testid="lightbox-close-btn"]');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(lightboxModal).toHaveCount(0);

    // 5. 测试自定义动作：带媒体链接创建与实时预览
    await page.goto('/exercises');
    await page.waitForLoadState('networkidle');
    await page.locator('button:has-text("+ 自定义")').click();
    const createModal = page.locator('div.fixed:has-text("新建自定义动作")');
    await expect(createModal).toBeVisible();

    const customName = `测试媒体动作_${Date.now()}`;
    await createModal.locator('input[placeholder="如：弹力带侧平举"]').fill(customName);
    await createModal.locator('select').selectOption('chest');

    // 填入媒体演示链接并验证实时预览卡片
    const mediaInput = createModal.locator('input[placeholder*="https://... 或 /media/..."]');
    await mediaInput.fill('/media/exercises-dataset/01qpYSe.gif');
    await expect(createModal.locator('text=媒体实时预览')).toBeVisible();

    // 提交创建
    await createModal.locator('button[type="submit"]:has-text("创建")').click();
    await expect(createModal).toHaveCount(0);

    // 6. 搜索并进入新建的自定义动作
    await page.locator('input[placeholder*="搜索动作"]').fill(customName);
    await page.waitForTimeout(600);

    const createdCard = page.locator(`a:has-text("${customName}")`).first();
    await expect(createdCard).toBeVisible({ timeout: 5000 });
    await createdCard.click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator(`h1:has-text("${customName}")`)).toBeVisible();

    // 7. 测试自定义动作编辑弹窗中的媒体修改
    await page.locator('button:has-text("编辑")').click();
    await expect(page.locator('h2:has-text("编辑自定义动作")')).toBeVisible();
    await expect(page.locator('text=媒体实时预览')).toBeVisible();

    // 修改为另一个动图并保存
    const editMediaInput = page.locator('input[placeholder*="https://... 或 /media/..."]');
    await editMediaInput.fill('/media/exercises-dataset/03lzqwk.gif');
    await page.locator('button[type="submit"]:has-text("保存修改")').click();
    await expect(page.locator('h2:has-text("编辑自定义动作")')).toHaveCount(0);

    // 8. 清理该测试动作，确保测试无残留
    await page.locator('button:has-text("删除")').click();
    await expect(page.locator('text=确认删除自定义动作？')).toBeVisible();
    await page.locator('button:has-text("确认删除")').click();
    await expect(page).toHaveURL(/\/exercises/, { timeout: 10000 });
  });
});
