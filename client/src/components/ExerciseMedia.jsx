import { useState, useEffect, useRef } from 'react';

/**
 * 判断是否为视频 URL
 */
function isVideoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /\.(mp4|webm|mov|ogg)(\?.*)?$/i.test(url);
}

/**
 * FitLog 通用动作媒体展示组件
 * 支持:
 * 1. 视频 (.mp4, .webm) 原生静音循环播放
 * 2. 动图 (.gif) 原生动效播放
 * 3. 多帧交替动画 (两张及以上图片自动来回切换)
 * 4. 静态单图
 * 5. 加载中脉冲骨架屏 (Skeleton)
 * 6. 加载失败 / 空数据优雅兜底 (Graceful Fallback)
 * 7. 点击放大全屏预览入口 (Expand / Lightbox)
 */
export default function ExerciseMedia({
  src,
  images = [],
  alt = '动作演示',
  className = '',
  intervalMs = 1500,
  onExpand,
  showExpandBtn = false,
  ...props
}) {
  // 综合解析当前所有可用源
  const mediaList = images && images.length > 0 ? images : (src ? [src] : []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef(null);

  // 多图交替播放计时器 (非视频、且第一帧非动图时启用双帧交替)
  useEffect(() => {
    if (mediaList.length < 2) return;
    const firstMedia = mediaList[0];
    if (isVideoUrl(firstMedia) || (typeof firstMedia === 'string' && firstMedia.endsWith('.gif'))) {
      return;
    }
    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % mediaList.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [mediaList, intervalMs]);

  // 当 mediaList 变更时重置状态
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
    setCurrentIndex(0);
  }, [src, JSON.stringify(images)]);

  // 移动端缓存秒读即时完成检测 (防止从 Memory/Disk Cache 加载时不触发 onLoad 事件)
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete) {
      if (imgRef.current.naturalWidth > 0) {
        setIsLoaded(true);
      }
    }
  }, [currentIndex, src, JSON.stringify(images)]);

  // 1. 无媒体资源或加载出错：优雅降级兜底 UI
  if (mediaList.length === 0 || hasError) {
    return (
      <div
        data-testid="media-fallback"
        className={`flex flex-col items-center justify-center bg-gray-800/80 text-gray-500 select-none ${className}`}
      >
        <svg className="w-8 h-8 sm:w-10 sm:h-10 text-gray-600 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <span className="text-[11px] sm:text-xs text-gray-400">暂无演示预览</span>
      </div>
    );
  }

  const currentMedia = mediaList[currentIndex] || mediaList[0];
  const isVideo = isVideoUrl(currentMedia);

  return (
    <div className={`relative overflow-hidden bg-gray-900 group ${className}`}>
      {/* 2. 加载骨架屏 (Skeleton) */}
      {!isLoaded && (
        <div
          data-testid="media-skeleton"
          className="absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center"
        >
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
        </div>
      )}

      {/* 3. 视频流播放 */}
      {isVideo ? (
        <video
          data-testid="media-video"
          src={currentMedia}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoadedData={() => setIsLoaded(true)}
          onError={() => {
            setHasError(true);
            setIsLoaded(true);
          }}
          {...props}
        />
      ) : (
        /* 4. 图像 / 动图渲染 */
        <img
          ref={imgRef}
          data-testid="media-image"
          src={currentMedia}
          alt={alt}
          loading="lazy"
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setIsLoaded(true)}
          onError={() => {
            setHasError(true);
            setIsLoaded(true);
          }}
          {...props}
        />
      )}

      {/* 5. 多图索引小指示器 */}
      {mediaList.length > 1 && isLoaded && (
        <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-xs rounded text-[10px] text-gray-300 pointer-events-none">
          {currentIndex + 1} / {mediaList.length}
        </div>
      )}

      {/* 6. 全屏放大预览入口 (Mobile Lightbox Entry) */}
      {onExpand && (
        <button
          type="button"
          data-testid="media-expand-btn"
          onClick={(e) => {
            e.stopPropagation();
            onExpand({ mediaList, currentIndex, isVideo });
          }}
          aria-label="放大全屏预览动作演示"
          className={`absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white/80 hover:text-white hover:bg-black/75
                     transition-all duration-150 backdrop-blur-xs ${
                       showExpandBtn ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
                     }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      )}
    </div>
  );
}
