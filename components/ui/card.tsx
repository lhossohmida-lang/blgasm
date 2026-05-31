import { cn } from "@/utils/cn";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("glass-panel rounded-lg p-5", className)}>{children}</div>;
}
