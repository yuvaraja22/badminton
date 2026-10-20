import { useEffect, useRef, type ReactNode } from 'react';
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

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-2xl bg-surface p-0 text-ink shadow-2xl sm:m-auto sm:max-w-lg sm:rounded-2xl"
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="text-base font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex size-8 items-center justify-center rounded-full text-muted hover:bg-surface-2"
            >
              <X size={18} />
            </button>
          </header>
          <div className="overflow-y-auto px-4 py-4">{children}</div>
          {footer && <footer className="border-t border-line px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
