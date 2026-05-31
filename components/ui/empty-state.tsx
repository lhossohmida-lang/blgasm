import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-black/15 bg-white/45 p-8 text-center dark:border-white/15 dark:bg-white/5">
      <Icon className="mx-auto h-9 w-9 text-leaf-600 dark:text-leaf-300" />
      <h3 className="mt-3 text-base font-extrabold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-market-ink/60 dark:text-white/60">{body}</p>
    </div>
  );
}
