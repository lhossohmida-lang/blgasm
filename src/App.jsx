import { useEffect, useRef, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import QRCode from "qrcode";
import {
  AlertTriangle,
  ArrowLeft,
  BadgePlus,
  Banknote,
  BarChart3,
  Bell,
  Calendar,
  Camera,
  CheckCircle2,
  CreditCard,
  Edit3,
  Eye,
  FileText,
  Home,
  LogOut,
  Menu,
  Package,
  PackageCheck,
  PackagePlus,
  Printer,
  QrCode,
  RotateCcw,
  ScanBarcode,
  Search,
  Send,
  Share2,
  ShoppingCart,
  Sparkles,
  Trash2,
  UploadCloud,
  User,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { auth, db } from "./lib/firebase";
import {
  categories,
  createSale,
  deleteCustomer,
  deleteProduct,
  ensureDemoData,
  fetchCustomerTransactions,
  recordPayment,
  receiveProductStock,
  resetData,
  resetDailySales,
  saveCustomer,
  saveProduct,
  units,
} from "./lib/store";
import { dateTime, money, number, shortDate } from "./lib/format";
import Assistant from "./Assistant";

/* ─── نغمة المسح ─── */
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 1320;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } catch { /* المتصفح لا يدعم Web Audio */ }
}

/* ─── إعدادات الطباعة (localStorage) ─── */
function usePrintSettings() {
  const [paperSize, setPaperSizeRaw] = useState(() => localStorage.getItem("paperSize") || "A4");
  const [autoPrint, setAutoPrintRaw] = useState(() => localStorage.getItem("autoPrint") === "true");
  function setPaperSize(v) { localStorage.setItem("paperSize", v); setPaperSizeRaw(v); }
  function setAutoPrint(v) { localStorage.setItem("autoPrint", String(v)); setAutoPrintRaw(v); }
  return { paperSize, setPaperSize, autoPrint, setAutoPrint };
}

const navItems = [
  { to: "/", label: "الرئيسية", icon: Home },
  { to: "/inventory", label: "المخزون", icon: Package },
  { to: "/pos", label: "البيع", icon: ShoppingCart },
  { to: "/credit", label: "الكريديت", icon: Users },
  { to: "/reports", label: "التقارير", icon: BarChart3 },
  { to: "/assistant", label: "المساعد", icon: Sparkles },
];

const emptyProduct = {
  name: "",
  barcode: "",
  qrCode: "",
  category: "مواد أساسية",
  purchasePrice: "",
  salePrice: "",
  quantity: "",
  unit: "قطعة",
  minimumStock: "",
  expiryDate: "",
  supplier: "",
  imageUrl: "",
};

const emptyCustomer = { name: "", phone: "", address: "", notes: "", totalDebt: 0 };

function useCollection(name, sortField = "createdAt") {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const q = query(collection(db, name), orderBy(sortField, "desc"));
    return onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [name, sortField]);
  return { data, loading };
}

function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => onAuthStateChanged(auth, (current) => {
    setUser(current);
    setChecking(false);
    if (current) ensureDemoData().catch(console.error);
  }), []);

  if (checking) return <Splash />;
  if (!user) return <Login />;
  return <ProtectedApp user={user} />;
}

