import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

// 自动淘汰并清理旧版本损坏媒体缓存池 (实现旧用户无感自愈)
if (typeof window !== 'undefined' && 'caches' in window) {
  caches.delete('media-exercises').catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
