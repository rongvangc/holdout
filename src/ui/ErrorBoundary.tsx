import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * A crashed render should not be a dead end.
 *
 * The game keeps the last six game-hours in IndexedDB, so a blank screen after an
 * exception would look like lost work. This catches the error, says what happened
 * in plain words, and offers a reload — the save is already there to continue.
 */
export function CrashScreen({ message, onReload }: { message?: string; onReload: () => void }) {
  return (
    <div className="crash" role="alert">
      <div className="crash-inner">
        <b>Giao diện gặp lỗi.</b>
        <p>
          Tiến độ đã được lưu tới lần tự lưu gần nhất (mỗi 6 giờ trong game). Tải lại trang rồi chọn
          “Tiếp tục” là chơi tiếp được.
        </p>
        {message && <pre className="crash-msg">{message}</pre>}
        <button className="primary" onClick={onReload}>
          Tải lại trang
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('HOLDOUT crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <CrashScreen message={String(this.state.error.message).slice(0, 300)} onReload={() => location.reload()} />;
    }
    return this.props.children;
  }
}
