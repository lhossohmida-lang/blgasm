"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { saveLocalAppData, replaceLocalQueue } from "@/lib/offline/db";
import { createInitialData } from "@/utils/sample-data";

export default function ResetPage() {
  const { user } = useAuth();
  const [message, setMessage] = useState("جاري تصفير كل بيانات التطبيق...");

  useEffect(() => {
    async function reset() {
      if (!user) {
        return;
      }

      const emptyData = createInitialData(user.uid);
      await saveLocalAppData(emptyData);
      await replaceLocalQueue(emptyData.store.id, []);
      setMessage("تم تصفير البيانات. سيتم فتح التقارير الآن.");
      window.setTimeout(() => {
        window.location.replace("/reports");
      }, 600);
    }

    reset().catch((error) => {
      setMessage(error instanceof Error ? error.message : "تعذر تصفير البيانات.");
    });
  }, [user]);

  return (
    <div className="flex min-h-[55vh] items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-leaf-600 text-white">
          <RotateCcw className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-black">تصفير التطبيق</h1>
        <p className="mt-3 text-sm leading-7 text-market-ink/65 dark:text-white/65">{message}</p>
        {!user ? <LoadingState label="بانتظار المستخدم..." /> : null}
      </Card>
    </div>
  );
}
