export default function LoadingSpinner({ text = '加载中...' }) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}
