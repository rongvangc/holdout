import type { ReactNode } from 'react';

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;

  return (
    <section className="sheet" role="dialog" aria-modal="true" aria-label={title}>
      <header className="sheet-head">
        <span className="label">{title}</span>
        <button type="button" onClick={onClose} aria-label={`Đóng ${title}`}>
          Đóng
        </button>
      </header>
      <div className="sheet-body">{children}</div>
    </section>
  );
}