function ProtectedApp({ user }) {
  return (
    <div className="app-shell">
      <DesktopSidebar user={user} />
      <Routes>
        <Route path="/" element={<Dashboard user={user} />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/products/new" element={<ProductForm />} />
        <Route path="/products/:id/edit" element={<ProductForm />} />
        <Route path="/pos" element={<POS user={user} />} />
        <Route path="/invoice" element={<Invoice />} />
        <Route path="/credit" element={<CreditCustomers />} />
        <Route path="/customers/:id" element={<CustomerAccount />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  );
}

function Splash() {
  return <div className="grid min-h-screen place-items-center text-[#063f2b]">جاري تحميل متجر المواد الغذائية...</div>;
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError("تعذر تسجيل الدخول. تأكد من البريد وكلمة المرور.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center p-5">
      <form onSubmit={submit} className="card w-full max-w-md p-7">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size="lg" />
          <div>
            <h1 className="text-3xl font-black text-[#063f2b]">متجر المواد الغذائية</h1>
            <p className="mt-1 text-gray-500">تسجيل دخول صاحب المحل أو الموظف</p>
          </div>
        </div>
        {error && <div className="mb-4 rounded-2xl bg-red-50 p-3 text-red-600">{error}</div>}
        <label className="mb-2 block font-bold">البريد الإلكتروني</label>
        <input className="input mb-4 ltr text-left" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label className="mb-2 block font-bold">كلمة المرور</label>
        <input className="input mb-6 ltr text-left" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className="btn-primary h-14 w-full text-lg font-black" disabled={loading}>{loading ? "جاري الدخول..." : "تسجيل الدخول"}</button>
        <p className="mt-5 text-sm text-gray-500">فعّل Email/Password في Firebase Authentication ثم أنشئ مستخدمًا للموظف.</p>
        <div className="mt-4">
          <InstallButton />
        </div>
      </form>
    </main>
  );
}

function TopHeader({ title, back = false }) {
  const navigate = useNavigate();
  return (
    <header className="hero-header sticky top-0 z-20 px-5 py-6 lg:static lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-4">
          {back ? (
            <button onClick={() => navigate(-1)} className="glass-icon grid h-14 w-14 place-items-center rounded-full"><ArrowLeft /></button>
          ) : <Logo />}
          <h1 className="text-2xl font-black md:text-4xl">{title}</h1>
        </div>
        <div className="flex gap-3">
          <button className="glass-icon grid h-14 w-14 place-items-center rounded-full"><Search /></button>
          <button className="glass-icon relative grid h-14 w-14 place-items-center rounded-full">
            <Bell />
            <span className="absolute -top-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-orange-500 text-sm font-black">3</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function Logo({ size = "md" }) {
  const cls = size === "sm" ? "h-10 w-10" : size === "lg" ? "h-20 w-20" : "h-14 w-14";
  return <img src="/logo.png" alt="متجر المواد الغذائية" className={`${cls} object-contain drop-shadow`} />;
}

/* ─── PWA Install Hook ─── */
function usePWAInstall() {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => { setInstalled(true); setPrompt(null); });
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  async function install() {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setPrompt(null);
  }
  return { canInstall: !!prompt, install, installed };
}

function InstallButton({ compact = false }) {
  const { canInstall, install, installed } = usePWAInstall();
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;

  if (isStandalone) return null;
  if (installed) return (
    <div className={`flex items-center gap-2 rounded-2xl bg-green-50 px-4 py-2 text-sm font-bold text-[#0d6a42] ${compact ? "" : "w-full justify-center"}`}>
      <span>✅</span> التطبيق مثبت!
    </div>
  );

  if (isIOS) return (
    <div className={`${compact ? "" : "w-full"} rounded-2xl border border-[#0d6a42]/20 bg-gradient-to-r from-[#063f2b] to-[#0d6a42] p-4 text-white`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">📱</span>
        <div>
          <b className="block">تثبيت التطبيق على iOS</b>
          <p className="text-xs text-white/75">اضغط <b>مشاركة</b> ثم <b>إضافة إلى الشاشة الرئيسية</b></p>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`${compact ? "" : "w-full"}`}>
      <button
        onClick={install}
        className={`group relative overflow-hidden rounded-2xl bg-gradient-to-l from-[#063f2b] to-[#0d6a42] font-black text-white shadow-lg shadow-[#063f2b]/30 transition-all hover:shadow-xl hover:shadow-[#063f2b]/40 hover:scale-[1.02] active:scale-95 ${compact ? "flex items-center gap-2 px-5 py-3 text-sm" : "flex w-full items-center justify-center gap-3 px-6 py-4 text-lg"}`}
      >
        <span className="text-2xl">⬇️</span>
        <span>تحميل التطبيق</span>
        <span className="mr-auto rounded-full bg-white/20 px-2 py-0.5 text-xs">مجاناً</span>
        <div className="absolute inset-0 -translate-x-full bg-white/10 transition-transform duration-500 group-hover:translate-x-full" />
      </button>
      {!compact && <p className="mt-2 text-center text-xs text-gray-500">حمّل التطبيق واستخدمه بسهولة من هاتفك</p>}
    </div>
  );
}

function DesktopSidebar({ user }) {
  const location = useLocation();
  return (
    <aside className="desktop-sidebar fixed right-0 top-0 z-30 hidden h-screen w-[280px] bg-[#063f2b] p-5 text-white lg:block">
      <div className="mb-8 flex flex-col items-center gap-3 pb-5 border-b border-white/10">
        <Logo size="lg" />
        <div className="text-center">
          <b className="block text-lg">متجر المواد الغذائية</b>
          <p className="text-sm text-white/65">{user.email}</p>
        </div>
      </div>
      <nav className="space-y-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className={`flex items-center gap-3 rounded-2xl px-4 py-3 font-bold ${location.pathname === to ? "bg-white text-[#063f2b]" : "text-white/80 hover:bg-white/10"}`}>
            <Icon /> {label}
          </Link>
        ))}
      </nav>
      <div className="absolute bottom-5 right-5 left-5 space-y-2">
        <InstallButton />
        <button onClick={() => signOut(auth)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 py-3 text-white/85"><LogOut /> تسجيل الخروج</button>
      </div>
    </aside>
  );
}

function BottomNav() {
  const location = useLocation();
  return (
    <nav className="bottom-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 px-2 py-3 text-white lg:hidden">
      {navItems.map(({ to, label, icon: Icon }) => {
        const active = location.pathname === to;
        return (
          <Link key={to} to={to} className={`flex flex-col items-center gap-1 text-sm ${active ? "text-[#f7c46c]" : "text-white/85"}`}>
            <Icon fill={active ? "currentColor" : "none"} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Page({ title, children, back = false }) {
  return (
    <>
      <TopHeader title={title} back={back} />
      <main className="mx-auto max-w-7xl p-4 md:p-8">{children}</main>
    </>
  );
}

function qrValue(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  try {
    const parsed = JSON.parse(text);
    return String(parsed.barcode || parsed.qrCode || parsed.code || parsed.productId || text).trim();
  } catch {
    const queryValue = text.match(/(?:barcode|qr|code|product)=([^&\s]+)/i)?.[1];
    return decodeURIComponent(queryValue || text.replace(/^product:/i, "")).trim();
  }
}

function findProductByQr(products, raw) {
  const code = qrValue(raw);
  return products.find((p) => [p.barcode, p.qrCode, p.id].filter(Boolean).some((value) => String(value).trim() === code));
}

function QrScannerModal({ title, description, close, onScan }) {
  const videoRef = useRef(null);
  const manualRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const scannedRef = useRef(false);
  const [manual, setManual] = useState("");
  const [status, setStatus] = useState("جاري تشغيل الكاميرا...");

  useEffect(() => {
    manualRef.current?.focus();
  }, []);

  useEffect(() => {
    let active = true;
    async function start() {
      try {
        if (!("BarcodeDetector" in window)) {
          setStatus("المتصفح لا يدعم المسح بالكاميرا. أدخل رمز QR يدويًا.");
          return;
        }
        const detector = new window.BarcodeDetector({
          formats: ["qr_code", "ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e"],
        });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        streamRef.current = stream;
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus("وجّه الكاميرا إلى رمز QR الخاص بالمنتج");
        const scan = async () => {
          if (!active || scannedRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length) {
              scannedRef.current = true;
              onScan(codes[0].rawValue);
              close();
              return;
            }
          } catch {
            setStatus("تعذر قراءة الصورة، جرّب تقريب الكاميرا من الرمز");
          }
          rafRef.current = requestAnimationFrame(scan);
        };
        scan();
      } catch {
        setStatus("لم نتمكن من فتح الكاميرا. تأكد من منح الإذن أو أدخل الرمز يدويًا.");
      }
    }
    start();
    return () => {
      active = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [close, onScan]);

  function submitManual(e) {
    e.preventDefault();
    if (!manual.trim()) return;
    onScan(manual);
    close();
  }

  return (
    <Modal title={title} close={close}>
      <div className="space-y-4">
        <p className="text-gray-600">{description}</p>
        <div className="soft-card flex items-center gap-3 p-3 text-[#0d6a42]">
          <Camera />
          <span className="font-bold">يمكنك استخدام الكاميرا أو تمرير المنتج على ماسح QR/Barcode وسيتم إدخال الرمز تلقائيًا.</span>
        </div>
        <div className="overflow-hidden rounded-3xl border bg-black">
          <video ref={videoRef} className="h-72 w-full object-cover" muted playsInline />
        </div>
        <p className="rounded-2xl bg-green-50 p-3 text-center font-bold text-[#0d6a42]">{status}</p>
        <form onSubmit={submitManual} className="grid gap-3 md:grid-cols-[1fr_140px]">
          <input ref={manualRef} className="input ltr text-left" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="QR / Barcode" />
          <button className="btn-primary h-12 font-black">إدخال</button>
        </form>
      </div>
    </Modal>
  );
}

function ProductQrPreview({ code, name }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!code) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSrc("");
      return;
    }
    QRCode.toDataURL(JSON.stringify({ type: "product", barcode: code, name }), {
      margin: 1,
      width: 190,
      color: { dark: "#063f2b", light: "#ffffff" },
    }).then(setSrc).catch(() => setSrc(""));
  }, [code, name]);

  if (!code) {
    return <div className="grid h-48 place-items-center rounded-3xl bg-gray-50 text-gray-400">سيظهر QR بعد إدخال الباركود</div>;
  }
  return (
    <div className="rounded-3xl border bg-white p-4 text-center">
      {src && <img src={src} alt="QR" className="mx-auto h-44 w-44" />}
      <b className="mt-2 block text-[#063f2b]">QR المنتج</b>
      <p className="ltr text-sm text-gray-500">{code}</p>
    </div>
  );
}

function ReceiveStockModal({ product, close }) {
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await receiveProductStock({ productId: product.id, productName: product.name, quantity, note });
      close();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="استلام مخزون عبر QR" close={close}>
      <form onSubmit={submit} className="space-y-4">
        <div className="soft-card flex items-center gap-3 p-3">
          <ProductImage p={product} />
          <div>
            <b>{product.name}</b>
            <p className="text-gray-500">الكمية الحالية: {product.quantity} {product.unit}</p>
          </div>
        </div>
        <Field label="الكمية الداخلة للمخزون" type="number" value={quantity} onChange={setQuantity} required />
        <Field label="ملاحظة اختيارية" value={note} onChange={setNote} />
        <button className="btn-primary h-14 w-full font-black" disabled={saving}>
          <PackageCheck className="inline" /> {saving ? "جاري الاستلام..." : "إضافة الكمية للمخزون"}
        </button>
      </form>
    </Modal>
  );
}

function Dashboard() {
  const { data: products } = useCollection("products");
  const { data: sales } = useCollection("sales");
  const { data: customers } = useCollection("customers");
  const { data: activity } = useCollection("activityLogs");
  const low = products.filter((p) => Number(p.quantity) <= Number(p.minimumStock));

  const todaySales = sales.filter((sale) => {
    const saleDate = sale.createdAt?.toDate?.() || new Date(sale.createdAt);
    const today = new Date();
    return saleDate.toDateString() === today.toDateString();
  }).reduce((s, sale) => s + Number(sale.total || 0), 0);

  const debt = customers.reduce((s, c) => s + Number(c.totalDebt || 0), 0);

  const chart = ["6 ص", "9 ص", "12 م", "3 م", "6 م", "9 م"].map((time, i) => ({ time, value: [0, 450, 920, 1580, 1200, todaySales][i] }));

  return (
    <Page title="متجر المواد الغذائية">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 no-print">
        <InstallButton compact />
        <button onClick={() => signOut(auth)} className="btn-ghost hidden items-center gap-2 px-5 py-3 lg:flex"><LogOut size={18} /> خروج</button>
      </div>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Package} title="المخزون" value={number(products.length)} unit="منتج" hint="محدث اليوم" />
        <Stat icon={BarChart3} title="مبيعات اليوم" value={number(todaySales)} unit="دج" hint="+12% عن أمس" />
        <Stat icon={User} title="الكريديت" value={number(debt)} unit="دج" hint={`${customers.filter((c) => c.totalDebt > 0).length} زبائن لديهم مستحقات`} tone="orange" />
        <Stat icon={AlertTriangle} title="منتجات قليلة المخزون" value={number(low.length)} unit="منتج" hint="تحتاج إعادة طلب" tone="red" />
      </section>

      <section className="card mt-6 p-5">
        <h2 className="mb-5 text-2xl font-black">إجراءات سريعة</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <Quick to="/pos" icon={ShoppingCart} label="بيع جديد" />
          <Quick to="/products/new" icon={PackagePlus} label="إضافة منتج" />
          <Quick to="/credit" icon={Users} label="زبائن الكريديت" accent />
          <Quick to="/reports" icon={FileText} label="التقارير" warm />
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_.9fr]">
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-black">مبيعات اليوم</h2>
            <span className="badge badge-green">{money(todaySales)}</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <defs><linearGradient id="sales" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0d6a42" stopOpacity={0.28} /><stop offset="95%" stopColor="#0d6a42" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" /><YAxis /><Tooltip formatter={(v) => money(v)} />
                <Area type="monotone" dataKey="value" stroke="#0d6a42" fill="url(#sales)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <ActivityList items={activity} low={low} />
      </div>

    </Page>
  );
}

function ResetDailySalesModal({ close }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleReset() {
    setLoading(true);
    try {
      await resetDailySales();
      setDone(true);
    } catch (err) {
      alert("حدث خطأ: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  if (done) return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-7 text-center">
        <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-green-50 text-[#0d6a42]"><CheckCircle2 size={44} /></div>
        <h2 className="text-2xl font-black">تمت إعادة التعيين بنجاح</h2>
        <p className="mt-2 text-gray-500">تم حذف جميع مبيعات اليوم وإعادة عداد المبيعات اليومية إلى الصفر.</p>
        <button onClick={close} className="btn-primary mt-6 h-13 w-full font-black">إغلاق</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-7">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-2xl font-black text-orange-700"><RotateCcw className="text-orange-500" /> تأكيد</h2>
          <button onClick={close} className="grid h-10 w-10 place-items-center rounded-full bg-gray-100"><X /></button>
        </div>

        <div className="mb-5 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm">
          <p className="mb-2 font-black text-orange-700">سيتم حذف:</p>
          <ul className="space-y-1 text-orange-600">
            <li>❌ جميع مبيعات اليوم فقط</li>
            <li>❌ إعادة عداد مبيعات اليوم إلى الصفر</li>
          </ul>
          <p className="mt-3 font-bold text-blue-700">ℹ️ جميع البيانات الأخرى تبقى سليمة</p>
        </div>

        <div className="mb-5 rounded-2xl bg-orange-100 p-3 text-sm font-bold text-orange-700">
          هل أنت متأكد من رغبتك في إعادة تعيين مبيعات اليوم؟
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={close}
            className="h-12 rounded-2xl border-2 border-gray-300 font-black text-gray-700 transition hover:bg-gray-50 active:scale-95"
          >
            إلغاء
          </button>
          <button
            onClick={handleReset}
            disabled={loading}
            className={`h-12 rounded-2xl font-black text-white transition ${loading ? "cursor-not-allowed bg-gray-300 text-gray-500" : "bg-orange-600 hover:bg-orange-700 active:scale-95"}`}
          >
            {loading ? "جاري الحذف..." : "تأكيد الحذف"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetDataModal({ close }) {
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const ready = confirm.trim() === "تأكيد";

  async function handleReset() {
    if (!ready) return;
    setLoading(true);
    try {
      await resetData();
      setDone(true);
    } catch (err) {
      alert("حدث خطأ: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  if (done) return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-7 text-center">
        <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-green-50 text-[#0d6a42]"><CheckCircle2 size={44} /></div>
        <h2 className="text-2xl font-black">تمت إعادة التعيين بنجاح</h2>
        <p className="mt-2 text-gray-500">تم حذف المبيعات والمدفوعات وسجلات النشاط وجميع المنتجات. بيانات الزبائن سليمة.</p>
        <button onClick={close} className="btn-primary mt-6 h-13 w-full font-black">إغلاق</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-7">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-2xl font-black text-red-700"><AlertTriangle className="text-red-500" /> تحذير</h2>
          <button onClick={close} className="grid h-10 w-10 place-items-center rounded-full bg-gray-100"><X /></button>
        </div>

        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm">
          <p className="mb-2 font-black text-red-700">سيتم حذف وتصفير نهائياً غير قابل للتراجع:</p>
          <ul className="space-y-1 text-red-600">
            <li>❌ جميع سجلات المبيعات</li>
            <li>❌ جميع سجلات المدفوعات</li>
            <li>❌ سجلات نشاط النظام</li>
            <li>❌ جميع المنتجات</li>
          </ul>
          <p className="mt-3 font-bold text-green-700">✅ بيانات الزبائن وديونهم تبقى سليمة</p>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-bold">اكتب <span className="rounded bg-red-100 px-2 py-0.5 font-mono text-red-700">تأكيد</span> للمتابعة:</span>
          <input
            className="input text-center font-black tracking-widest"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="تأكيد"
            autoFocus
          />
        </label>

        <button
          onClick={handleReset}
          disabled={!ready || loading}
          className={`mt-5 h-14 w-full rounded-2xl font-black text-white transition ${ready ? "bg-red-600 hover:bg-red-700 active:scale-95" : "cursor-not-allowed bg-gray-300 text-gray-500"}`}
        >
          {loading ? "جاري إعادة التعيين..." : "إعادة تعيين البيانات نهائياً"}
        </button>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, title, value, unit, hint, tone = "green" }) {
  const toneClass = tone === "red" ? "bg-red-50 text-red-600" : tone === "orange" ? "bg-orange-50 text-orange-600" : "bg-green-50 text-[#0d6a42]";
  return (
    <div className="card p-6">
      <div className={`mb-5 grid h-16 w-16 place-items-center rounded-2xl ${toneClass}`}><Icon /></div>
      <h3 className="text-xl font-black">{title}</h3>
      <div className="mt-2 text-4xl font-black">{value}</div>
      <p className="mt-1 text-lg text-gray-600">{unit}</p>
      <p className={`mt-4 font-bold ${tone === "red" ? "text-red-600" : tone === "orange" ? "text-orange-600" : "text-[#0d6a42]"}`}>{hint}</p>
    </div>
  );
}

function Quick({ to, icon: Icon, label, accent, warm }) {
  return (
    <Link to={to} className={`soft-card flex items-center justify-center gap-3 p-6 text-xl font-bold ${accent ? "border-orange-200 bg-orange-50" : warm ? "text-amber-700" : "text-[#063f2b]"}`}>
      <Icon size={34} /> {label}
    </Link>
  );
}

function ActivityList({ items, low }) {
  const fallback = [
    { id: "a", title: "تمت عملية بيع", description: "فاتورة جديدة", type: "sale" },
    { id: "b", title: "إضافة منتج جديد", description: "SKU: 100245", type: "product" },
    { id: "c", title: "تم سداد دفعة", description: "رصيد كريديت محدث", type: "payment" },
  ];
  return (
    <section className="card p-5">
      <h2 className="mb-4 text-2xl font-black">النشاط الأخير</h2>
      {[...items.slice(0, 5), ...low.slice(0, 2).map((p) => ({ id: p.id, type: "stock", title: "تنبيه نقص المخزون", description: `${p.name}: الكمية المتبقية ${p.quantity}` }))].concat(items.length ? [] : fallback).slice(0, 6).map((item) => (
        <div key={item.id} className="table-row flex items-center gap-4 py-4">
          <div className={`grid h-12 w-12 place-items-center rounded-full ${item.type === "stock" ? "bg-red-50 text-red-600" : item.type === "payment" ? "bg-orange-50 text-orange-600" : "bg-green-50 text-[#0d6a42]"}`}>
            {item.type === "stock" ? <AlertTriangle /> : item.type === "payment" ? <WalletCards /> : <ShoppingCart />}
          </div>
          <div className="min-w-0 flex-1"><b>{item.title}</b><p className="truncate text-gray-500">{item.description}</p></div>
        </div>
      ))}
    </section>
  );
}

function Inventory() {
  const navigate = useNavigate();
  const { data: products } = useCollection("products");
  const [search, setSearch] = useState("");
  const [stockQrInput, setStockQrInput] = useState("");
  const [cat, setCat] = useState("كل المنتجات");
  const [scanner, setScanner] = useState(false);
  const [receiving, setReceiving] = useState(null);
  const filtered = products.filter((p) => (cat === "كل المنتجات" || p.category === cat) && `${p.name} ${p.barcode} ${p.qrCode || ""}`.includes(search));
  const low = products.filter((p) => Number(p.quantity) <= Number(p.minimumStock));

  function handleStockQr(raw) {
    const code = qrValue(raw);
    const product = findProductByQr(products, raw);
    if (product) {
      beep();
      setReceiving(product);
      return;
    }
    if (confirm("هذا الرمز غير مسجل في المخزون. هل تريد إضافة منتج جديد بهذا QR؟")) {
      navigate(`/products/new?barcode=${encodeURIComponent(code)}`);
    }
  }

  function submitStockQr(e) {
    e.preventDefault();
    if (!stockQrInput.trim()) return;
    handleStockQr(stockQrInput);
    setStockQrInput("");
  }

  return (
    <Page title="المخزون">
      <section className="mb-6 grid gap-4 md:grid-cols-[1fr_190px_220px]">
        <div className="relative"><Search className="absolute left-4 top-3.5 text-gray-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} className="input pr-5 pl-12" placeholder="ابحث عن منتج، باركود أو فئة..." /></div>
        <button onClick={() => setScanner(true)} className="btn-ghost flex h-14 items-center justify-center gap-2 font-black text-[#0d6a42]"><QrCode /> استلام QR</button>
        <Link to="/products/new" className="btn-primary flex h-14 items-center justify-center gap-2 font-black"><PackagePlus /> إضافة منتج</Link>
      </section>
      <form onSubmit={submitStockQr} className="card mb-6 grid gap-3 p-4 md:grid-cols-[220px_1fr_150px] md:items-end">
        <div className="flex items-center gap-2 text-[#0d6a42]"><ScanBarcode /><b>ماسح QR للمخزون</b></div>
        <input className="input ltr text-left" value={stockQrInput} onChange={(e) => setStockQrInput(e.target.value)} placeholder="مرر المنتج على الماسح أو الصق الكود هنا ثم Enter" />
        <button className="btn-primary h-12 font-black">استلام</button>
      </form>
      <div className="mb-6 flex gap-3 overflow-auto pb-2">
        {["كل المنتجات", ...categories].map((item) => <button key={item} onClick={() => setCat(item)} className={`shrink-0 rounded-2xl border px-5 py-3 font-bold ${cat === item ? "btn-primary" : "bg-white"}`}>{item}</button>)}
      </div>
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between p-5"><h2 className="text-2xl font-black">قائمة المنتجات</h2><span className="text-gray-500">{number(filtered.length)} منتجات</span></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-right">
            <thead className="bg-gray-50"><tr>{["اسم المنتج", "الباركود", "الكمية", "سعر الشراء", "سعر البيع", "الفئة", "الإجراءات"].map((h) => <th key={h} className="p-4">{h}</th>)}</tr></thead>
            <tbody>{filtered.map((p) => <ProductRow key={p.id} product={p} />)}</tbody>
          </table>
        </div>
      </section>
      <section className="card mt-6 border-red-100 bg-red-50/25 p-5">
        <div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 text-2xl font-black"><Bell className="text-orange-500" /> تنبيه المخزون</h2><span className="badge badge-red">{low.length} منتجات</span></div>
        <div className="divide-y divide-red-100">{low.map((p) => <div key={p.id} className="flex items-center justify-between py-3"><b>{p.name}</b><span className="text-red-600">الكمية الحالية: {p.quantity} {p.unit} - الحد الأدنى: {p.minimumStock}</span></div>)}</div>
      </section>
      {scanner && <QrScannerModal title="استلام منتج عبر QR" description="امسح QR المنتج عند دخوله للمخزون، ثم أدخل الكمية المستلمة." close={() => setScanner(false)} onScan={handleStockQr} />}
      {receiving && <ReceiveStockModal product={receiving} close={() => setReceiving(null)} />}
    </Page>
  );
}

function ProductRow({ product }) {
  const state = Number(product.quantity) <= 0 ? ["نفد من المخزون", "badge-red"] : Number(product.quantity) <= Number(product.minimumStock) ? ["كمية منخفضة", "badge-orange"] : ["متوفر", "badge-green"];
  return (
    <tr className="table-row">
      <td className="p-4"><div className="flex items-center gap-3"><ProductImage p={product} /><div><b>{product.name}</b><p><span className={`badge ${state[1]}`}>{state[0]}</span></p></div></div></td>
      <td className="p-4 text-gray-600">{product.barcode}</td>
      <td className="p-4 font-black text-[#0d6a42]">{product.quantity} {product.unit}</td>
      <td className="p-4">{money(product.purchasePrice)}</td>
      <td className="p-4">{money(product.salePrice)}</td>
      <td className="p-4">{product.category}</td>
      <td className="p-4"><div className="flex gap-2"><Link to={`/products/${product.id}/edit`} className="grid h-10 w-10 place-items-center rounded-xl bg-green-50 text-[#0d6a42]"><Edit3 size={18} /></Link><button onClick={() => confirm("حذف المنتج؟") && deleteProduct(product.id)} className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-600"><Trash2 size={18} /></button></div></td>
    </tr>
  );
}

function ProductImage({ p, className = "h-16 w-16" }) {
  return p.imageUrl ? <img src={p.imageUrl} alt={p.name} className={`${className} rounded-2xl border object-cover`} /> : <div className={`${className} grid place-items-center rounded-2xl bg-green-50 text-[#0d6a42]`}><Package /></div>;
}

function ProductForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: products } = useCollection("products");
  const editing = products.find((p) => p.id === id);
  const [form, setForm] = useState(emptyProduct);
  const [file, setFile] = useState(null);
  const [scanner, setScanner] = useState(false);
  const [saving, setSaving] = useState(false);

  // Firestore data arrives after the route renders, so the edit form is hydrated once the product is found.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (editing) setForm({ ...emptyProduct, ...editing }); }, [editing]);
  useEffect(() => {
    const barcode = searchParams.get("barcode");
    if (!id && barcode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm((current) => ({ ...current, barcode, qrCode: barcode }));
    }
  }, [id, searchParams]);
  const preview = file ? URL.createObjectURL(file) : form.imageUrl;

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    await saveProduct(form, file, id);
    setSaving(false);
    navigate("/inventory");
  }

  return (
    <Page title={id ? "تعديل منتج" : "إضافة منتج"} back>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_.8fr]">
        <form onSubmit={submit} className="card p-6">
          <label className="mb-4 grid min-h-44 place-items-center rounded-3xl border border-dashed border-gray-300 bg-white text-center text-gray-500">
            <UploadCloud className="mx-auto mb-2 text-[#0d6a42]" size={38} />
            <span>اسحب الصورة هنا أو اضغط للاختيار</span><small>JPG, PNG حتى 2MB</small>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0])} />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="اسم المنتج *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <div>
              <Field label="الباركود / QR *" value={form.barcode} onChange={(v) => setForm({ ...form, barcode: v, qrCode: v })} required />
              <button type="button" onClick={() => setScanner(true)} className="btn-ghost mt-2 flex h-11 w-full items-center justify-center gap-2 font-bold text-[#0d6a42]">
                <ScanBarcode size={18} /> مسح QR المنتج
              </button>
            </div>
            <Select label="الفئة *" value={form.category} options={categories} onChange={(v) => setForm({ ...form, category: v })} />
            <Field label="سعر الشراء (دج) *" type="number" value={form.purchasePrice} onChange={(v) => setForm({ ...form, purchasePrice: v })} required />
            <Field label="سعر البيع (دج) *" type="number" value={form.salePrice} onChange={(v) => setForm({ ...form, salePrice: v })} required />
            <Field label="الكمية *" type="number" value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} required />
            <Select label="الوحدة *" value={form.unit} options={units} onChange={(v) => setForm({ ...form, unit: v })} />
            <Field label="الحد الأدنى للمخزون *" type="number" value={form.minimumStock} onChange={(v) => setForm({ ...form, minimumStock: v })} required />
            <Field label="تاريخ الانتهاء (اختياري)" type="date" value={form.expiryDate || ""} onChange={(v) => setForm({ ...form, expiryDate: v })} />
            <Field label="المورد (اختياري)" value={form.supplier || ""} onChange={(v) => setForm({ ...form, supplier: v })} />
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2"><button className="btn-primary h-14 font-black">{saving ? "جاري الحفظ..." : "حفظ المنتج"}</button><button type="button" onClick={() => navigate("/inventory")} className="btn-ghost h-14 font-black text-orange-600">إلغاء</button></div>
        </form>
        <aside className="card p-6">
          <h2 className="mb-5 text-center text-2xl font-black">معاينة المنتج</h2>
          <div className="soft-card p-6 text-center">{preview ? <img src={preview} alt="" className="mx-auto mb-4 h-52 rounded-3xl object-cover" /> : <ProductImage p={form} className="mx-auto mb-4 h-52 w-52" />}<h3 className="text-2xl font-black">{form.name || "أرز بسمتي 5 كيلو"}</h3><span className="badge badge-green mt-3">{form.category}</span></div>
          <div className="mt-5"><ProductQrPreview code={form.qrCode || form.barcode} name={form.name} /></div>
          <dl className="mt-5 divide-y">{[["الباركود", form.barcode], ["سعر الشراء", money(form.purchasePrice)], ["سعر البيع", money(form.salePrice)], ["الكمية", form.quantity], ["الوحدة", form.unit], ["تاريخ الانتهاء", form.expiryDate], ["المورد", form.supplier]].map(([k, v]) => <div key={k} className="flex justify-between py-3"><dt className="text-[#0d6a42]">{k}</dt><dd>{v || "-"}</dd></div>)}</dl>
        </aside>
      </div>
      {scanner && <QrScannerModal title="مسح QR المنتج" description="امسح رمز المنتج ليتم تعبئة الباركود وربط QR بهذا المنتج." close={() => setScanner(false)} onScan={(raw) => {
        const code = qrValue(raw);
        setForm((current) => ({ ...current, barcode: code, qrCode: code }));
      }} />}
    </Page>
  );
}

function Field({ label, value, onChange, type = "text", required }) {
  return <label className="block"><span className="mb-2 block font-bold">{label}</span><input className="input" type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} /></label>;
}

function Select({ label, value, options, onChange }) {
  return <label className="block"><span className="mb-2 block font-bold">{label}</span><select className="input" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o}>{o}</option>)}</select></label>;
}

