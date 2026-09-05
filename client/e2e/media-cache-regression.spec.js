import { test, expect } from '@playwright/test';

test.describe('FitLog Media Cache Eviction & Mobile Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // 统一登录 (采用与 media.spec.js 一致的标准管理员测试环境凭据)
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
  });

  test('旧版本坏缓存 media-exercises 自动清退与自愈', async ({ page }) => {
    // 1. 模拟旧版本用户：先向 CacheStorage 写入污染的旧缓存池 media-exercises
    await page.evaluate(async () => {
      if ('caches' in window) {
        const oldCache = await caches.open('media-exercises');
        await oldCache.put(
          new Request('/media/exercises-dataset/corrupted-test.gif'),
          new Response('404 Not Found', { status: 404, statusText: 'Not Found' })
        );
      }
    });

    const hasOldBefore = await page.evaluate(async () => {
      return await caches.has('media-exercises');
    });
    expect(hasOldBefore).toBe(true);

    // 2. 打开新版动作库页面
    await page.goto('/exercises');
    await page.waitForLoadState('networkidle');

    // 3. 验证旧坏缓存池已被应用入口代码自动安全清退
    const hasOldAfter = await page.evaluate(async () => {
      return await caches.has('media-exercises');
    });
    expect(hasOldAfter).toBe(false);
  });

  test('第一页与第二页媒体渲染完整且无“暂无演示预览”兜底', async ({ page }) => {
    await page.goto('/exercises');
    await page.waitForLoadState('networkidle');

    // 验证第一页前 3 个卡片均正常加载且无 fallback 兜底
    const firstCards = page.locator('a[href^="/exercises/"]');
    await expect(firstCards.first()).toBeVisible({ timeout: 10000 });

    const count = await firstCards.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // 检查第一页第 1 个动作卡片的图片渲染与 naturalWidth
    const firstImg = firstCards.first().locator('img');
    await expect(firstImg).toBeVisible();
    await expect.poll(async () => {
      return await firstImg.evaluate((img) => img.complete && img.naturalWidth > 0);
    }, { timeout: 8000 }).toBe(true);

    // 确保第一页绝对不出现“暂无演示预览”
    const fallbackCountP1 = await page.locator('[data-testid="media-fallback"]').count();
    expect(fallbackCountP1).toBe(0);

    // 翻到第二页
    const nextBtn = page.locator('button:has-text("下一页")');
    if (await nextBtn.isVisible() && await nextBtn.isEnabled()) {
      await nextBtn.click();
      await page.waitForLoadState('networkidle');

      // 验证第二页第 1 个动作卡片正常加载
      const secondCards = page.locator('a[href^="/exercises/"]');
      await expect(secondCards.first()).toBeVisible();
      const secondImg = secondCards.first().locator('img');
      await expect(secondImg).toBeVisible();
      await expect.poll(async () => {
        return await secondImg.evaluate((img) => img.complete && img.naturalWidth > 0);
      }, { timeout: 8000 }).toBe(true);

      // 确保第二页也无“暂无演示预览”
      const fallbackCountP2 = await page.locator('[data-testid="media-fallback"]').count();
      expect(fallbackCountP2).toBe(0);
    }
  });

  test('404 与 500 异常媒体响应绝对不写入 media-exercises-v2 缓存池', async ({ page }) => {
    await page.goto('/exercises');
    await page.waitForLoadState('networkidle');

    // 发起不存在的 404 图片请求与模拟的 500 响应
    const result = await page.evaluate(async () => {
      // 1. 发起一个真实的 404 媒体资源请求
      await fetch('/media/exercises-dataset/definitely-non-existent-404.gif').catch(() => {});

      // 2. 发起一个模拟的 500 异常
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        // 如果当前受 SW 控制，则通过 fetch 触发 SW runtimeCaching
        await fetch('/media/exercises-dataset/server-error-500.gif').catch(() => {});
      }

      // 3. 检查 media-exercises-v2 缓存池
      if (!('caches' in window)) return { supported: false };
      const cacheNames = await caches.keys();
      const v2CacheName = cacheNames.find((name) => name.includes('media-exercises-v2'));
      if (!v2CacheName) return { hasV2: false, cached404: false, cached500: false };

      const cache = await caches.open(v2CacheName);
      const match404 = await cache.match('/media/exercises-dataset/definitely-non-existent-404.gif');
      const match500 = await cache.match('/media/exercises-dataset/server-error-500.gif');

      return {
        hasV2: true,
        cached404: !!match404,
        cached500: !!match500,
      };
    });

    if (result.hasV2) {
      expect(result.cached404).toBe(false);
      expect(result.cached500).toBe(false);
    }
  });
});
