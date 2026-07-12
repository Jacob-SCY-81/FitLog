import { useNavigate } from 'react-router-dom';

export default function EmptyState({ icon = '📋', title, description, actionLabel, actionTo }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-2 text-center px-4">
      <span className="text-4xl mb-2">{icon}</span>
      <p className="text-lg font-medium text-gray-300">{title}</p>
      {description && <p className="text-sm text-gray-500 max-w-xs">{description}</p>}
      {actionLabel && actionTo && (
        <button
          onClick={() => navigate(actionTo)}
          className="mt-3 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold text-sm transition-colors"
          style={{ minHeight: '44px' }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
