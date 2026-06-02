"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, Mic, MicOff, Package, Send, TrendingUp, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/components/providers/store-provider";
import { useToast } from "@/components/providers/toast-provider";
import { buildAiContext } from "@/lib/openrouter/context";
import { formatCurrency } from "@/utils/format";

const suggestions = [
  { label: "كم ربحي اليوم؟", icon: TrendingUp },
  { label: "ما هي المنتجات الناقصة؟", icon: Package },
  { label: "من أكثر شخص عليه كريدي؟", icon: UserRound },
  { label: "اقترح علي طلبية اليوم", icon: Bot },
];

const AI_CHAT_ENDPOINT = process.env.NEXT_PUBLIC_AI_CHAT_URL ?? "/api/ai/chat";
const MICROPHONE_PERMISSION_HELP =
  "التسجيل الصوتي يعمل عبر Chrome أو Edge فقط. إذا كنت تستعمل أحدهما، افتح إعدادات الموقع من أيقونة القفل بجانب الرابط، اختر Microphone، ثم Allow، وبعدها أعد تحميل الصفحة.";

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognition;

type SpeechWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

type ChatRole = "assistant" | "user";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  status?: "streaming" | "error";
};

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function microphoneErrorMessage(error: string) {
  const normalized = error.toLowerCase();
  if (
    normalized === "not-allowed" ||
    normalized === "permission-denied" ||
    normalized === "notallowederror" ||
    normalized === "permissiondeniederror"
  ) {
    return "اسمح للتطبيق باستعمال المايكروفون من المتصفح ثم جرّب من جديد.";
  }

  if (normalized === "audio-capture" || normalized === "notfounderror" || normalized === "devicesnotfounderror") {
    return "لم أجد مايكروفوناً متصلاً. تأكد من جهاز الصوت في ويندوز.";
  }

  if (normalized === "no-speech") {
    return "لم أسمع كلاماً واضحاً. اضغط المايكروفون وتكلم قريباً من الجهاز.";
  }

  if (normalized === "network") {
    return "التعرف الصوتي في المتصفح يحتاج اتصالاً مستقراً بالإنترنت.";
  }

  return "تعذر تشغيل التسجيل الصوتي الآن. جرّب Chrome أو Edge وتأكد من صلاحية المايكروفون في إعدادات الموقع.";
}

