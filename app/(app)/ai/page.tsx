"use client";

import { FormEvent, useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { useStore } from "@/components/providers/store-provider";
import { useToast } from "@/components/providers/toast-provider";
import { buildAiContext } from "@/lib/openrouter/context";

const suggestions = [
  "كم ربحي اليوم؟",
  "ما المنتجات التي ربحها ضعيف؟",
  "من أكثر شخص عليه كريدي؟",
  "ما المنتجات التي يجب أن أشتريها؟",
  "أعطني ملخص الشهر",
  "هل هناك منتجات أوشكت على النفاد؟",
  "كيف أرفع ربحي؟",
];

export default function AiPage() {
  const { data } = useStore();
  const { notify } = useToast();
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(event?: FormEvent<HTMLFormElement>, override?: string) {
    event?.preventDefault();
    if (!data) {
      return;
    }
    const prompt = (override ?? message).trim();
    if (!prompt) {
      return;
    }

    setLoading(true);
    setAnswer("");
    setMessage(prompt);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          context: buildAiContext(data),
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(await response.text());
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        setAnswer((current) => current + decoder.decode(value, { stream: true }));
      }
    } catch (error) {
      notify({
        tone: "error",
        title: "تعذر تشغيل المساعد",
        body: error instanceof Error ? error.message : "تأكد من ضبط OPENROUTER_API_KEY على الخادم.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        icon={Bot}
        title="الذكاء الاصطناعي"
        description="مساعد تجاري يستعمل OpenRouter عبر API Route آمن في الخادم."
      />

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-leaf-600" />
            <h2 className="text-lg font-black">اسأل عن المتجر</h2>
          </div>
          <form className="space-y-3" onSubmit={ask}>
            <Textarea
              label="السؤال"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="مثال: أعطني ملخص الشهر واقتراحات الشراء"
            />
            <Button loading={loading}>
              <Send className="h-4 w-4" />
              إرسال
            </Button>
          </form>
          <div className="mt-5 flex flex-wrap gap-2">
            {suggestions.map((item) => (
              <button
                key={item}
                type="button"
                className="rounded-lg border border-black/10 bg-white/65 px-3 py-2 text-sm font-bold transition hover:bg-white dark:border-white/10 dark:bg-white/7 dark:hover:bg-white/12"
                onClick={() => ask(undefined, item)}
              >
                {item}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-black">الإجابة</h2>
          <div className="mt-4 min-h-80 whitespace-pre-wrap rounded-lg border border-black/5 bg-white/58 p-4 leading-8 text-market-ink/82 dark:border-white/10 dark:bg-white/5 dark:text-white/82">
            {answer || (loading ? "جاري التفكير..." : "ستظهر إجابة المساعد هنا.")}
          </div>
        </Card>
      </div>
    </div>
  );
}