function POS({ user }) {
  const navigate = useNavigate();
  const { data: products } = useCollection("products");
  const { data: customers } = useCollection("customers");
  const { paperSize, setPaperSize, autoPrint, setAutoPrint } = usePrintSettings();
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [saleQrInput, setSaleQrInput] = useState("");
  const [scanner, setScanner] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [customerId, setCustomerId] = useState("");
  const filtered = products.filter((p) => Number(p.quantity) > 0 && `${p.name} ${p.barcode} ${p.qrCode || ""}`.includes(search)).slice(0, 12);
  const subtotal = cart.reduce((s, i) => s + i.salePrice * i.cartQty, 0);
  const total = Math.max(0, subtotal - Number(discount || 0));
  const customer = customers.find((c) => c.id === customerId);

  function add(product) {
    setCart((old) => old.some((i) => i.id === product.id) ? old.map((i) => i.id === product.id ? { ...i, cartQty: Math.min(i.cartQty + 1, product.quantity) } : i) : [{ ...product, cartQty: 1 }, ...old]);
  }
  function qty(id, delta) {
    setCart((old) => old.map((i) => i.id === id ? { ...i, cartQty: Math.max(1, Math.min(i.quantity, i.cartQty + delta)) } : i));
  }
  async function finish() {
    try {
      const sale = await createSale({ cart, discount, paymentMethod, customer, cashierId: user.uid });
      sessionStorage.setItem("lastInvoice", JSON.stringify({ ...sale, cashierName: user.email, paperSize }));
      if (autoPrint) {
        sessionStorage.setItem("triggerPrint", "1");
      }
      navigate("/invoice");
    } catch (e) { alert(e.message); }
  }
  function handleSaleQr(raw) {
    const code = qrValue(raw);
    const product = findProductByQr(products, raw);
    if (!product) {
      setSearch(code);
      alert("لم يتم العثور على منتج بهذا QR في المخزون");
      return;
    }
    if (Number(product.quantity) <= 0) {
      alert("هذا المنتج نفد من المخزون");
      return;
    }
    beep();
    add(product);
  }
  function submitSaleQr(e) {
    e.preventDefault();
    if (!saleQrInput.trim()) return;
    handleSaleQr(saleQrInput);
    setSaleQrInput("");
  }

  return (
    <Page title="نقطة البيع">
      {/* ─── شريط إعدادات الطباعة ─── */}
      <div className="no-print mb-4 flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-3">
        <Printer size={18} className="text-[#0d6a42]" />
        <b className="text-sm">إعدادات الطباعة:</b>
        <label className="flex items-center gap-2 text-sm">
          <span>حجم الورق:</span>
          <select className="rounded-xl border px-3 py-1.5 text-sm" value={paperSize} onChange={(e) => setPaperSize(e.target.value)}>
            <option value="A4">A4 عادي</option>
            <option value="80">80mm حراري</option>
            <option value="58">58mm حراري</option>
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={autoPrint} onChange={(e) => setAutoPrint(e.target.checked)} className="h-4 w-4 accent-[#0d6a42]" />
          طباعة تلقائية بعد البيع
        </label>
        <span className="mr-auto rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-[#0d6a42]">💡 الماسح الضوئي يعمل في حقل QR تلقائياً</span>
      </div>
      <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
        <section className="card order-2 p-4 xl:order-1">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-black">سلة المشتريات</h2><button onClick={() => setCart([])} className="grid h-11 w-11 place-items-center rounded-xl bg-red-50 text-red-600"><Trash2 /></button></div>
          <div className="space-y-3">{cart.map((item) => <div key={item.id} className="soft-card flex items-center gap-3 p-3"><ProductImage p={item} /><div className="flex-1"><b>{item.name}</b><p className="text-gray-500">{money(item.salePrice)}</p></div><div className="flex items-center rounded-xl bg-green-50"><button onClick={() => qty(item.id, -1)} className="px-3 py-2">-</button><b className="px-3">{item.cartQty}</b><button onClick={() => qty(item.id, 1)} className="px-3 py-2">+</button></div></div>)}</div>
          <label className="mt-4 block"><span className="mb-2 block font-bold">الخصم</span><input className="input" type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} /></label>
          <div className="my-4 rounded-3xl bg-white p-4"><Row label="المجموع الفرعي" value={money(subtotal)} /><Row label="الخصم" value={money(discount)} good /><Row label="الإجمالي" value={money(total)} strong /></div>
          <h3 className="mb-3 text-xl font-black">طريقة الدفع</h3>
          <div className="grid grid-cols-2 gap-3"><button onClick={() => setPaymentMethod("cash")} className={`btn-ghost h-14 ${paymentMethod === "cash" ? "border-[#0d6a42] text-[#0d6a42]" : ""}`}><Banknote className="inline" /> نقدًا</button><button onClick={() => setPaymentMethod("credit")} className={`btn-ghost h-14 ${paymentMethod === "credit" ? "border-[#0d6a42] text-[#0d6a42]" : ""}`}><CreditCard className="inline" /> كريديت</button></div>
          {paymentMethod === "credit" && <select className="input mt-4" value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">اختر الزبون</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name} - دين: {money(c.totalDebt)}</option>)}</select>}
          <button onClick={finish} className="btn-primary mt-5 h-16 w-full text-xl font-black"><CreditCard className="inline" /> إتمام البيع</button>
          <button onClick={() => window.print()} className="btn-ghost mt-3 h-14 w-full font-black text-[#0d6a42]"><Printer className="inline" /> طباعة الفاتورة</button>
        </section>
        <section className="card order-1 p-5 xl:order-2">
          <div className="mb-6 flex gap-2"><button onClick={() => setScanner(true)} className="btn-ghost grid h-14 w-16 place-items-center text-[#0d6a42]" title="مسح QR للبيع"><ScanBarcode /></button><input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن منتج أو امسح QR..." /></div>
          <form onSubmit={submitSaleQr} className="mb-6 grid gap-3 rounded-3xl border bg-green-50/40 p-3 md:grid-cols-[1fr_130px]">
            <input className="input ltr text-left" value={saleQrInput} onChange={(e) => setSaleQrInput(e.target.value)} placeholder="مدخل ماسح QR / Barcode للبيع" />
            <button className="btn-primary h-12 font-black">إضافة</button>
          </form>
          <h2 className="mb-4 text-2xl font-black">منتجات شائعة</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{filtered.map((p) => <button key={p.id} onClick={() => add(p)} className="soft-card relative p-4 text-center"><ProductImage p={p} className="mx-auto h-24 w-24" /><b className="mt-3 block">{p.name}</b><p className="text-gray-500">{p.unit}</p><p className="mt-2 text-xl font-black">{money(p.salePrice)}</p><span className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-green-50 text-[#0d6a42]">+</span></button>)}</div>
        </section>
      </div>
      {scanner && <QrScannerModal title="بيع منتج عبر QR" description="امسح QR المنتج ليُضاف مباشرة إلى سلة البيع، ثم يتم إنقاصه من المخزون عند إتمام البيع." close={() => setScanner(false)} onScan={handleSaleQr} />}
    </Page>
  );
}

function Row({ label, value, strong, good }) {
  return <div className={`flex justify-between py-2 ${strong ? "text-2xl font-black" : ""}`}><span>{label}</span><b className={good ? "text-[#0d6a42]" : ""}>{value}</b></div>;
}

function Invoice() {
  const invoice = JSON.parse(sessionStorage.getItem("lastInvoice") || "null");
  const paperSize = invoice?.paperSize || "A4";
  const isNarrow = paperSize === "58" || paperSize === "80";

  // طباعة تلقائية
  useEffect(() => {
    if (sessionStorage.getItem("triggerPrint") === "1") {
      sessionStorage.removeItem("triggerPrint");
      if (isNarrow) document.body.classList.add(`receipt-${paperSize}`);
      const timer = setTimeout(() => {
        window.print();
        document.body.classList.remove(`receipt-58`, `receipt-80`);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, []);

  function handlePrint() {
    if (isNarrow) document.body.classList.add(`receipt-${paperSize}`);
    window.print();
    document.body.classList.remove(`receipt-58`, `receipt-80`);
  }

  if (!invoice) return <Page title="فاتورة البيع"><div className="card p-8 text-center">لا توجد فاتورة حديثة.</div></Page>;

  return (
    <Page title="فاتورة البيع">
      <div className="no-print mb-5 rounded-3xl border border-green-100 bg-green-50 p-5 text-center text-xl font-bold text-[#0d6a42]">
        <CheckCircle2 className="inline" /> تمت عملية البيع بنجاح
      </div>

      {/* ─── الإيصال — يظهر للشاشة والطباعة معاً ─── */}
      <section className="receipt-page card mx-auto max-w-5xl p-6">

        {/* رأس الإيصال */}
        <div className="receipt-logo flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Logo />
            <div>
              <h2 className="text-3xl font-black">متجر المواد الغذائية</h2>
              <p className="text-gray-500">أفضل جودة.. أسعار منافسة</p>
            </div>
          </div>
          <div className="text-left">
            <p>رقم الفاتورة</p>
            <b className="text-2xl text-[#0d6a42]">#{invoice.invoiceNumber}</b>
            <p>{dateTime(invoice.createdAt)}</p>
          </div>
        </div>

        {/* رأس مختصر للطباعة الحرارية */}
        <div className="hidden text-center" style={{display: isNarrow ? undefined : "none"}}>
          <b className="block text-base">متجر المواد الغذائية</b>
          <p className="text-xs">أفضل جودة.. أسعار منافسة</p>
          <div className="receipt-divider" />
          <p className="text-xs">رقم الفاتورة: <b>#{invoice.invoiceNumber}</b></p>
          <p className="text-xs">{dateTime(invoice.createdAt)}</p>
        </div>

        <div className="receipt-divider my-4 border-t border-dashed border-gray-300" />

        {/* معلومات البيع */}
        <div className="my-4 grid gap-3 rounded-3xl border p-4 md:grid-cols-3">
          <Info label="الكاشير" value={invoice.cashierName} />
          <Info label="نوع البيع" value={invoice.paymentMethod === "cash" ? "نقدي" : "كريديت"} />
          <Info label="العميل" value={invoice.customerName || "عميل نقدي"} />
        </div>

        <div className="receipt-divider my-2 border-t border-dashed border-gray-300" />

        {/* جدول المنتجات */}
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50">
              <tr>
                {["#", "المنتج", "الكمية", "السعر", "الإجمالي"].map((h) => <th className="p-3" key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((i, idx) => (
                <tr key={idx} className="table-row">
                  <td className="p-3">{idx + 1}</td>
                  <td className="p-3">{i.name}</td>
                  <td className="p-3">{i.quantity} {i.unit}</td>
                  <td className="p-3">{money(i.salePrice)}</td>
                  <td className="p-3 font-bold">{money(i.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="receipt-divider my-2 border-t border-dashed border-gray-300" />

        {/* المجاميع */}
        <div className="rounded-3xl border p-4">
          <Row label="المجموع الفرعي" value={money(invoice.subtotal)} />
          {Number(invoice.discount) > 0 && <Row label="الخصم" value={money(invoice.discount)} good />}
          <div className="receipt-total"><Row label="الإجمالي" value={money(invoice.total)} strong /></div>
          {invoice.paymentMethod === "cash" && <Row label="المدفوع" value={money(invoice.paidAmount)} />}
          {invoice.paymentMethod === "credit" && <Row label="مستحق (كريديت)" value={money(invoice.remainingAmount)} />}
        </div>

        <div className="receipt-footer my-3 text-center text-sm text-gray-500">
          شكراً لتعاملكم معنا 🌿
        </div>

        {/* أزرار الإجراءات */}
        <div className="no-print mt-5 grid gap-3 md:grid-cols-3">
          <button onClick={handlePrint} className="btn-primary h-14 font-black">
            <Printer className="inline" /> طباعة {isNarrow ? `(${paperSize}mm)` : ""}
          </button>
          <button onClick={() => navigator.share?.({ title: "فاتورة", text: `فاتورة #${invoice.invoiceNumber} - الإجمالي: ${money(invoice.total)}` })} className="btn-ghost h-14 font-black text-[#0d6a42]">
            <Share2 className="inline" /> مشاركة
          </button>
          <button onClick={() => window.history.back()} className="btn-ghost h-14 font-black">
            <ArrowLeft className="inline" /> رجوع
          </button>
        </div>
      </section>
    </Page>
  );
}

function Info({ label, value }) {
  return <div><p className="text-gray-500">{label}</p><b>{value}</b></div>;
}

function CreditCustomers() {
  const { data: customers } = useCollection("customers");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const totalDebt = customers.reduce((s, c) => s + Number(c.totalDebt || 0), 0);
  const filtered = customers.filter((c) => `${c.name} ${c.phone}`.includes(search));

  return (
    <Page title="زبائن الكريديت">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-3xl font-black">زبائن الكريديت</h2><p className="text-gray-500">عرض وإدارة حسابات الزبائن بنظام الكريديت</p></div><button onClick={() => setModal({ type: "customer" })} className="btn-primary h-14 px-6 font-black"><BadgePlus className="inline" /> إضافة زبون</button></div>
      <input className="input mb-6" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن زبون بالاسم أو رقم الجوال..." />
      <section className="card mb-6 p-5"><div className="grid gap-3 md:grid-cols-4"><StatMini icon={WalletCards} title="إجمالي الديون" value={money(totalDebt)} /><StatMini icon={Users} title="إجمالي الزبائن" value={customers.length} /><StatMini icon={Calendar} title="متأخر" value={customers.filter((c) => c.totalDebt > 700).length} red /><StatMini icon={CreditCard} title="مدفوع جزئيًا" value={customers.filter((c) => c.totalDebt > 0 && c.totalDebt <= 700).length} orange /></div></section>
      <section className="card overflow-hidden">
        <h2 className="p-5 text-2xl font-black">قائمة الزبائن</h2>
        {filtered.map((c) => <CustomerLine key={c.id} c={c} onPay={() => setModal({ type: "payment", customer: c })} onEdit={() => setModal({ type: "customer", customer: c })} />)}
      </section>
      {modal?.type === "customer" && <CustomerModal customer={modal.customer} close={() => setModal(null)} />}
      {modal?.type === "payment" && <PaymentModal customer={modal.customer} close={() => setModal(null)} />}
    </Page>
  );
}

function StatMini({ icon: Icon, title, value, red, orange }) {
  return <div className={`soft-card p-4 ${red ? "text-red-600" : orange ? "text-orange-600" : "text-[#0d6a42]"}`}><Icon /><p className="mt-3 text-gray-600">{title}</p><b className="text-2xl">{value}</b></div>;
}

function CustomerLine({ c, onPay, onEdit }) {
  const status = c.totalDebt > 1000 ? ["متأخر", "badge-red"] : c.totalDebt > 0 ? ["مدفوع جزئيًا", "badge-orange"] : ["مستحق", "badge-green"];
  return (
    <div className="table-row grid gap-4 p-4 md:grid-cols-[1.5fr_1fr_1fr_1fr_240px] md:items-center">
      <div className="flex items-center gap-3"><div className="grid h-14 w-14 place-items-center rounded-full bg-green-50 text-[#0d6a42]"><User /></div><div><b>{c.name}</b><p className="text-gray-500">{c.phone}</p></div></div>
      <div><p className="text-gray-500">آخر شراء</p><b>{c.lastPurchaseAt ? shortDate(c.lastPurchaseAt) : "-"}</b></div>
      <div><p className="text-gray-500">الرصيد الحالي</p><b className={c.totalDebt > 0 ? "text-red-600" : ""}>{money(c.totalDebt)}</b></div>
      <span className={`badge ${status[1]}`}>{status[0]}</span>
      <div className="flex gap-2"><Link to={`/customers/${c.id}`} className="btn-ghost px-3 py-2 text-sm"><Eye className="inline" size={16} /> عرض الحساب</Link><button onClick={onPay} className="btn-ghost px-3 py-2 text-sm text-[#0d6a42]">تسجيل دفعة</button><button onClick={onEdit} className="btn-ghost px-3 py-2"><Edit3 size={16} /></button><button onClick={() => confirm("حذف الزبون؟") && deleteCustomer(c.id)} className="btn-ghost px-3 py-2 text-red-600"><Trash2 size={16} /></button></div>
    </div>
  );
}

function CustomerModal({ customer, close }) {
  const [form, setForm] = useState({ ...emptyCustomer, ...(customer || {}) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await saveCustomer(form, customer?.id);
      close();
    } catch (err) {
      setError(err.message || "تعذر حفظ الزبون. تأكد من الاتصال وقواعد Firebase.");
    } finally {
      setSaving(false);
    }
  }
  return <Modal title={customer ? "تعديل زبون" : "إضافة زبون"} close={close}><form onSubmit={submit} className="grid gap-4">{error && <div className="rounded-2xl bg-red-50 p-3 font-bold text-red-600">{error}</div>}<Field label="الاسم" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required /><Field label="رقم الهاتف" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required /><Field label="العنوان اختياري" value={form.address || ""} onChange={(v) => setForm({ ...form, address: v })} /><Field label="ملاحظة اختيارية" value={form.notes || ""} onChange={(v) => setForm({ ...form, notes: v })} /><Field label="إجمالي الدين الحالي" type="number" value={form.totalDebt || 0} onChange={(v) => setForm({ ...form, totalDebt: v })} /><button className="btn-primary h-14 font-black" disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ الزبون"}</button></form></Modal>;
}

function PaymentModal({ customer, close }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  async function submit(e) { e.preventDefault(); try { await recordPayment({ customer, amount, note }); close(); } catch (err) { alert(err.message); } }
  return <Modal title="تسجيل دفعة" close={close}><form onSubmit={submit} className="grid gap-4"><Field label="اسم الزبون" value={customer.name} onChange={() => {}} /><Field label="المبلغ المدفوع" type="number" value={amount} onChange={setAmount} required /><Field label="التاريخ" type="date" value={new Date().toISOString().slice(0, 10)} onChange={() => {}} /><Field label="ملاحظة اختيارية" value={note} onChange={setNote} /><button className="btn-primary h-14 font-black">حفظ الدفعة</button></form></Modal>;
}

function Modal({ title, close, children }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4"><div className="card w-full max-w-xl p-5"><div className="mb-5 flex items-center justify-between"><h2 className="text-2xl font-black">{title}</h2><button onClick={close} className="grid h-10 w-10 place-items-center rounded-full bg-gray-100"><X /></button></div>{children}</div></div>;
}

function CustomerAccount() {
  const { id } = useParams();
  const { data: customers } = useCollection("customers");
  const customer = customers.find((c) => c.id === id);
  const [transactions, setTransactions] = useState([]);
  const [pay, setPay] = useState(false);
  useEffect(() => { if (id) fetchCustomerTransactions(id).then(setTransactions); }, [id, pay]);
  if (!customer) return <Page title="حساب الزبون" back><div className="card p-8">جاري تحميل الحساب...</div></Page>;

  return (
    <Page title="حساب الزبون" back>
      <section className="card p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-5"><div className="grid h-28 w-28 place-items-center rounded-full bg-green-50 text-[#0d6a42]"><User size={64} /></div><div><h2 className="text-3xl font-black">{customer.name}</h2><p className="ltr text-right text-xl text-gray-600">{customer.phone}</p><span className="badge badge-green mt-2">زبون نشط</span></div></div><Menu /></div><div className="mt-6 grid gap-4 border-t pt-5 md:grid-cols-3"><Info label="العنوان" value={customer.address || "-"} /><Info label="تاريخ إنشاء الحساب" value={customer.createdAt ? shortDate(customer.createdAt) : "-"} /><Info label="نوع الحساب" value="عادي" /></div></section>
      <section className="card mt-5 p-5"><div className="grid gap-4 md:grid-cols-2"><StatMini icon={WalletCards} title="الرصيد الحالي" value={money(customer.totalDebt)} red /><StatMini icon={FileText} title="آخر دفعة" value={customer.lastPaymentAt ? shortDate(customer.lastPaymentAt) : "-"} /></div><div className="mt-5 grid gap-3 md:grid-cols-3"><button className="btn-primary h-14 font-black"><Package className="inline" /> إضافة عملية شراء</button><button onClick={() => setPay(true)} className="btn-ghost h-14 font-black text-[#0d6a42]"><Banknote className="inline" /> تسجيل دفعة</button><button className="btn-ghost h-14 font-black text-orange-600"><Send className="inline" /> إرسال تذكير</button></div></section>
      <section className="card mt-5 p-5"><h2 className="mb-4 text-2xl font-black">سجل العمليات</h2>{transactions.map((t) => <div key={t.id} className="table-row grid gap-3 py-4 md:grid-cols-5"><span className={`badge ${t.type === "payment" ? "badge-green" : "badge-red"}`}>{t.type === "payment" ? "دفعة" : "شراء"}</span><b>{money(t.amount)}</b><span>{t.note}</span><span>{dateTime(t.createdAt)}</span><span>الرصيد: {money(t.balanceAfter)}</span></div>)}</section>
      {pay && <PaymentModal customer={customer} close={() => setPay(false)} />}
    </Page>
  );
}

function Reports() {
  const { data: products } = useCollection("products");
  const { data: sales } = useCollection("sales");
  const { data: customers } = useCollection("customers");
  const [period, setPeriod] = useState("الأسبوع");
  const totalSales = sales.reduce((s, sale) => s + Number(sale.total || 0), 0);
  const profit = sales.reduce((s, sale) => s + (sale.items || []).reduce((x, item) => x + (item.salePrice - item.purchasePrice) * item.quantity, 0), 0);
  const debt = customers.reduce((s, c) => s + Number(c.totalDebt || 0), 0);
  const low = products.filter((p) => Number(p.quantity) <= Number(p.minimumStock));
  const byCat = categories.map((c) => ({ name: c, value: products.filter((p) => p.category === c).length || 1 }));
  const week = ["ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت", "أحد", "اثنين"].map((d, i) => ({ day: d, sales: [0, 0, 0, 0, 0, 0, totalSales][i] }));

  return (
    <Page title="التقارير">
      <div className="mb-6 flex flex-wrap gap-3">{["اليوم", "الأسبوع", "الشهر", "نطاق مخصص"].map((p) => <button key={p} onClick={() => setPeriod(p)} className={`rounded-2xl border px-6 py-3 font-bold ${period === p ? "btn-primary" : "bg-white"}`}>{p}</button>)}</div>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Stat icon={BarChart3} title="المبيعات" value={number(totalSales)} unit="دج" hint={`فلتر: ${period}`} /><Stat icon={WalletCards} title="الأرباح" value={number(profit)} unit="دج" hint="+8% عن السابق" /><Stat icon={FileText} title="إجمالي الديون" value={number(debt)} unit="دج" hint="قابل للتحصيل" tone="red" /><Stat icon={Package} title="أكثر المنتجات مبيعًا" value={products[0]?.name || "-"} unit="" hint="عرض التفاصيل" /></section>
      <div className="mt-6 grid gap-6 xl:grid-cols-2"><section className="card p-5"><h2 className="mb-4 text-2xl font-black">المبيعات خلال الأسبوع</h2><div className="h-80"><ResponsiveContainer><AreaChart data={week}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" /><YAxis /><Tooltip formatter={(v) => money(v)} /><Area dataKey="sales" stroke="#0d6a42" fill="#e6f2e9" strokeWidth={3} /></AreaChart></ResponsiveContainer></div></section><section className="card p-5"><h2 className="mb-4 text-2xl font-black">توزيع المبيعات حسب الفئات</h2><div className="h-80"><ResponsiveContainer><PieChart><Pie data={byCat} dataKey="value" nameKey="name" innerRadius={70} outerRadius={120}>{byCat.map((_, i) => <Cell key={i} fill={["#0d6a42", "#4c78a8", "#f59e0b", "#9cc69b", "#ef4444", "#d1d5db"][i]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></section></div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2"><ReportList title="تقرير نقص المخزون" items={low.map((p) => `${p.name} - الكمية الحالية ${p.quantity}`)} /><ReportList title="أكثر المنتجات مبيعًا" items={products.slice(0, 5).map((p, i) => `${i + 1}. ${p.name} - ${number(2000 - i * 312)} وحدة`)} /></div>
    </Page>
  );
}

function ReportList({ title, items }) {
  return <section className="card p-5"><h2 className="mb-4 text-2xl font-black">{title}</h2><div className="divide-y">{items.length ? items.map((item) => <p key={item} className="py-3">{item}</p>) : <p className="py-3 text-gray-500">لا توجد بيانات حالية.</p>}</div></section>;
}

export default App;
