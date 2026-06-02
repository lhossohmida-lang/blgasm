import { Download, Github, MonitorDown, ShieldCheck, Smartphone, Store } from "lucide-react";

const downloads = [
  {
    title: "نسخة الكمبيوتر EXE",
    description: "مثبت Windows الكامل لتطبيق بلقاسم POS.",
    href: "https://github.com/lhossohmida-lang/blgasm/releases/latest/download/Blgasm-POS-Setup-1.0.0.exe",
    icon: MonitorDown,
    meta: "Windows 10/11",
  },
  {
    title: "نسخة الهاتف APK",
    description: "تطبيق Android جاهز للتثبيت على الهاتف.",
    href: "https://github.com/lhossohmida-lang/blgasm/releases/latest/download/Blgasm-POS-Android-1.0.0-release.apk",
    icon: Smartphone,
    meta: "Android",
  },
];

export default function DownloadPage() {
  return (
    <main className="min-h-screen px-5 py-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col justify-center">
        <div className="mb-8 text-center">
          <img
            src="/blgasm-logo.png"
            alt="BELGASEM"
            className="mx-auto h-28 w-28 rounded-[28px] border border-black/5 bg-white object-cover shadow-soft"
          />
          <h1 className="mt-5 text-4xl font-black text-leaf-700 sm:text-5xl">تحميل تطبيق بلقاسم</h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-8 text-market-ink/65">
            اختر النسخة المناسبة لجهازك. روابط التحميل محفوظة على GitHub Releases وتعمل مباشرة من صفحة Vercel.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {downloads.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="ios-card flex flex-col gap-5 p-6">
                <div className="flex items-center gap-4">
                  <span className="ios-icon h-16 w-16 rounded-3xl">
                    <Icon className="h-8 w-8" />
                  </span>
                  <div>
                    <p className="text-2xl font-black">{item.title}</p>
                    <p className="mt-1 text-sm font-bold text-leaf-700">{item.meta}</p>
                  </div>
                </div>

                <p className="leading-8 text-market-ink/65">{item.description}</p>

                <a className="btn btn-primary mt-auto h-14 rounded-3xl text-base" href={item.href}>
                  <Download className="h-5 w-5" />
                  تحميل الآن
                </a>
              </article>
            );
          })}
        </div>

        <div className="mt-6 grid gap-3 rounded-[24px] border border-leaf-500/15 bg-leaf-50/70 p-4 text-sm font-bold text-leaf-800 md:grid-cols-3">
          <span className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            blgasm.vercel.app
          </span>
          <span className="flex items-center gap-2">
            <Github className="h-4 w-4" />
            GitHub Releases
          </span>
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            APK موقّع محلياً
          </span>
        </div>
      </section>
    </main>
  );
}
