"use client";

import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

interface FieldProps {
  label?: string;
  helper?: string;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(
  ({ label, helper, className, ...props }, ref) => (
    <label className="block">
      {label ? <span className="label">{label}</span> : null}
      <input ref={ref} className={cn("field", className)} {...props} />
      {helper ? <span className="mt-1 block text-xs text-market-ink/55 dark:text-white/55">{helper}</span> : null}
    </label>
  ),
);
Input.displayName = "Input";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldProps>(
  ({ label, helper, className, children, ...props }, ref) => (
    <label className="block">
      {label ? <span className="label">{label}</span> : null}
      <select ref={ref} className={cn("field", className)} {...props}>
        {children}
      </select>
      {helper ? <span className="mt-1 block text-xs text-market-ink/55 dark:text-white/55">{helper}</span> : null}
    </label>
  ),
);
Select.displayName = "Select";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(
  ({ label, helper, className, ...props }, ref) => (
    <label className="block">
      {label ? <span className="label">{label}</span> : null}
      <textarea ref={ref} className={cn("field min-h-28 resize-y", className)} {...props} />
      {helper ? <span className="mt-1 block text-xs text-market-ink/55 dark:text-white/55">{helper}</span> : null}
    </label>
  ),
);
Textarea.displayName = "Textarea";
