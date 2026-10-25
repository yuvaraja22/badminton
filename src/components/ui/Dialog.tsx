import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** Native <dialog>: a bottom sheet on phones, a centered modal on wider screens. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-[1.75rem] border border-line bg-surface p-0 text-ink shadow-2xl sm:m-auto sm:max-w-lg sm:rounded-[1.75rem]"
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <span aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" />
          <header className="flex items-center justify-between gap-3 border-b border-line px-5 pt-2.5 pb-3 sm:pt-4">
            <h2 id={titleId} className="text-lg font-bold tracking-tight">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex size-9 items-center justify-center rounded-full bg-surface-2 text-muted hover:text-ink"
            >
              <X size={18} />
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="border-t border-line px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
