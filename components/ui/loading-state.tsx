import { Loader2 } from "lucide-react";

export function LoadingState({ label = "جاري التحميل..." }: { label?: string }) {
  return (
    <div className="flex min-h-60 items-center justify-center">
      <div className="soft-panel flex items-center gap-3 rounded-lg px-5 py-4 text-sm font-bold">
        <Loader2 className="h-5 w-5 animate-spin text-leaf-600" />
        {label}
      </div>
    </div>
  );
}
