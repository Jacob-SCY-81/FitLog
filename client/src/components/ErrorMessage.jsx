export default function ErrorMessage({ message, onRetry, onBack }) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 px-4">
      <div className="text-3xl">😞</div>
      <p className="text-red-400 text-sm text-center">{message || '加载失败，请重试'}</p>
      <div className="flex gap-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
            style={{ minHeight: '44px' }}
          >
            重试
          </button>
        )}
        {onBack && (
          <button
            onClick={onBack}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
            style={{ minHeight: '44px' }}
          >
            返回
          </button>
        )}
      </div>
    </div>
  );
}
