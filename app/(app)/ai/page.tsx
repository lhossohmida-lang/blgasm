"use client";

import { FormEvent, useState } from "react";
import { Bot, Cloud, Mic, Package, Send, ShieldCheck, TrendingUp, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/components/providers/store-provider";
import { useToast } from "@/components/providers/toast-provider";
import { buildAiContext } from "@/lib/openrouter/context";
import { formatCurrency } from "@/utils/format";

const suggestions = [
  { label: "كم ربحي اليوم؟", icon: TrendingUp },
  { label: "المنتجات الناقصة؟", icon: Package },
  { label: "أكثر شخص عليه كريدي؟", icon: UserRound },
];

export default function AiPage() {
  const { data, stats } = useStore();
  const { notify } = useToast();
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(event?: FormEvent<HTMLFormElement>, override?: string) {
    event?.preventDefault();
    if (!data) return;
    const prompt = (override ?? message).trim();
    if (!prompt) return;

    setLoading(true);
    setAnswer("");
    setMessage(prompt);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt, context: buildAiContext(data) }),
      });

      if (!response.ok || !response.body) {
        throw new Error(await response.text());
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
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

  if (!data) return null;

  return (
    <div className="ios-page">
      <div className="ios-topbar">
        <button className="ios-circle-button relative" title="تنبيهات">
          <span className="absolute left-2 top-1 h-3 w-3 rounded-full bg-orange-500" />
          <Bot className="h-5 w-5" />
        </button>
        <div className="flex-1 pt-2 text-center">
          <h1 className="text-4xl font-black">المساعد الذكي</h1>
          <p className="mt-1 text-lg text-market-ink/70">مدعوم بالذكاء الاصطناعي Nemotron</p>
        </div>
        <img src="/storefront.svg" alt="" className="ios-avatar" />
      </div>

      <div className="mb-6 hidden lg:block">
        <h1 className="text-3xl font-black">الذكاء الاصطناعي</h1>
        <p className="mt-1 text-market-ink/60">مساعد تجاري يحلل ملخص البيانات الضرورية فقط.</p>
      </div>

      <section className="ios-card">
        <div className="flex items-start gap-4">
          <div className="ios-icon h-16 w-16">
            <Bot className="h-8 w-8" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-black">مرحباً بك في مساعد بلقاسم الذكي</h2>
            <p className="mt-2 leading-8 text-market-ink/65">
              يمكنني مساعدتك في تحليل مبيعاتك، تتبع المخزون، فهم العملاء، وزيادة أرباح متجرك.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="ios-card-tight grid grid-cols-[1fr_84px] items-center gap-4">
            <div>
              <p className="text-xl font-black text-leaf-700">ربح اليوم</p>
              <p className="mt-1">ربحك اليوم هو {formatCurrency(stats?.todayProfit ?? 0)}</p>
              <p className="mt-1 text-sm font-bold text-leaf-700">↑ +15% عن نفس اليوم أمس</p>
            </div>
            <TrendingUp className="h-16 w-16 text-leaf-700" />
          </div>
          <div className="ios-card-tight grid grid-cols-[1fr_84px] items-center gap-4">
            <div>
              <p className="text-xl font-black text-leaf-700">منتجات منخفضة في المخزون</p>
              <p className="mt-1">هناك {stats?.lowStockCount ?? 0} منتجات تحتاج إلى إعادة طلب</p>
              <button className="mt-2 text-sm font-black text-leaf-700">عرض المنتجات</button>
            </div>
            <Package className="h-16 w-16 text-orange-500" />
          </div>
          <div className="ios-card-tight grid grid-cols-[1fr_84px] items-center gap-4">
            <div>
              <p className="text-xl font-black text-leaf-700">أكثر زبون عليه كريدي</p>
              <p className="mt-1">{data.creditCustomers[0]?.name ?? "لا يوجد"} لديه أعلى رصيد دائن</p>
              <p className="mt-1 text-2xl font-black">{formatCurrency(data.creditCustomers[0]?.remainingDebt ?? 0)}</p>
            </div>
            <UserRound className="h-16 w-16 text-leaf-700" />
          </div>
        </div>
      </section>

      <section className="mt-5">
        <p className="mb-3 text-lg font-black">اقتراحات سريعة</p>
        <div className="grid grid-cols-3 gap-3">
          {suggestions.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.label} className="ios-card-tight text-center text-leaf-700" onClick={() => ask(undefined, item.label)}>
                <Icon className="mx-auto h-7 w-7" />
                <span className="mt-2 block text-sm font-bold">{item.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="ios-card mt-5 bg-leaf-50/70">
        <div className="flex items-center gap-4">
          <div className="ios-icon h-16 w-16">
            <Cloud className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-black text-leaf-700">ذكاء اصطناعي في خدمتك</h2>
            <p className="mt-1 text-sm leading-7 text-market-ink/65">المساعد متصل بسحابة آمنة لتحليل بيانات متجرك وتقديم أفضل الإجابات والتوصيات.</p>
            <p className="mt-2 flex items-center gap-2 text-sm font-black text-leaf-700">
              <ShieldCheck className="h-4 w-4" />
              بياناتك آمنة ومشفرة
            </p>
          </div>
        </div>
      </section>

      {(answer || loading) ? (
        <section className="ios-card mt-5 whitespace-pre-wrap leading-8">
          {answer || "جاري التفكير..."}
        </section>
      ) : null}

      <form onSubmit={ask} className="no-print fixed inset-x-4 bottom-24 z-20 mx-auto flex max-w-[460px] items-center gap-3 rounded-full bg-white/95 p-3 shadow-glass backdrop-blur-2xl lg:static lg:mt-5 lg:max-w-none lg:rounded-3xl">
        <button type="button" className="ios-circle-button h-12 w-12 bg-leaf-50 text-leaf-700">
          <Mic className="h-6 w-6" />
        </button>
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="اكتب سؤالك هنا..."
          className="min-w-0 flex-1 rounded-full border border-black/10 bg-white px-4 py-3 outline-none"
        />
        <Button className="h-12 w-12 rounded-full p-0" loading={loading}>
          <Send className="h-5 w-5" />
        </Button>
      </form>
    </div>
  );
}
