"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "btn",
          variant === "primary" && "btn-primary",
          variant === "secondary" && "btn-secondary",
          variant === "danger" && "btn-danger",
          variant === "ghost" &&
            "text-market-ink hover:bg-black/5 dark:text-white dark:hover:bg-white/10",
          className,
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
