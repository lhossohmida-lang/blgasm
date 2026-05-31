"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X, TriangleAlert } from "lucide-react";
import type { ToastTone } from "@/types";

interface ToastMessage {
  id: string;
  title: string;
  body?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  notify: (message: Omit<ToastMessage, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: TriangleAlert,
  info: Info,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const remove = useCallback((id: string) => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);

  const notify = useCallback(
    (message: Omit<ToastMessage, "id">) => {
      const id = crypto.randomUUID();
      setMessages((current) => [{ ...message, id }, ...current].slice(0, 4));
      window.setTimeout(() => remove(id), 4200);
    },
    [remove],
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed left-4 top-4 z-50 flex w-[min(92vw,380px)] flex-col gap-3">
        {messages.map((message) => {
          const Icon = icons[message.tone];
          return (
            <div key={message.id} className={`toast toast-${message.tone}`} role="status">
              <Icon className="h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{message.title}</p>
                {message.body ? <p className="mt-1 text-xs opacity-80">{message.body}</p> : null}
              </div>
              <button
                type="button"
                title="إغلاق"
                className="rounded-md p-1 transition hover:bg-black/10 dark:hover:bg-white/10"
                onClick={() => remove(message.id)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
