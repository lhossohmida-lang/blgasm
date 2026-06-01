import { Bell } from "lucide-react";
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
    <>
      <div className="ios-topbar">
        <img src="/storefront.svg" alt="متجر بلقاسم" className="ios-avatar" />
        <div className="min-w-0 flex-1 pt-2">
          <h1 className="ios-title">{title}</h1>
          <p className="ios-subtitle">{description}</p>
        </div>
        <button type="button" className="ios-circle-button" title="التنبيهات">
          <Bell className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-6 hidden flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:flex">
        <div className="flex items-center gap-3">
          <div className="ios-icon">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-normal">{title}</h1>
            <p className="mt-1 text-sm leading-6 text-market-ink/62 dark:text-white/62">{description}</p>
          </div>
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      {action ? <div className="mb-4 flex justify-center lg:hidden">{action}</div> : null}
    </>
  );
}
