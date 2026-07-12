export default function ConfirmModal({ open, title, message, confirmText, onConfirm, onCancel, confirming }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-sm bg-gray-900 rounded-2xl p-6 space-y-4
                      border border-gray-800 text-center">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="text-sm text-gray-400">{message}</p>
        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium
                       transition-colors"
            style={{ minHeight: '44px' }}
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg
                       text-sm font-medium transition-colors"
            style={{ minHeight: '44px' }}
          >
            {confirming ? '处理中...' : confirmText || '确认'}
          </button>
        </div>
      </div>
    </div>
  );
}
