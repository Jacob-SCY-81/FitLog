import { useState, useEffect } from 'react';

export default function ExerciseAnimation({ images, className = '', alt = '', intervalMs = 1500, ...props }) {
  const [showSecond, setShowSecond] = useState(false);

  useEffect(() => {
    if (!images || images.length < 2) return;
    if (images[0] && images[0].endsWith('.gif')) return; // Native animation
    const timer = setInterval(() => setShowSecond(prev => !prev), intervalMs);
    return () => clearInterval(timer);
  }, [images, intervalMs]);

  // No images — placeholder
  if (!images || images.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-gray-800 ${className}`}>
        <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  // Single image — plain img
  if (images.length === 1) {
    return (
      <img
        src={images[0]}
        alt={alt}
        className={className}
        loading="lazy"
        onError={(e) => { e.target.style.display = 'none'; }}
        {...props}
      />
    );
  }

  // Two images — alternating animation
  const currentSrc = showSecond ? images[1] : images[0];

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      loading="lazy"
      onError={(e) => { e.target.style.display = 'none'; }}
      {...props}
    />
  );
}

// Hook version for components that want to control the animation themselves
export function useAnimationToggle(intervalMs = 1500) {
  const [showSecond, setShowSecond] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setShowSecond(prev => !prev);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return showSecond;
}
