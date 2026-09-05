import { useState, useEffect } from 'react';

/**
 * 判断是否为视频 URL
 */
function isVideoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /\.(mp4|webm|mov|ogg)(\?.*)?$/i.test(url);
}

/**
 * 移动端/沉浸式全屏动作媒体画廊弹窗 (Lightbox)
 */
export default function ExerciseMediaLightbox({
  isOpen,
  onClose,
  title = '动作演示',
  mediaList = [],
  initialIndex = 0,
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // 同步外部初始索引
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, isOpen]);

  // 键盘快捷键与滚动锁定
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && mediaList.length > 1) {
        setCurrentIndex(prev => (prev - 1 + mediaList.length) % mediaList.length);
      } else if (e.key === 'ArrowRight' && mediaList.length > 1) {
        setCurrentIndex(prev => (prev + 1) % mediaList.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, mediaList.length, onClose]);

  if (!isOpen || mediaList.length === 0) return null;

  const currentMedia = mediaList[currentIndex] || mediaList[0];
  const isVideo = isVideoUrl(currentMedia);

  return (
    <div
      data-testid="media-lightbox-modal"
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/95 backdrop-blur-md p-4 sm:p-6"
      onClick={onClose}
    >
      {/* 顶部工具栏 */}
      <div
        className="w-full max-w-4xl flex items-center justify-between text-white pb-3 border-b border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <h2 className="text-base sm:text-lg font-bold truncate">{title}</h2>
          {mediaList.length > 1 && (
            <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full ml-1 shrink-0">
              {currentIndex + 1} / {mediaList.length}
            </span>
          )}
        </div>
        <button
          type="button"
          data-testid="lightbox-close-btn"
          onClick={onClose}
          className="p-2 -mr-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          aria-label="关闭预览"
          style={{ minHeight: '44px', minWidth: '44px' }}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 中间大图/视频展示区 */}
      <div
        className="relative w-full max-w-4xl flex-1 flex items-center justify-center my-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideo ? (
          <video
            src={currentMedia}
            controls
            autoPlay
            loop
            playsInline
            className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl"
          />
        ) : (
          <img
            src={currentMedia}
            alt={title}
            className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl"
          />
        )}

        {/* 左右切换按钮 (针对多图) */}
        {mediaList.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setCurrentIndex(prev => (prev - 1 + mediaList.length) % mediaList.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur-xs transition-colors"
              aria-label="上一张"
              style={{ minHeight: '44px', minWidth: '44px' }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setCurrentIndex(prev => (prev + 1) % mediaList.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur-xs transition-colors"
              aria-label="下一张"
              style={{ minHeight: '44px', minWidth: '44px' }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* 底部缩略图导航 / 操作提示 */}
      <div
        className="w-full max-w-4xl flex items-center justify-center gap-2 pt-2 text-xs text-gray-400"
        onClick={(e) => e.stopPropagation()}
      >
        {mediaList.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto py-1">
            {mediaList.map((m, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                  idx === currentIndex ? 'border-emerald-500 scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
                style={{ minHeight: '44px', minWidth: '44px' }}
              >
                {isVideoUrl(m) ? (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center text-white text-[10px]">
                    视频
                  </div>
                ) : (
                  <img src={m} alt="" className="w-full h-full object-cover" />
                )}
              </button>
            ))}
          </div>
        ) : (
          <span>轻触背景或按 ESC 键退出全屏预览</span>
        )}
      </div>
    </div>
  );
}
