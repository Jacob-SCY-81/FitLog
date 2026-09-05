import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[FitLog UI Error Boundary Caught]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh flex items-center justify-center bg-gray-950 text-white p-6">
          <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center shadow-2xl space-y-4">
            <div className="w-14 h-14 bg-red-950/80 border border-red-800/60 rounded-2xl flex items-center justify-center mx-auto text-2xl">
              ⚠️
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">页面模块渲染异常</h2>
              <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                FitLog 捕获到了偶发的视图异常，训练草稿与历史数据已完好保存在本地。
              </p>
            </div>
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-medium transition-colors"
                style={{ minHeight: '44px' }}
              >
                刷新页面
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-semibold transition-colors"
                style={{ minHeight: '44px' }}
              >
                返回首页
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
