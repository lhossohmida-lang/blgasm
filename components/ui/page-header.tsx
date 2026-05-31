import type { LucideIcon } from "lucide-react";

export function PageHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-leaf-600 p-3 text-white shadow-soft dark:bg-leaf-500 dark:text-market-ink">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-normal">{title}</h1>
          <p className="mt-1 text-sm leading-6 text-market-ink/62 dark:text-white/62">{description}</p>
        </div>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}