export default function AiPage() {
  const { data, stats } = useStore();
  const { notify } = useToast();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "مرحباً، أنا مساعد بلقاسم. اسألني عن الأرباح، المخزون، الكريدي، أو اضغط على اقتراح سريع.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [microphoneBlocked, setMicrophoneBlocked] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const snapshot = useMemo(
    () => [
      { label: "ربح اليوم", value: formatCurrency(stats?.todayProfit ?? 0), icon: TrendingUp },
      { label: "منتجات ناقصة", value: `${stats?.lowStockCount ?? 0}`, icon: Package },
      {
        label: "أعلى كريدي",
        value: formatCurrency(data?.creditCustomers[0]?.remainingDebt ?? 0),
        icon: UserRound,
      },
    ],
    [data?.creditCustomers, stats?.lowStockCount, stats?.todayProfit],
  );

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setMicrophoneBlocked(true);
      notify({
        tone: "warning",
        title: "الميكروفون يحتاج Chrome أو Edge",
        body: MICROPHONE_PERMISSION_HELP,
      });
      return;
    }

    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = "ar-DZ";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index]?.[0]?.transcript ?? "";
      }

      const trimmed = transcript.trim();
      if (trimmed) {
        setMessage(trimmed);
      }
    };

    recognition.onerror = (event) => {
      setListening(false);
      notify({
        tone: "error",
        title: "تعذر تشغيل المايكروفون",
        body: event.error === "not-allowed" ? MICROPHONE_PERMISSION_HELP : microphoneErrorMessage(event.error),
      });
    };

    recognition.onend = () => {
      setListening(false);
      inputRef.current?.focus();
    };

    try {
      recognition.start();
      setMicrophoneBlocked(false);
      setListening(true);
      notify({
        tone: "info",
        title: "استمع الآن",
        body: "تكلم وسيظهر كلامك مباشرة في خانة الرسالة.",
      });
    } catch {
      setListening(false);
      notify({
        tone: "error",
        title: "لم يبدأ التسجيل",
        body: "أغلق أي تسجيل آخر ثم جرّب من جديد.",
      });
    }
  }

  async function ask(event?: FormEvent<HTMLFormElement>, override?: string) {
    event?.preventDefault();
    if (!data || loading) return;

    const prompt = (override ?? message).trim();
    if (!prompt) {
      inputRef.current?.focus();
      return;
    }

    const assistantId = makeId();
    setLoading(true);
    setMessage("");
    setMessages((current) => [
      ...current,
      { id: makeId(), role: "user", content: prompt },
      { id: assistantId, role: "assistant", content: "", status: "streaming" },
    ]);

    try {
      const response = await fetch(AI_CHAT_ENDPOINT, {
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

        const chunk = decoder.decode(value, { stream: true });
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantId ? { ...item, content: item.content + chunk, status: "streaming" } : item,
          ),
        );
      }

      setMessages((current) =>
        current.map((item) => (item.id === assistantId ? { ...item, status: undefined } : item)),
      );
    } catch (error) {
      const fallback =
        error instanceof Error && error.message
          ? error.message
          : AI_CHAT_ENDPOINT.startsWith("/api/")
            ? "تأكد من ضبط OPENROUTER_API_KEY على Vercel لكي يعمل الذكاء الاصطناعي دائماً."
            : "تأكد من رابط NEXT_PUBLIC_AI_CHAT_URL ومن اتصال الإنترنت.";

      setMessages((current) =>
        current.map((item) =>
          item.id === assistantId ? { ...item, content: fallback, status: "error" } : item,
        ),
      );
      notify({
        tone: "error",
        title: "تعذر تشغيل المساعد",
        body: fallback,
      });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  if (!data) return null;

  return (
    <div className="ios-page flex min-h-[calc(100vh-40px)] flex-col pb-28 lg:pb-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black lg:text-4xl">الذكاء الاصطناعي</h1>
          <p className="mt-1 text-sm text-market-ink/60 lg:text-base">محادثة مباشرة مع مساعد بلقاسم التجاري.</p>
        </div>
        <div className="ios-icon h-14 w-14 shrink-0">
          <Bot className="h-7 w-7" />
        </div>
      </div>

      <section className="mb-4 grid grid-cols-3 gap-2">
        {snapshot.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-3xl border border-black/5 bg-white/80 p-3 shadow-sm backdrop-blur-xl">
              <Icon className="mb-2 h-5 w-5 text-leaf-700" />
              <p className="text-[11px] font-bold text-market-ink/55">{item.label}</p>
              <p className="mt-1 truncate text-sm font-black text-market-ink">{item.value}</p>
            </div>
          );
        })}
      </section>

      <section className="flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-[30px] border border-black/5 bg-white/80 shadow-glass backdrop-blur-2xl">
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="ios-icon h-11 w-11">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="font-black">مساعد بلقاسم</p>
              <p className="text-xs font-bold text-leaf-700">{loading ? "يكتب الآن..." : "متصل وجاهز"}</p>
            </div>
          </div>
          {listening ? (
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-600">يستمع...</span>
          ) : null}
        </div>

        {microphoneBlocked ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-900">
            <p className="font-black">الميكروفون ممنوع من المتصفح</p>
            <p className="mt-1">{MICROPHONE_PERMISSION_HELP}</p>
            <button
              type="button"
              className="mt-2 rounded-full bg-white px-4 py-2 text-xs font-black text-amber-900 shadow-sm active:scale-95"
              onClick={() => {
                setMicrophoneBlocked(false);
                void toggleListening();
              }}
            >
              طلب السماح مرة أخرى
            </button>
          </div>
        ) : null}

        <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4 lg:px-5">
          {messages.map((item) => {
            const isUser = item.role === "user";
            return (
              <div key={item.id} className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
                <div
                  className={[
                    "max-w-[82%] rounded-[24px] px-4 py-3 text-sm leading-7 shadow-sm lg:max-w-[70%] lg:text-base",
                    isUser
                      ? "rounded-bl-md bg-leaf-600 text-white"
                      : item.status === "error"
                        ? "rounded-br-md bg-red-50 text-red-700"
                        : "rounded-br-md bg-leaf-50 text-market-ink",
                  ].join(" ")}
                >
                  {item.content ? (
                    <p className="whitespace-pre-wrap">{item.content}</p>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-market-ink/60">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      جاري التفكير...
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-black/5 bg-white/85 p-3">
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {suggestions.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  disabled={loading || listening}
                  onClick={() => ask(undefined, item.label)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border border-leaf-100 bg-leaf-50 px-4 py-2 text-sm font-black text-leaf-700 transition active:scale-95 disabled:opacity-50"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <form onSubmit={ask} className="flex items-center gap-2">
            <button
              type="button"
              className={`ios-circle-button h-12 w-12 shrink-0 ${
                listening ? "bg-red-600 text-white ring-4 ring-red-500/20" : "bg-leaf-50 text-leaf-700"
              }`}
              title={listening ? "إيقاف التسجيل" : "التحدث بالمايكروفون"}
              onClick={toggleListening}
            >
              {listening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </button>
            <input
              ref={inputRef}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={listening ? "تكلم الآن..." : "اكتب رسالتك هنا..."}
              className="min-w-0 flex-1 rounded-full border border-black/10 bg-white px-4 py-3 outline-none focus:border-leaf-500"
            />
            <Button className="h-12 w-12 shrink-0 rounded-full p-0" disabled={loading || !message.trim()} loading={loading}>
              <Send className="h-5 w-5" />
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
