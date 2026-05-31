"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md rounded-lg p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-red-100 p-2 text-red-600 dark:bg-red-500/20 dark:text-red-100">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold">{title}</h2>
            <p className="mt-2 text-sm leading-7 text-market-ink/66 dark:text-white/66">{body}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
