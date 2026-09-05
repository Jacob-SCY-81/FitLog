import { useState, useEffect } from 'react';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    let timer = null;

    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setShowRestored(false);
      }, 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
      if (timer) clearTimeout(timer);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (isOnline && !showRestored) {
    return null;
  }

  return (
    <div
      data-testid="offline-indicator"
      className="fixed top-0 inset-x-0 z-50 pointer-events-none flex justify-center px-4 pt-2 transition-all duration-300 ease-in-out"
    >
      <div
        className={`pointer-events-auto max-w-md w-full px-4 py-2.5 rounded-xl shadow-xl flex items-center justify-between text-xs font-medium backdrop-blur-md transition-all ${
          !isOnline
            ? 'bg-amber-950/90 border border-amber-600/40 text-amber-200'
            : 'bg-emerald-950/90 border border-emerald-600/40 text-emerald-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{!isOnline ? '⚡' : '✓'}</span>
          <span>
            {!isOnline
              ? '当前处于离线模式，训练草稿保留在本地，可正常记录'
              : '网络已恢复连接'}
          </span>
        </div>
        {!isOnline && (
          <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
            Offline
          </span>
        )}
      </div>
    </div>
  );
}
