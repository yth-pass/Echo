/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ErrorBoundary — 捕获子组件运行时错误，展示可读错误信息而非黑屏。
 * React class component（Hooks 不支持 getDerivedStateFromError / componentDidCatch）。
 */

import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { COPY } from '../copy';

interface Props {
  children: ReactNode;
  /** 可选：自定义 fallback 渲染 */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 开发环境打印到控制台
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <div className="min-h-screen bg-echo-dark flex flex-col items-center justify-center p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
            <span className="text-red-400 text-xl">!</span>
          </div>
          <h2 className="text-lg font-bold text-white mb-2">页面渲染出错</h2>
          <p className="text-sm text-gray-500 mb-4 max-w-xs">
            {this.state.error.message || '组件加载时发生了未知错误'}
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="px-6 py-2.5 rounded-xl bg-echo-blue/10 border border-echo-blue/30 text-echo-blue text-sm font-bold hover:bg-echo-blue/20 transition-colors"
          >
            {COPY.btn.tryAgain}
          </button>
          {import.meta.env.DEV && (
            <pre className="mt-4 p-3 rounded-lg bg-white/5 text-[10px] text-gray-600 max-w-md overflow-auto text-left">
              {this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
