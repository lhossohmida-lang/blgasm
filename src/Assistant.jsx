import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Cog,
  Eye,
  Info,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import {
  AI_HISTORY_KEY,
  DEFAULT_MODEL,
  buildSystemPrompt,
  loadAIConfig,
  runAgent,
  saveAIConfig,
} from "./lib/ai";
import {
  TOOL_DEFINITIONS,
  TOOL_LABELS,
  WRITE_TOOLS,
  buildSnapshot,
  describeWrite,
  executeTool,
} from "./lib/aiTools";

const SUGGESTIONS = [
  "ما المنتجات التي على وشك النفاد؟",
  "كم بعنا اليوم؟ وكم الربح؟",
  "من هم أكثر 5 زبائن مديونية؟",
  "ما الأكثر مبيعاً هذا الشهر؟",
  "ما قيمة المخزون الإجمالية؟",
];

function loadHistory() {
  try {
    const raw = localStorage.getItem(AI_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveHistory(messages) {
  try { localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(messages)); }
  catch { /* localStorage ممتلئ */ }
}

export default function Assistant() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(() => loadAIConfig());
  const [messages, setMessages] = useState(() => loadHistory());
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const abortRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => saveHistory(messages), [messages]);
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, status]);

  function requestConfirm(name, args) {
    return new Promise((resolve) => setPendingConfirm({ name, args, resolve }));
  }

  async function wrappedExecute(name, args) {
    if (config.requireConfirm && WRITE_TOOLS.has(name)) {
      const ok = await requestConfirm(name, args);
      if (!ok) return { cancelled: true, message: "ألغى المستخدم العملية" };
    }
    return executeTool(name, args);
  }

  async function send(text) {
    const userText = (text ?? input).trim();
    if (!userText || status !== "idle") return;

    setError("");
    setInput("");
    const userMessage = { role: "user", content: userText };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setStatus("thinking");

    const controller = new AbortController();
    abortRef.current = controller;

    const apiMessages = [
      { role: "system", content: buildSystemPrompt() },
      ...newMessages.filter((m) => m.role === "user" || m.role === "assistant"),
    ];

    try {
      const finalConvo = await runAgent({
        apiBase: config.apiBase || "",
        model: config.model || DEFAULT_MODEL,
        messages: apiMessages,
        tools: TOOL_DEFINITIONS,
        executeTool: wrappedExecute,
        buildSnapshot,
        signal: controller.signal,
        onEvent: (ev) => {
          if (ev.type === "thinking") setStatus("thinking");
          if (ev.type === "fallback_no_tools") {
            setReadOnly(true);
            setMessages((prev) => [...prev, {
              role: "system_notice",
              content: "هذا النموذج لا يدعم استدعاء الأدوات. تم التحويل تلقائياً إلى وضع القراءة فقط مع لقطة من بيانات المتجر.",
            }]);
          }
          if (ev.type === "tool_start") {
            setStatus("tool");
            setMessages((prev) => [...prev, {
              role: "tool_event",
              name: ev.name,
              args: ev.args,
              state: "running",
              id: ev.id,
            }]);
          }
          if (ev.type === "tool_end") {
            setMessages((prev) => prev.map((m) =>
              m.role === "tool_event" && m.id === ev.id
                ? { ...m, state: ev.result?.cancelled ? "cancelled" : (ev.result?.error ? "error" : "done"), result: ev.result }
                : m
            ));
          }
          if (ev.type === "assistant" && ev.message?.content && !ev.message?.tool_calls?.length) {
            setMessages((prev) => [...prev, { role: "assistant", content: ev.message.content }]);
          }
        },
      });
      void finalConvo;
      setStatus("idle");
    } catch (err) {
      setStatus("idle");
      if (err?.name !== "AbortError") setError(err?.message || "حدث خطأ غير متوقع");
    } finally {
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
    setStatus("idle");
  }

  function clearChat() {
    if (status !== "idle") return;
    if (!messages.length) return;
    if (!confirm("هل تريد مسح كل المحادثة؟")) return;
    setMessages([]);
    setError("");
  }

  function onSubmit(e) {
    e.preventDefault();
    send();
  }

  return (
    <>
      <header className="hero-header sticky top-0 z-20 px-5 py-6 lg:static lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/")} className="glass-icon grid h-14 w-14 place-items-center rounded-full">
              <ArrowLeft />
            </button>
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15">
                <Sparkles />
              </div>
              <div>
                <h1 className="text-2xl font-black md:text-3xl">المساعد الذكي</h1>
                <p className="text-sm text-white/70">{config.model || DEFAULT_MODEL}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={clearChat}
              title="مسح المحادثة"
              className="glass-icon grid h-14 w-14 place-items-center rounded-full"
            >
              <Trash2 />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              title="الإعدادات"
              className="glass-icon grid h-14 w-14 place-items-center rounded-full"
            >
              <Cog />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex h-[calc(100vh-180px)] max-w-4xl flex-col p-4 md:p-6 lg:h-[calc(100vh-130px)]">
        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto pb-4">
          {readOnly && (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
              <Info size={18} className="mt-0.5 shrink-0" />
              <div className="text-sm">
                النموذج الحالي لا يدعم الأدوات. تعمل الآن في <b>وضع القراءة فقط</b> مع لقطة بيانات.
                للحصول على صلاحيات كاملة، غيّر النموذج من ⚙️ إلى مثل
                <code className="ltr mx-1 rounded bg-amber-100 px-1">meta-llama/llama-3.3-70b-instruct:free</code>.
              </div>
            </div>
          )}
          {messages.length === 0 && <Empty onPick={send} />}
          {messages.map((m, i) => <MessageBubble key={i} message={m} />)}
          {status === "thinking" && <ThinkingIndicator />}
          {error && (
            <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-red-700">
              <AlertTriangle size={20} className="mt-1 shrink-0" />
              <div>
                <b>خطأ:</b> {error}
                {error.includes("OPENROUTER_API_KEY") && (
                  <p className="mt-1 text-sm">المفتاح غير مضبوط في Vercel. افتح Vercel → Settings → Environment Variables وأضف OPENROUTER_API_KEY.</p>
                )}
                {error.includes("تعذر الاتصال") && (
                  <p className="mt-1 text-sm">إذا كنت تعمل محلياً، استخدم <code className="ltr">vercel dev</code> أو حدّد عنوان الـ API من الإعدادات.</p>
                )}
                {error.toLowerCase().includes("401") && (
                  <p className="mt-1 text-sm">المفتاح المضبوط على Vercel غير صالح. أنشئ مفتاحاً جديداً وحدّث متغير البيئة.</p>
                )}
                {error.toLowerCase().includes("404") && !error.includes("تعذر") && (
                  <p className="mt-1 text-sm">اسم النموذج غير صحيح. تأكد من معرّفه الدقيق على OpenRouter.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="mt-auto pt-3">
            <div className="card flex items-end gap-2 p-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                }}
                placeholder="اسأل عن المخزون، المبيعات، الزبائن، أو أعطِ أمراً..."
                rows={1}
                className="input min-h-[48px] resize-none border-0 bg-transparent shadow-none focus:shadow-none"
                disabled={status !== "idle"}
              />
              {status === "idle" ? (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="btn-primary grid h-12 w-12 shrink-0 place-items-center rounded-2xl disabled:opacity-50"
                >
                  <Send size={20} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stop}
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red-100 text-red-700 hover:bg-red-200"
                >
                  <X size={20} />
                </button>
              )}
            </div>
            <p className="mt-2 text-center text-xs text-gray-500">
              Enter للإرسال • Shift+Enter لسطر جديد • قد يُخطئ الذكاء الاصطناعي، راجع العمليات الحساسة.
            </p>
          </form>
      </main>

      {showSettings && (
        <SettingsModal
          config={config}
          close={() => setShowSettings(false)}
          save={(next) => { saveAIConfig(next); setConfig(next); setShowSettings(false); }}
        />
      )}

      {pendingConfirm && (
        <ConfirmModal
          name={pendingConfirm.name}
          args={pendingConfirm.args}
          onAnswer={(ok) => { pendingConfirm.resolve(ok); setPendingConfirm(null); }}
        />
      )}
    </>
  );
}

function Empty({ onPick }) {
  return (
    <div className="grid place-items-center py-10 text-center">
      <div className="mb-4 grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-[#0d6a42] to-[#063f2b] text-white shadow-lg">
        <Bot size={40} />
      </div>
      <h2 className="text-2xl font-black text-[#063f2b]">كيف أساعدك اليوم؟</h2>
      <p className="mt-2 max-w-md text-gray-500">
        اسألني عن أي شيء يتعلق بمتجرك — مخزون، مبيعات، زبائن، أرباح. أو أعطِ أمراً مثل "أضف منتج..." أو "سجّل دفعة...".
      </p>
      <div className="mt-6 grid w-full max-w-2xl gap-2 md:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="soft-card flex items-center gap-3 p-4 text-right font-bold text-[#063f2b] transition hover:border-[#0d6a42]/30 active:scale-[0.98]"
          >
            <Sparkles size={18} className="shrink-0 text-[#0d6a42]" />
            <span className="flex-1 text-sm">{s}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-3xl rounded-tr-md bg-[#063f2b] px-4 py-3 text-white shadow-md">
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        </div>
      </div>
    );
  }
  if (message.role === "assistant") {
    return (
      <div className="flex justify-start">
        <div className="flex max-w-[90%] gap-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#0d6a42] to-[#063f2b] text-white">
            <Bot size={18} />
          </div>
          <div className="card rounded-3xl rounded-tl-md px-4 py-3">
            <p className="whitespace-pre-wrap leading-relaxed text-gray-800">{message.content}</p>
          </div>
        </div>
      </div>
    );
  }
  if (message.role === "tool_event") return <ToolEvent message={message} />;
  if (message.role === "system_notice") {
    return (
      <div className="mx-auto flex max-w-[92%] items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <Info size={14} />
        <span>{message.content}</span>
      </div>
    );
  }
  return null;
}

function ToolEvent({ message }) {
  const label = TOOL_LABELS[message.name] || message.name;
  const isWrite = WRITE_TOOLS.has(message.name);
  const stateIcon =
    message.state === "running" ? <Loader2 size={16} className="animate-spin" /> :
    message.state === "error"   ? <AlertTriangle size={16} /> :
    message.state === "cancelled" ? <X size={16} /> :
    <CheckCircle2 size={16} />;
  const stateClass =
    message.state === "running" ? "border-blue-200 bg-blue-50 text-blue-700" :
    message.state === "error"   ? "border-red-200 bg-red-50 text-red-700" :
    message.state === "cancelled" ? "border-gray-200 bg-gray-50 text-gray-600" :
    isWrite ? "border-orange-200 bg-orange-50 text-orange-700" : "border-green-200 bg-green-50 text-[#0d6a42]";

  return (
    <div className={`mx-auto flex max-w-[92%] items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${stateClass}`}>
      {isWrite ? <Wrench size={14} /> : <Eye size={14} />}
      <span>{label}</span>
      <span className="opacity-70">•</span>
      {stateIcon}
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 text-gray-500">
      <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#0d6a42] to-[#063f2b] text-white">
        <Bot size={18} />
      </div>
      <div className="flex items-center gap-1 rounded-3xl bg-white px-4 py-3 shadow-sm">
        <Dot delay={0} /><Dot delay={150} /><Dot delay={300} />
      </div>
    </div>
  );
}

function Dot({ delay }) {
  return (
    <span
      className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#0d6a42]"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

function SettingsModal({ config, close, save }) {
  const [model, setModel] = useState(config.model || DEFAULT_MODEL);
  const [apiBase, setApiBase] = useState(config.apiBase || "");
  const [requireConfirm, setRequireConfirm] = useState(config.requireConfirm !== false);

  function submit(e) {
    e.preventDefault();
    save({ model: model.trim() || DEFAULT_MODEL, apiBase: apiBase.trim(), requireConfirm });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="card w-full max-w-lg p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-black"><Cog /> إعدادات المساعد</h2>
          <button onClick={close} className="grid h-10 w-10 place-items-center rounded-full bg-gray-100"><X /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            <b>🔒 المفتاح آمن على الخادم.</b> مفتاح OpenRouter محفوظ كمتغير بيئة (<code className="ltr">OPENROUTER_API_KEY</code>) في Vercel، ولا يظهر في المتصفح.
          </div>

          <label className="block">
            <span className="mb-2 block font-bold">اسم النموذج</span>
            <input
              className="input ltr text-left"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={DEFAULT_MODEL}
              dir="ltr"
              autoFocus
            />
            <p className="mt-1 text-xs text-gray-500">
              معرّف النموذج كما يظهر على OpenRouter.
            </p>
            <details className="mt-2 text-xs text-gray-500">
              <summary className="cursor-pointer font-bold">نماذج مجانية مقترحة</summary>
              <ul className="ltr mt-2 space-y-1 text-left">
                <li><code>nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free</code> — قراءة فقط</li>
                <li><code>nvidia/nemotron-3-super-120b-a12b:free</code> — قراءة فقط (أقوى)</li>
                <li><code>meta-llama/llama-3.3-70b-instruct:free</code> — يدعم الأدوات ✅</li>
                <li><code>qwen/qwen-2.5-72b-instruct:free</code> — يدعم الأدوات ✅</li>
                <li><code>google/gemini-2.0-flash-exp:free</code> — يدعم الأدوات ✅</li>
              </ul>
            </details>
          </label>

          <label className="block">
            <span className="mb-2 block font-bold">عنوان الـ API (اختياري)</span>
            <input
              className="input ltr text-left"
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              placeholder="https://your-app.vercel.app"
              dir="ltr"
            />
            <p className="mt-1 text-xs text-gray-500">
              اتركه فارغاً لاستخدام نفس النطاق. مفيد عند تشغيل <code className="ltr">npm run dev</code> محلياً والإشارة إلى نشر Vercel.
            </p>
          </label>

          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-3">
            <input
              type="checkbox"
              checked={requireConfirm}
              onChange={(e) => setRequireConfirm(e.target.checked)}
              className="h-5 w-5"
            />
            <div className="flex-1">
              <b className="block text-orange-800">تأكيد قبل عمليات الكتابة</b>
              <span className="text-sm text-orange-700">يطلب تأكيدك قبل أي إضافة/تعديل/حذف ينفّذه المساعد.</span>
            </div>
          </label>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={close} className="btn-ghost flex-1 px-5 py-3 font-black">إلغاء</button>
            <button type="submit" className="btn-primary flex-1 px-5 py-3 font-black">حفظ</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmModal({ name, args, onAnswer }) {
  const label = TOOL_LABELS[name] || name;
  const description = useMemo(() => describeWrite(name, args), [name, args]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-100 text-orange-700">
            <AlertTriangle />
          </div>
          <div>
            <h2 className="text-lg font-black">تأكيد عملية</h2>
            <p className="text-sm text-gray-500">{label}</p>
          </div>
        </div>
        <div className="rounded-2xl border bg-gray-50 p-4 text-gray-800">
          {description}
        </div>
        <details className="mt-3 text-xs text-gray-500">
          <summary className="cursor-pointer">عرض البيانات الخام</summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded-xl bg-gray-900 p-3 text-left text-gray-100 ltr">
{JSON.stringify(args, null, 2)}
          </pre>
        </details>
        <div className="mt-5 flex gap-2">
          <button onClick={() => onAnswer(false)} className="btn-ghost flex-1 px-5 py-3 font-black">إلغاء</button>
          <button onClick={() => onAnswer(true)} className="btn-primary flex-1 px-5 py-3 font-black">تنفيذ</button>
        </div>
      </div>
    </div>
  );
}
