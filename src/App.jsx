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
  Clock,
  CreditCard,
  Edit3,
  Eye,
  FileText,
  Home,
  ImageOff,
  LogOut,
  Menu,
  Package,
  PackageCheck,
  PackagePlus,
  Printer,
  QrCode,
  RefreshCw,
  RotateCcw,
  ScanBarcode,
  Search,
  Send,
  Settings,
  Share2,
  ShoppingCart,
  Sparkles,
  Store,
  Trash2,
  UploadCloud,
  User,
  Users,
  WalletCards,
  Wifi,
  WifiOff,
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
  packUnits,
  recordPayment,
  receiveProductStock,
  resetData,
  resetDailySales,
  saveCustomer,
  saveProduct,
  units,
} from "./lib/store";
import { dateTime, money, number, shortDate } from "./lib/format";
import {
  filterByExpiryStatus,
  formatExpiryDate,
  getExpirySummary,
  getExpiryStatus,
  sortByExpiry,
} from "./lib/expiryUtils";
import { isCloudinaryConfigured, retryImageUpload } from "./lib/imageUploadService";
import {
  loadCollectionFromLocal,
  saveCollectionToLocal,
} from "./lib/offlineDb";
import { useOfflineSync } from "./hooks/useOfflineSync";
import { calcWeightPrice, formatStockDisplay, formatWeight } from "./lib/weightUtils";
import Assistant from "./Assistant";
import OnlineStore from "./OnlineStore";
import { AdminOnlineStore } from "./AdminOnlineStore";
import {
  M110SettingsPage,
  PrintM110LabelBtn,
  PrintM110ReceiptBtn,
  PrintWeightSaleLabelBtn,
} from "./PhomemoPrint";

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
  { to: "/expiry-alerts", label: "الصلاحية", icon: Clock },
  { to: "/online-store", label: "المتجر", icon: Store },
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
  unit: "حبة",
  minimumStock: "",
  expiryDate: "",
  supplier: "",
  imageUrl: "",
  isWeightBased: false,
  isPacked: false,
  packUnit: "كرتون",
  packSize: 30,
};

const emptyCustomer = { name: "", phone: "", address: "", notes: "", totalDebt: 0 };

/**
 * Hook محسَّن — يحمّل البيانات من IndexedDB فوراً (حتى لو لا إنترنت)
 * ثم يشترك في Firestore عند الاتصال ويحدّث IndexedDB.
 */
function useCollection(name, sortField = "createdAt") {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe = () => {};
    let mounted = true;

    // ① تحميل فوري من IndexedDB (بدون انتظار)
    loadCollectionFromLocal(name, sortField).then((local) => {
      if (mounted && local.length > 0) {
        setData(local);
        setLoading(false);
      }
    });

    // ② الاشتراك في Firestore (يعمل أونلاين وأوفلاين — Firestore لديه cache خاص به)
    const q = query(collection(db, name), orderBy(sortField, "desc"));
    unsubscribe = onSnapshot(
      q,
      async (snap) => {
        if (!mounted) return;
        const fresh = snap.docs.map((item) => {
          const d = item.data();
          // تحويل Firestore timestamps إلى ISO strings للتخزين المحلي
          const norm = { id: item.id, ...d };
          for (const key of ["createdAt", "updatedAt", "lastPurchaseAt", "lastPaymentAt"]) {
            if (norm[key]?.toDate) norm[key] = norm[key].toDate().toISOString();
          }
          return norm;
        });
        // حفظ في IndexedDB للاستخدام الأوفلاين
        await saveCollectionToLocal(name, fresh);
        if (mounted) {
          setData(fresh);
          setLoading(false);
        }
      },
      async () => {
        // عند الفشل (أوفلاين): اقرأ من IndexedDB
        if (!mounted) return;
        const local = await loadCollectionFromLocal(name, sortField);
        if (mounted) { setData(local); setLoading(false); }
      }
    );

    return () => { mounted = false; unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, sortField]);

  return { data, loading };
}

function App() {
  const location = useLocation();

  // مسار عام للزبائن — بدون تحقق من الجلسة
  if (location.pathname.startsWith("/store")) {
    return <OnlineStore />;
  }

  return <AdminApp />;
}

function AdminApp() {
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
  const sync = useOfflineSync();

  return (
    <div className="app-shell">
      <DesktopSidebar user={user} />
      <NetworkStatusBar sync={sync} />
      <Routes>
        <Route path="/" element={<Dashboard user={user} sync={sync} />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/products/new" element={<ProductForm />} />
        <Route path="/products/:id/edit" element={<ProductForm />} />
        <Route path="/pos" element={<POS user={user} />} />
        <Route path="/invoice" element={<Invoice />} />
        <Route path="/credit" element={<CreditCustomers />} />
        <Route path="/customers/:id" element={<CustomerAccount />} />
        <Route path="/expiry-alerts" element={<ExpiryAlerts />} />
        <Route path="/online-store" element={<Page title="المتجر الإلكتروني"><AdminOnlineStore /></Page>} />
        <Route path="/print-settings" element={<Page title="إعدادات طابعة Phomemo M110" back><M110SettingsPage /></Page>} />
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
    <nav className="bottom-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-8 px-1 py-2 text-white lg:hidden">
      {navItems.map(({ to, label, icon: Icon }) => {
        const active = location.pathname === to;
        return (
          <Link key={to} to={to} className={`flex flex-col items-center gap-0.5 text-[10px] ${active ? "text-[#f7c46c]" : "text-white/85"}`}>
            <Icon size={20} fill={active ? "currentColor" : "none"} />
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
  // إذا كان المنتج معبّأ، الوضع الافتراضي هو استلام بالكرتون
  const [mode, setMode]     = useState(product.isPacked ? "pack" : "unit");
  const [packs, setPacks]   = useState(1);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote]     = useState("");
  const [saving, setSaving] = useState(false);

  const packSize = Number(product.packSize || 1);
  const packUnit = product.packUnit || "كرتون";
  const unitLabel = product.unit || "قطعة";

  // الكمية الفعلية بالحبة التي ستُضاف للمخزون
  const computedQty = mode === "pack"
    ? Math.round(Number(packs || 0) * packSize)
    : Number(quantity || 0);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await receiveProductStock({
        productId:   product.id,
        productName: product.name,
        quantity:    computedQty,
        note,
      });
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
        {/* معلومات المنتج */}
        <div className="soft-card flex items-center gap-3 p-3">
          <ProductImage p={product} />
          <div>
            <b>{product.name}</b>
            <p className="text-gray-500">الكمية الحالية: {formatStockDisplay(product)}</p>
            {product.isPacked && (
              <p className="text-xs text-blue-600">
                📦 1 {packUnit} = {packSize} {unitLabel}
              </p>
            )}
          </div>
        </div>

        {/* اختيار طريقة الاستلام (للمنتجات المعبّأة فقط) */}
        {product.isPacked && (
          <div className="flex gap-2 rounded-2xl border p-1">
            <button
              type="button"
              onClick={() => setMode("pack")}
              className={`flex-1 rounded-xl py-2.5 text-sm font-black transition ${mode === "pack" ? "bg-[#063f2b] text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              📦 استلام بـ{packUnit}
            </button>
            <button
              type="button"
              onClick={() => setMode("unit")}
              className={`flex-1 rounded-xl py-2.5 text-sm font-black transition ${mode === "unit" ? "bg-[#063f2b] text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              🔢 استلام بالـ{unitLabel}
            </button>
          </div>
        )}

        {/* حقل الإدخال */}
        {mode === "pack" && product.isPacked ? (
          <div className="space-y-2">
            <label className="block">
              <span className="mb-2 block font-bold">عدد الـ{packUnit} المستلمة</span>
              <input
                className="input text-center text-xl font-black"
                type="number" min="1"
                value={packs}
                onChange={(e) => setPacks(e.target.value)}
                required
              />
            </label>
            {/* معادلة التحويل */}
            <div className="flex items-center justify-center gap-2 rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-800">
              <span>{Number(packs) || 0} {packUnit}</span>
              <span className="text-gray-400">×</span>
              <span>{packSize} {unitLabel}</span>
              <span className="text-gray-400">=</span>
              <span className="text-xl text-blue-900">{computedQty} {unitLabel}</span>
            </div>
          </div>
        ) : (
          <Field
            label={`الكمية (${unitLabel})`}
            type="number" value={quantity}
            onChange={setQuantity}
            required
          />
        )}

        <Field label="ملاحظة اختيارية" value={note} onChange={setNote} />

        <button className="btn-primary h-14 w-full font-black" disabled={saving || computedQty <= 0}>
          <PackageCheck className="inline" />{" "}
          {saving
            ? "جاري الاستلام..."
            : `إضافة ${computedQty} ${unitLabel} للمخزون`}
        </button>
      </form>
    </Modal>
  );
}

function Dashboard({ sync }) {
  const { data: products } = useCollection("products");
  const { data: sales } = useCollection("sales");
  const { data: customers } = useCollection("customers");
  const { data: activity } = useCollection("activityLogs");
  const low = products.filter((p) => Number(p.quantity) <= Number(p.minimumStock));
  const expirySummary = getExpirySummary(products);
  const totalExpiryAlerts = expirySummary.expired + expirySummary.critical + expirySummary.warning;

  const todaySales = sales.filter((sale) => {
    const saleDate = sale.createdAt?.toDate?.() || new Date(sale.createdAt);
    const today = new Date();
    return saleDate.toDateString() === today.toDateString();
  }).reduce((s, sale) => s + Number(sale.total || 0), 0);

  const debt = customers.reduce((s, c) => s + Number(c.totalDebt || 0), 0);

  const chart = ["6 ص", "9 ص", "12 م", "3 م", "6 م", "9 م"].map((time, i) => ({ time, value: i === 5 ? todaySales : 0 }));

  return (
    <Page title="متجر المواد الغذائية">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 no-print">
        <InstallButton compact />
        <button onClick={() => signOut(auth)} className="btn-ghost hidden items-center gap-2 px-5 py-3 lg:flex"><LogOut size={18} /> خروج</button>
      </div>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Package} title="المخزون" value={number(products.length)} unit="منتج" hint="محدث اليوم" />
        <Stat icon={BarChart3} title="مبيعات اليوم" value={number(todaySales)} unit="دج" hint="" />
        <Stat icon={User} title="الكريديت" value={number(debt)} unit="دج" hint={`${customers.filter((c) => c.totalDebt > 0).length} زبائن لديهم مستحقات`} tone="orange" />
        <Stat icon={AlertTriangle} title="منتجات قليلة المخزون" value={number(low.length)} unit="منتج" hint="تحتاج إعادة طلب" tone="red" />
      </section>

      {/* ─── بطاقة تنبيه الصلاحية ─── */}
      {totalExpiryAlerts > 0 && (
        <Link to="/expiry-alerts" className="mt-4 flex items-center gap-4 rounded-3xl border border-orange-200 bg-orange-50 p-4 transition hover:bg-orange-100">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-orange-100 text-orange-600">
            <Clock size={28} />
          </div>
          <div className="flex-1">
            <b className="text-lg text-orange-800">
              {expirySummary.expired > 0
                ? `${expirySummary.expired} منتجات منتهية الصلاحية`
                : expirySummary.critical > 0
                ? `${expirySummary.critical} منتجات تنتهي خلال أسبوع`
                : `${expirySummary.warning} منتجات تنتهي خلال شهر`}
            </b>
            <p className="text-sm text-orange-600">اضغط لعرض تفاصيل تنبيهات الصلاحية</p>
          </div>
          <div className="flex gap-2">
            {expirySummary.expired > 0 && <span className="badge bg-red-100 border-red-300 text-red-700">{expirySummary.expired} منتهية</span>}
            {expirySummary.critical > 0 && <span className="badge bg-orange-100 border-orange-300 text-orange-700">{expirySummary.critical} حرجة</span>}
            {expirySummary.warning > 0 && <span className="badge bg-yellow-100 border-yellow-300 text-yellow-700">{expirySummary.warning} تحذير</span>}
          </div>
        </Link>
      )}

      {/* ─── بطاقة حالة المزامنة (أوفلاين) ─── */}
      {sync && !sync.isOnline && (
        <div className="mt-4 flex items-center gap-3 rounded-3xl border border-gray-200 bg-gray-50 p-4">
          <WifiOff size={22} className="text-gray-500 shrink-0" />
          <p className="text-sm text-gray-600 font-bold">
            أنت تعمل حالياً بدون إنترنت — سيتم حفظ التغييرات ومزامنتها تلقائياً عند العودة
            {sync.pendingCount > 0 && ` (${sync.pendingCount} عملية معلقة)`}
          </p>
        </div>
      )}

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
  const list = [...items.slice(0, 5), ...low.slice(0, 2).map((p) => ({ id: p.id, type: "stock", title: "تنبيه نقص المخزون", description: `${p.name}: الكمية المتبقية ${p.quantity}` }))].slice(0, 6);
  return (
    <section className="card p-5">
      <h2 className="mb-4 text-2xl font-black">النشاط الأخير</h2>
      {list.length === 0 && <p className="py-6 text-center text-gray-500">لا يوجد نشاط بعد.</p>}
      {list.map((item) => (
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
  const [expiryFilter, setExpiryFilter] = useState("all");
  const [expirySort, setExpirySort] = useState("none");
  const [scanner, setScanner] = useState(false);
  const [receiving, setReceiving] = useState(null);

  let filtered = products.filter(
    (p) => (cat === "كل المنتجات" || p.category === cat) &&
      `${p.name} ${p.barcode} ${p.qrCode || ""}`.includes(search)
  );
  filtered = filterByExpiryStatus(filtered, expiryFilter);
  if (expirySort === "asc") filtered = sortByExpiry(filtered, "asc");
  else if (expirySort === "desc") filtered = sortByExpiry(filtered, "desc");

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
      <div className="mb-3 flex gap-3 overflow-auto pb-2">
        {["كل المنتجات", ...categories].map((item) => <button key={item} onClick={() => setCat(item)} className={`shrink-0 rounded-2xl border px-5 py-3 font-bold ${cat === item ? "btn-primary" : "bg-white"}`}>{item}</button>)}
      </div>
      {/* ─── فلاتر الصلاحية ─── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-gray-600">الصلاحية:</span>
        {[
          { val: "all", label: "الكل" },
          { val: "normal", label: "✅ سليم" },
          { val: "expiring-month", label: "🟠 ينتهي قريباً" },
          { val: "expiring-week", label: "🔴 أسبوع أو أقل" },
          { val: "expired", label: "⛔ منتهي" },
        ].map(({ val, label }) => (
          <button key={val} onClick={() => setExpiryFilter(val)}
            className={`rounded-2xl border px-4 py-2 text-sm font-bold transition ${expiryFilter === val ? "btn-primary" : "bg-white"}`}>
            {label}
          </button>
        ))}
        <select value={expirySort} onChange={(e) => setExpirySort(e.target.value)}
          className="mr-auto rounded-2xl border bg-white px-4 py-2 text-sm font-bold">
          <option value="none">ترتيب افتراضي</option>
          <option value="asc">الأقرب انتهاءً أولاً</option>
          <option value="desc">الأبعد انتهاءً أولاً</option>
        </select>
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
        <div className="divide-y divide-red-100">{low.map((p) => <div key={p.id} className="flex items-center justify-between py-3"><b>{p.name}</b><span className="text-red-600">المتوفر: {formatStockDisplay(p)} — الحد الأدنى: {p.minimumStock} {p.unit}</span></div>)}</div>
      </section>
      {scanner && <QrScannerModal title="استلام منتج عبر QR" description="امسح QR المنتج عند دخوله للمخزون، ثم أدخل الكمية المستلمة." close={() => setScanner(false)} onScan={handleStockQr} />}
      {receiving && <ReceiveStockModal product={receiving} close={() => setReceiving(null)} />}
    </Page>
  );
}

function ProductRow({ product }) {
  const stockDisplay = formatStockDisplay(product);
  const isLow = product.isWeightBased
    ? Number(product.stockInGrams || 0) <= Number(product.minimumStock || 0) * 1000
    : Number(product.quantity) <= Number(product.minimumStock);
  const isEmpty = product.isWeightBased
    ? Number(product.stockInGrams || 0) <= 0
    : Number(product.quantity) <= 0;
  const state = isEmpty ? ["نفد من المخزون", "badge-red"] : isLow ? ["كمية منخفضة", "badge-orange"] : ["متوفر", "badge-green"];
  const expiry = getExpiryStatus(product.expiryDate);
  return (
    <tr className={`table-row ${expiry?.status === "expired" ? "bg-red-50/40" : expiry?.status === "critical" ? "bg-red-50/20" : expiry?.status === "warning" ? "bg-orange-50/20" : ""}`}>
      <td className="p-4">
        <div className="flex items-center gap-3">
          <ProductImage p={product} />
          <div>
            <b>{product.name}</b>
            <div className="mt-1 flex flex-wrap gap-1">
              <span className={`badge ${state[1]}`}>{state[0]}</span>
              {product.isWeightBased && <span className="badge bg-amber-100 text-amber-700">⚖️ وزني</span>}
              {product.isPacked && (
                <span className="badge bg-blue-100 text-blue-700" title={`1 ${product.packUnit} = ${product.packSize} ${product.unit}`}>
                  📦 {product.packUnit} ({product.packSize} {product.unit})
                </span>
              )}
              {expiry && expiry.status !== "normal" && (
                <span className={expiry.badgeClass}>
                  {expiry.status === "expired" ? "⛔" : expiry.status === "critical" ? "🔴" : "🟠"}
                  {expiry.label}
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="p-4 text-gray-600">{product.barcode}</td>
      <td className="p-4 font-black text-[#0d6a42]">{stockDisplay}</td>
      <td className="p-4">{money(product.purchasePrice)}</td>
      <td className="p-4">
        {product.isWeightBased
          ? <span title="سعر الكيلوغرام">{money(product.salePrice)}<span className="text-xs text-gray-400">/كغ</span></span>
          : money(product.salePrice)
        }
      </td>
      <td className="p-4">
        <div>
          <span>{product.category}</span>
          {product.expiryDate && (
            <p className={`text-xs mt-1 ${expiry?.color || "text-gray-500"}`}>
              {formatExpiryDate(product.expiryDate)}
            </p>
          )}
        </div>
      </td>
      <td className="p-4"><div className="flex gap-2">
        <Link to={`/products/${product.id}/edit`} className="grid h-10 w-10 place-items-center rounded-xl bg-green-50 text-[#0d6a42]"><Edit3 size={18} /></Link>
        <PrintM110LabelBtn product={product} />
        <button onClick={() => confirm("حذف المنتج؟") && deleteProduct(product.id)} className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-600"><Trash2 size={18} /></button>
      </div></td>
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
  const [saveMsg, setSaveMsg] = useState("");

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
    setSaveMsg("");
    try {
      await saveProduct(form, file, id);
      if (!navigator.onLine) {
        setSaveMsg("تم حفظ المنتج محلياً — سيتم مزامنته عند عودة الإنترنت");
      }
      navigate("/inventory");
    } catch (err) {
      alert(err.message || "تعذر حفظ المنتج");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page title={id ? "تعديل منتج" : "إضافة منتج"} back>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_.8fr]">
        <form onSubmit={submit} className="card p-6">
          <label className="mb-4 grid min-h-44 place-items-center rounded-3xl border border-dashed border-gray-300 bg-white text-center text-gray-500 cursor-pointer hover:border-[#0d6a42] transition">
            {preview
              ? <img src={preview} alt="معاينة" className="h-40 w-full rounded-3xl object-cover" />
              : <>
                  <UploadCloud className="mx-auto mb-2 text-[#0d6a42]" size={38} />
                  <span>اسحب الصورة هنا أو اضغط للاختيار</span>
                  <small className="mt-1">JPG, PNG حتى 5MB</small>
                </>
            }
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0])} />
          </label>
          {/* حالة الصورة */}
          {!isCloudinaryConfigured() && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700">
              <ImageOff size={16} /> Cloudinary غير مهيأ — الصور تُحفظ نصياً أوفلاين فقط
            </div>
          )}
          {form.imagePending && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700">
              <Clock size={16} /> الصورة بانتظار الرفع — ستُرفع تلقائياً عند الاتصال
            </div>
          )}
          {saveMsg && (
            <div className="mb-4 rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-700">{saveMsg}</div>
          )}
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
            <Field
              label={form.isWeightBased ? "سعر الكيلوغرام (دج) *" : "سعر البيع (دج) *"}
              type="number" value={form.salePrice}
              onChange={(v) => setForm({ ...form, salePrice: v })}
              required
            />
            {/* ─── حقل الكمية — كراتين للمعبّأ، حبات/كغ للباقي ─── */}
            {form.isPacked && !form.isWeightBased ? (
              <label className="block">
                <span className="mb-2 block font-bold">
                  عدد الـ{form.packUnit || "كرتون"} *
                </span>
                <input
                  className="input text-xl font-black text-center"
                  type="number" min="0"
                  value={
                    Number(form.packSize) > 0
                      ? Math.round(Number(form.quantity || 0) / Number(form.packSize))
                      : ""
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      quantity: Math.round(Number(e.target.value || 0) * Number(form.packSize || 1)),
                    })
                  }
                  required
                />
                {Number(form.quantity) > 0 && (
                  <p className="mt-1 text-center text-xs text-blue-700 font-bold">
                    = {form.quantity} {form.unit || "حبة"} إجمالاً
                  </p>
                )}
              </label>
            ) : (
              <Field
                label={form.isWeightBased ? "المخزون الأولي (كغ) *" : "الكمية *"}
                type="number" value={form.quantity}
                onChange={(v) => setForm({ ...form, quantity: v })}
                required
              />
            )}
            {!form.isWeightBased && (
              <Select label="الوحدة *" value={form.unit} options={units} onChange={(v) => setForm({ ...form, unit: v })} />
            )}
            {/* ─── حقل الحد الأدنى — كراتين للمعبّأ، حبات/كغ للباقي ─── */}
            {form.isPacked && !form.isWeightBased ? (
              <label className="block">
                <span className="mb-2 block font-bold">
                  الحد الأدنى (بالـ{form.packUnit || "كرتون"}) *
                </span>
                <input
                  className="input"
                  type="number" min="0"
                  value={
                    Number(form.packSize) > 0
                      ? Math.round(Number(form.minimumStock || 0) / Number(form.packSize))
                      : ""
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      minimumStock: Math.round(Number(e.target.value || 0) * Number(form.packSize || 1)),
                    })
                  }
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  تنبيه عندما يقل عن {form.minimumStock || 0} {form.unit || "حبة"}
                </p>
              </label>
            ) : (
              <Field
                label={form.isWeightBased ? "الحد الأدنى للمخزون (كغ) *" : "الحد الأدنى للمخزون *"}
                type="number" value={form.minimumStock}
                onChange={(v) => setForm({ ...form, minimumStock: v })}
                required
              />
            )}
            <Field label="تاريخ الانتهاء (اختياري)" type="date" value={form.expiryDate || ""} onChange={(v) => setForm({ ...form, expiryDate: v })} />
            <Field label="المورد (اختياري)" value={form.supplier || ""} onChange={(v) => setForm({ ...form, supplier: v })} />
            {/* ─── تبديل منتج وزني ─── */}
            <div className="md:col-span-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border bg-amber-50 p-4 transition hover:border-amber-300">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-amber-600"
                  checked={!!form.isWeightBased}
                  onChange={(e) => setForm({ ...form, isWeightBased: e.target.checked, isPacked: false, unit: e.target.checked ? "كغ" : "حبة" })}
                />
                <div>
                  <b>⚖️ منتج وزني (يُباع بالغرام)</b>
                  <p className="text-xs text-gray-500">المخزون يُدخَل بالكيلوغرام، والبيع يُحسب بالغرام تلقائياً</p>
                </div>
              </label>
              {form.isWeightBased && (
                <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
                  💡 سعر البيع = سعر الكغ الواحد. عند البيع ستُدخل الكمية بالغرام وسيُحسب السعر تلقائياً.
                </div>
              )}
            </div>

            {/* ─── تبديل منتج معبّأ (كرتون/علبة) ─── */}
            {!form.isWeightBased && (
              <div className="md:col-span-2 space-y-3">
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border bg-blue-50 p-4 transition hover:border-blue-300">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-blue-700"
                    checked={!!form.isPacked}
                    onChange={(e) => setForm({ ...form, isPacked: e.target.checked })}
                  />
                  <div>
                    <b>📦 يُشترى بالتعبئة (كرتون / علبة…)</b>
                    <p className="text-xs text-gray-500">
                      مثال: البيض يُشترى بالكرتون (30 حبة) ويُباع بالحبة الواحدة
                    </p>
                  </div>
                </label>

                {form.isPacked && (
                  <>
                    <div className="grid grid-cols-2 gap-3 rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
                      {/* اسم التعبئة */}
                      <div>
                        <label className="mb-1 block text-sm font-bold">اسم التعبئة</label>
                        <select
                          className="input text-sm"
                          value={form.packUnit}
                          onChange={(e) => setForm({ ...form, packUnit: e.target.value })}
                        >
                          {packUnits.map((u) => <option key={u}>{u}</option>)}
                        </select>
                        <input
                          className="input mt-1 text-sm"
                          placeholder="أو اكتب اسماً آخر…"
                          value={packUnits.includes(form.packUnit) ? "" : form.packUnit}
                          onChange={(e) => e.target.value && setForm({ ...form, packUnit: e.target.value })}
                        />
                      </div>
                      {/* حجم التعبئة */}
                      <div>
                        <label className="mb-1 block text-sm font-bold">
                          عدد {form.unit || "حبة"} في الـ{form.packUnit || "كرتون"}
                        </label>
                        <input
                          className="input text-sm"
                          type="number" min="1"
                          value={form.packSize}
                          onChange={(e) => setForm({ ...form, packSize: e.target.value })}
                        />
                        <p className="mt-1 text-xs text-blue-700">
                          1 {form.packUnit} = {form.packSize} {form.unit}
                        </p>
                      </div>
                    </div>

                    {/* ملاحظة: حقل "عدد الكراتين" أعلاه يقبل الكراتين مباشرة */}
                  </>
                )}
              </div>
            )}
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <button className="btn-primary h-14 font-black">{saving ? "جاري الحفظ..." : "حفظ المنتج"}</button>
            <button type="button" onClick={() => navigate("/inventory")} className="btn-ghost h-14 font-black text-orange-600">إلغاء</button>
          </div>
          {id && editing && (
            <div className="mt-3">
              <PrintM110LabelBtn product={editing} variant="full" />
            </div>
          )}
        </form>
        <aside className="card p-6">
          <h2 className="mb-5 text-center text-2xl font-black">معاينة المنتج</h2>
          <div className="soft-card p-6 text-center">{preview ? <img src={preview} alt="" className="mx-auto mb-4 h-52 rounded-3xl object-cover" /> : <ProductImage p={form} className="mx-auto mb-4 h-52 w-52" />}<h3 className="text-2xl font-black">{form.name || "—"}</h3><span className="badge badge-green mt-3">{form.category}</span></div>
          <div className="mt-5"><ProductQrPreview code={form.qrCode || form.barcode} name={form.name} /></div>
          <dl className="mt-5 divide-y">{[
            ["الباركود", form.barcode],
            ["سعر الشراء", money(form.purchasePrice)],
            ["سعر البيع", money(form.salePrice)],
            ["الكمية", form.isPacked && Number(form.packSize) > 0
              ? `${Math.round(Number(form.quantity || 0) / Number(form.packSize))} ${form.packUnit || "كرتون"}`
              : `${form.quantity || 0} ${form.unit || ""}`],
            ["الوحدة", form.isPacked ? `${form.packUnit} (${form.packSize} ${form.unit})` : form.unit],
            ["تاريخ الانتهاء", form.expiryDate],
            ["المورد", form.supplier],
          ].map(([k, v]) => <div key={k} className="flex justify-between py-3"><dt className="text-[#0d6a42]">{k}</dt><dd>{v || "-"}</dd></div>)}</dl>
        </aside>
      </div>
      {scanner && <QrScannerModal title="مسح QR المنتج" description="امسح رمز المنتج ليتم تعبئة الباركود وربط QR بهذا المنتج." close={() => setScanner(false)} onScan={(raw) => {
        const code = qrValue(raw);
        setForm((current) => ({ ...current, barcode: code, qrCode: code }));
      }} />}
    </Page>
  );
}

/**
 * محوّل الكراتين ← حبات
 * يتيح للمستخدم إدخال عدد الكراتين ثم نقل الناتج إلى حقل الكمية.
 */
function PackConverter({ unit, packUnit, packSize, onApply }) {
  const [packs, setPacks] = useState("");
  const ps    = Number(packSize) || 1;
  const total = packs !== "" ? Math.round(Number(packs) * ps) : 0;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 text-sm">
      <p className="mb-2 font-bold text-blue-800">🔄 محوّل الكراتين ← حبات (للكمية الأولية)</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number" min="1"
          value={packs}
          onChange={(e) => setPacks(e.target.value)}
          placeholder="عدد الكراتين"
          className="w-28 rounded-xl border px-3 py-2 text-center font-black focus:border-blue-500 focus:outline-none"
        />
        <span className="text-gray-500">{packUnit || "كرتون"} × {ps} =</span>
        <b className="text-blue-900">{total} {unit || "حبة"}</b>
        {total > 0 && (
          <button
            type="button"
            onClick={() => { onApply(total); setPacks(""); }}
            className="mr-auto rounded-xl bg-blue-700 px-4 py-2 text-xs font-black text-white hover:bg-blue-800 active:scale-95"
          >
            ← تطبيق
          </button>
        )}
      </div>
    </div>
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
  const { autoPrint, setAutoPrint } = usePrintSettings();
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [saleQrInput, setSaleQrInput] = useState("");
  const [scanner, setScanner] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [customerId, setCustomerId] = useState("");
  const [weightModal, setWeightModal] = useState(null); // منتج وزني بانتظار إدخال الغرامات

  const filtered = products.filter((p) => {
    const hasStock = p.isWeightBased ? Number(p.stockInGrams || 0) > 0 : Number(p.quantity) > 0;
    return hasStock && `${p.name} ${p.barcode} ${p.qrCode || ""}`.includes(search);
  }).slice(0, 12);
  const subtotal = cart.reduce((s, i) => s + i.salePrice * i.cartQty, 0);
  const total = Math.max(0, subtotal - Number(discount || 0));
  const customer = customers.find((c) => c.id === customerId);

  function add(product) {
    if (product.isWeightBased) {
      setWeightModal(product); // افتح مودال الوزن
      return;
    }
    setCart((old) => old.some((i) => i.id === product.id)
      ? old.map((i) => i.id === product.id ? { ...i, cartQty: Math.min(i.cartQty + 1, product.quantity) } : i)
      : [{ ...product, cartQty: 1 }, ...old]);
  }
  function addWeightItem(product, grams) {
    const price = calcWeightPrice(product.salePrice, grams);
    const cartItem = {
      ...product,
      cartQty: 1,
      weightGrams: grams,
      salePrice: price,          // السعر المحسوب للكمية المطلوبة
      unit: "غ",
      isWeightBased: true,
    };
    setCart((old) => {
      const exists = old.find((i) => i.id === product.id);
      return exists
        ? old.map((i) => i.id === product.id ? cartItem : i)
        : [cartItem, ...old];
    });
  }
  function qty(id, delta) {
    setCart((old) => old.map((i) => {
      if (i.id !== id || i.isWeightBased) return i; // الوزني لا يتغير بالزر
      return { ...i, cartQty: Math.max(1, Math.min(i.quantity, i.cartQty + delta)) };
    }));
  }
  async function finish() {
    try {
      const sale = await createSale({ cart, discount, paymentMethod, customer, cashierId: user.uid });
      sessionStorage.setItem("lastInvoice", JSON.stringify({ ...sale, cashierName: user.email }));
      if (autoPrint) {
        sessionStorage.setItem("triggerPrintM110", "1");
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
      {/* ─── شريط Phomemo M110 ─── */}
      <div className="no-print mb-4 flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-3">
        <span className="flex items-center gap-2 rounded-xl bg-black px-3 py-1.5 text-xs font-bold text-white">🖨️ Phomemo M110</span>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={autoPrint} onChange={(e) => setAutoPrint(e.target.checked)} className="h-4 w-4 accent-[#0d6a42]" />
          طباعة إيصال تلقائي بعد البيع
        </label>
        <Link to="/print-settings" className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold text-[#0d6a42] hover:bg-green-50">
          <Settings size={13} /> إعدادات M110
        </Link>
        <span className="mr-auto rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-[#0d6a42]">💡 الماسح الضوئي يعمل في حقل QR تلقائياً</span>
      </div>
      <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
        <section className="card order-2 p-4 xl:order-1">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-black">سلة المشتريات</h2><button onClick={() => setCart([])} className="grid h-11 w-11 place-items-center rounded-xl bg-red-50 text-red-600"><Trash2 /></button></div>
          <div className="space-y-3">{cart.map((item) => (
            <div key={item.id} className="soft-card flex items-center gap-3 p-3">
              <ProductImage p={item} />
              <div className="flex-1">
                <b>{item.name}</b>
                {item.isWeightBased
                  ? <p className="text-gray-500">{item.weightGrams}غ × <span className="font-bold text-[#0d6a42]">{money(item.salePrice)}</span></p>
                  : <p className="text-gray-500">{money(item.salePrice)}</p>
                }
              </div>
              {item.isWeightBased
                ? <div className="flex items-center gap-2">
                    <button onClick={() => setWeightModal(item)} className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">✏️ {item.weightGrams}غ</button>
                    <PrintWeightSaleLabelBtn product={item} grams={item.weightGrams} totalPrice={item.salePrice} />
                  </div>
                : <div className="flex items-center rounded-xl bg-green-50">
                    <button onClick={() => qty(item.id, -1)} className="px-3 py-2">-</button>
                    <b className="px-3">{item.cartQty}</b>
                    <button onClick={() => qty(item.id, 1)} className="px-3 py-2">+</button>
                  </div>
              }
              <button onClick={() => setCart((old) => old.filter(i => i.id !== item.id))} className="grid h-8 w-8 place-items-center rounded-xl bg-red-50 text-red-500"><X size={15} /></button>
            </div>
          ))}</div>
          <label className="mt-4 block"><span className="mb-2 block font-bold">الخصم</span><input className="input" type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} /></label>
          <div className="my-4 rounded-3xl bg-white p-4"><Row label="المجموع الفرعي" value={money(subtotal)} /><Row label="الخصم" value={money(discount)} good /><Row label="الإجمالي" value={money(total)} strong /></div>
          <h3 className="mb-3 text-xl font-black">طريقة الدفع</h3>
          <div className="grid grid-cols-2 gap-3"><button onClick={() => setPaymentMethod("cash")} className={`btn-ghost h-14 ${paymentMethod === "cash" ? "border-[#0d6a42] text-[#0d6a42]" : ""}`}><Banknote className="inline" /> نقدًا</button><button onClick={() => setPaymentMethod("credit")} className={`btn-ghost h-14 ${paymentMethod === "credit" ? "border-[#0d6a42] text-[#0d6a42]" : ""}`}><CreditCard className="inline" /> كريديت</button></div>
          {paymentMethod === "credit" && <select className="input mt-4" value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">اختر الزبون</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name} - دين: {money(c.totalDebt)}</option>)}</select>}
          <button onClick={finish} className="btn-primary mt-5 h-16 w-full text-xl font-black"><CreditCard className="inline" /> إتمام البيع</button>
        </section>
        <section className="card order-1 p-5 xl:order-2">
          <div className="mb-6 flex gap-2"><button onClick={() => setScanner(true)} className="btn-ghost grid h-14 w-16 place-items-center text-[#0d6a42]" title="مسح QR للبيع"><ScanBarcode /></button><input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن منتج أو امسح QR..." /></div>
          <form onSubmit={submitSaleQr} className="mb-6 grid gap-3 rounded-3xl border bg-green-50/40 p-3 md:grid-cols-[1fr_130px]">
            <input className="input ltr text-left" value={saleQrInput} onChange={(e) => setSaleQrInput(e.target.value)} placeholder="مدخل ماسح QR / Barcode للبيع" />
            <button className="btn-primary h-12 font-black">إضافة</button>
          </form>
          <h2 className="mb-4 text-2xl font-black">منتجات شائعة</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{filtered.map((p) => (
            <button key={p.id} onClick={() => add(p)} className="soft-card relative p-4 text-center">
              <ProductImage p={p} className="mx-auto h-24 w-24" />
              <b className="mt-3 block">{p.name}</b>
              <p className="text-gray-500">{p.isWeightBased ? formatWeight(p.stockInGrams || 0) : p.unit}</p>
              <p className="mt-2 text-xl font-black">
                {money(p.salePrice)}{p.isWeightBased && <span className="text-xs font-normal text-gray-400">/كغ</span>}
              </p>
              {p.isWeightBased && <span className="absolute top-2 left-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">⚖️</span>}
              <span className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-green-50 text-[#0d6a42]">+</span>
            </button>
          ))}</div>
        </section>
      </div>
      {scanner && <QrScannerModal title="بيع منتج عبر QR" description="امسح QR المنتج ليُضاف مباشرة إلى سلة البيع، ثم يتم إنقاصه من المخزون عند إتمام البيع." close={() => setScanner(false)} onScan={handleSaleQr} />}
      {weightModal && (
        <WeightInputModal
          product={weightModal}
          onConfirm={(grams) => addWeightItem(weightModal, grams)}
          onClose={() => setWeightModal(null)}
        />
      )}
    </Page>
  );
}

/* ─── مودال إدخال الوزن (للمنتجات الوزنية) ─── */
function WeightInputModal({ product, onConfirm, onClose }) {
  const [grams, setGrams] = useState("");
  const maxGrams = Number(product.stockInGrams || 0);
  const price = calcWeightPrice(product.salePrice, Number(grams));
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function confirm() {
    const g = Number(grams);
    if (!g || g <= 0) return alert("أدخل كمية بالغرام");
    if (g > maxGrams) return alert(`الكمية غير كافية. المتوفر: ${formatWeight(maxGrams)}`);
    onConfirm(g);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black">⚖️ تحديد الوزن</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-gray-100"><X size={16} /></button>
        </div>
        <div className="mb-4 rounded-2xl bg-amber-50 p-4">
          <b className="block text-lg">{product.name}</b>
          <p className="text-sm text-gray-600">المتوفر: <b className="text-amber-700">{formatWeight(maxGrams)}</b></p>
          <p className="text-sm text-gray-600">سعر الكغ: <b>{money(product.salePrice)}</b></p>
        </div>
        <label className="mb-3 block">
          <span className="mb-1 block font-bold">الكمية بالغرام *</span>
          <input
            ref={inputRef}
            className="input text-xl font-black ltr text-center"
            type="number"
            placeholder="مثال: 250"
            value={grams}
            onChange={(e) => setGrams(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirm()}
            min="1"
            max={maxGrams}
          />
        </label>
        {Number(grams) > 0 && (
          <div className="mb-4 rounded-2xl bg-green-50 p-3 text-center">
            <p className="text-sm text-gray-600">السعر الإجمالي</p>
            <b className="text-2xl text-[#0d6a42]">{money(price)}</b>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={confirm} className="btn-primary h-12 font-black">إضافة للسلة</button>
          <button onClick={onClose} className="btn-ghost h-12 font-bold">إلغاء</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong, good }) {
  return <div className={`flex justify-between py-2 ${strong ? "text-2xl font-black" : ""}`}><span>{label}</span><b className={good ? "text-[#0d6a42]" : ""}>{value}</b></div>;
}

function Invoice() {
  const invoice = JSON.parse(sessionStorage.getItem("lastInvoice") || "null");
  const [autoM110, setAutoM110] = useState(false);

  // طباعة تلقائية M110 بعد البيع
  useEffect(() => {
    if (sessionStorage.getItem("triggerPrintM110") === "1") {
      sessionStorage.removeItem("triggerPrintM110");
      setAutoM110(true); // يُظهر مودال الإيصال تلقائياً
    }
  }, []);

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

        {/* رأس ثانوي (محجوب في الشاشة — الإيصال M110 يُستخدم بدلًا من هذا) */}

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
                  <td className="p-3">
                    {i.name}
                    {i.isWeightBased && <span className="mr-1 text-xs text-amber-600">⚖️</span>}
                  </td>
                  <td className="p-3">
                    {i.isWeightBased ? `${i.quantity}غ` : `${i.quantity} ${i.unit}`}
                  </td>
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
          <PrintM110ReceiptBtn invoice={invoice} />
          <button onClick={() => navigator.share?.({ title: "فاتورة", text: `فاتورة #${invoice.invoiceNumber} - الإجمالي: ${money(invoice.total)}` })} className="btn-ghost h-14 font-black text-[#0d6a42]">
            <Share2 className="inline" /> مشاركة
          </button>
          <button onClick={() => window.history.back()} className="btn-ghost h-14 font-black">
            <ArrowLeft className="inline" /> رجوع
          </button>
        </div>
        {/* طباعة تلقائية M110 بعد البيع */}
        {autoM110 && <PrintM110ReceiptBtn invoice={invoice} />}
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
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Stat icon={BarChart3} title="المبيعات" value={number(totalSales)} unit="دج" hint={`فلتر: ${period}`} /><Stat icon={WalletCards} title="الأرباح" value={number(profit)} unit="دج" hint="" /><Stat icon={FileText} title="إجمالي الديون" value={number(debt)} unit="دج" hint="قابل للتحصيل" tone="red" /><Stat icon={Package} title="أكثر المنتجات مبيعًا" value={products[0]?.name || "—"} unit="" hint="" /></section>
      <div className="mt-6 grid gap-6 xl:grid-cols-2"><section className="card p-5"><h2 className="mb-4 text-2xl font-black">المبيعات خلال الأسبوع</h2><div className="h-80"><ResponsiveContainer><AreaChart data={week}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" /><YAxis /><Tooltip formatter={(v) => money(v)} /><Area dataKey="sales" stroke="#0d6a42" fill="#e6f2e9" strokeWidth={3} /></AreaChart></ResponsiveContainer></div></section><section className="card p-5"><h2 className="mb-4 text-2xl font-black">توزيع المبيعات حسب الفئات</h2><div className="h-80"><ResponsiveContainer><PieChart><Pie data={byCat} dataKey="value" nameKey="name" innerRadius={70} outerRadius={120}>{byCat.map((_, i) => <Cell key={i} fill={["#0d6a42", "#4c78a8", "#f59e0b", "#9cc69b", "#ef4444", "#d1d5db"][i]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></section></div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2"><ReportList title="تقرير نقص المخزون" items={low.map((p) => `${p.name} - الكمية الحالية ${p.quantity}`)} /><ReportList title="أكثر المنتجات مبيعًا" items={products.slice(0, 5).map((p, i) => `${i + 1}. ${p.name}`)} /></div>
    </Page>
  );
}

function ReportList({ title, items }) {
  return <section className="card p-5"><h2 className="mb-4 text-2xl font-black">{title}</h2><div className="divide-y">{items.length ? items.map((item) => <p key={item} className="py-3">{item}</p>) : <p className="py-3 text-gray-500">لا توجد بيانات حالية.</p>}</div></section>;
}

/* ══════════════════════════════════════════════
   شريط حالة الشبكة والمزامنة
══════════════════════════════════════════════ */
function NetworkStatusBar({ sync }) {
  const { isOnline, pendingCount, syncStatus, notification, forceSync } = sync;
  const [visible, setVisible] = useState(false);

  // أظهر الشريط عند تغيير الحالة
  useEffect(() => {
    setVisible(!isOnline || pendingCount > 0 || notification !== null);
  }, [isOnline, pendingCount, notification]);

  if (!visible) return null;

  let barClass = "fixed top-0 inset-x-0 z-[60] no-print";
  let content;

  if (!isOnline) {
    barClass += " bg-gray-800 text-white";
    content = (
      <div className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold">
        <WifiOff size={15} />
        <span>غير متصل بالإنترنت — التغييرات تُحفظ محلياً{pendingCount > 0 ? ` (${pendingCount} معلقة)` : ""}</span>
      </div>
    );
  } else if (syncStatus === "syncing") {
    barClass += " bg-blue-600 text-white";
    content = (
      <div className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold">
        <RefreshCw size={15} className="animate-spin" />
        <span>جاري مزامنة البيانات...</span>
      </div>
    );
  } else if (notification) {
    const isError = syncStatus === "error" || syncStatus === "partial";
    barClass += isError ? " bg-orange-500 text-white" : " bg-[#0d6a42] text-white";
    content = (
      <div className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold">
        {isError ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
        <span>{notification}</span>
        {pendingCount > 0 && isOnline && (
          <button onClick={forceSync} className="mr-3 rounded-full bg-white/20 px-3 py-0.5 text-xs hover:bg-white/30">
            إعادة المحاولة
          </button>
        )}
        <button onClick={() => setVisible(false)} className="mr-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">×</button>
      </div>
    );
  } else if (isOnline && pendingCount > 0) {
    barClass += " bg-yellow-500 text-white";
    content = (
      <div className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold">
        <Clock size={15} />
        <span>{pendingCount} عملية بانتظار المزامنة</span>
        <button onClick={forceSync} className="mr-3 rounded-full bg-white/20 px-3 py-0.5 text-xs hover:bg-white/30">
          مزامنة الآن
        </button>
      </div>
    );
  } else {
    return null;
  }

  return <div className={barClass}>{content}</div>;
}

/* ══════════════════════════════════════════════
   صفحة تنبيهات الصلاحية
══════════════════════════════════════════════ */
function ExpiryAlerts() {
  const { data: products } = useCollection("products");

  const withExpiry = products.filter((p) => p.expiryDate);
  const expired = withExpiry.filter((p) => getExpiryStatus(p.expiryDate)?.status === "expired");
  const critical = withExpiry.filter((p) => getExpiryStatus(p.expiryDate)?.status === "critical");
  const warning = withExpiry.filter((p) => getExpiryStatus(p.expiryDate)?.status === "warning");

  const expiredSorted = sortByExpiry(expired, "asc");
  const criticalSorted = sortByExpiry(critical, "asc");
  const warningSorted = sortByExpiry(warning, "asc");

  return (
    <Page title="تنبيهات الصلاحية">
      {/* إحصائيات سريعة */}
      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="card border-red-200 p-5 bg-red-50/50">
          <div className="mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-red-100 text-red-700"><AlertTriangle /></div>
          <h3 className="font-black text-red-800">منتهية الصلاحية</h3>
          <div className="mt-1 text-4xl font-black text-red-700">{expired.length}</div>
          <p className="mt-1 text-sm text-red-600">منتج</p>
        </div>
        <div className="card border-orange-200 p-5 bg-orange-50/50">
          <div className="mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-orange-100 text-orange-700"><Clock /></div>
          <h3 className="font-black text-orange-800">تنتهي خلال أسبوع</h3>
          <div className="mt-1 text-4xl font-black text-orange-700">{critical.length}</div>
          <p className="mt-1 text-sm text-orange-600">منتج</p>
        </div>
        <div className="card border-yellow-200 p-5 bg-yellow-50/50">
          <div className="mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-yellow-100 text-yellow-700"><Bell /></div>
          <h3 className="font-black text-yellow-800">تنتهي خلال شهر</h3>
          <div className="mt-1 text-4xl font-black text-yellow-700">{warning.length}</div>
          <p className="mt-1 text-sm text-yellow-600">منتج</p>
        </div>
      </section>

      {expired.length === 0 && critical.length === 0 && warning.length === 0 && (
        <div className="card p-10 text-center">
          <CheckCircle2 size={56} className="mx-auto mb-4 text-[#0d6a42]" />
          <h2 className="text-2xl font-black text-[#063f2b]">لا توجد تنبيهات</h2>
          <p className="mt-2 text-gray-500">جميع المنتجات ذات التواريخ المضبوطة في حالة جيدة</p>
        </div>
      )}

      {/* منتهية الصلاحية */}
      {expiredSorted.length > 0 && (
        <ExpirySection title="⛔ منتهية الصلاحية" products={expiredSorted} colorClass="border-red-300 bg-red-50" />
      )}

      {/* تنتهي خلال أسبوع */}
      {criticalSorted.length > 0 && (
        <ExpirySection title="🔴 تنتهي خلال أسبوع" products={criticalSorted} colorClass="border-orange-300 bg-orange-50" />
      )}

      {/* تنتهي خلال شهر */}
      {warningSorted.length > 0 && (
        <ExpirySection title="🟠 تنتهي خلال شهر" products={warningSorted} colorClass="border-yellow-200 bg-yellow-50/50" />
      )}
    </Page>
  );
}

function ExpirySection({ title, products, colorClass }) {
  return (
    <section className={`card mb-6 overflow-hidden border ${colorClass}`}>
      <div className="flex items-center justify-between p-5">
        <h2 className="text-xl font-black">{title}</h2>
        <span className="rounded-full bg-white/70 px-3 py-1 text-sm font-bold">{products.length} منتجات</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-right">
          <thead className="bg-black/5">
            <tr>
              {["المنتج", "الكمية", "تاريخ الانتهاء", "الحالة", ""].map((h) => (
                <th key={h} className="p-4 text-sm">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const expiry = getExpiryStatus(p.expiryDate);
              return (
                <tr key={p.id} className="border-t border-black/5">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <ProductImage p={p} className="h-12 w-12" />
                      <div>
                        <b>{p.name}</b>
                        <p className="text-xs text-gray-500">{p.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-black text-[#0d6a42]">{p.quantity} {p.unit}</td>
                  <td className="p-4">
                    <div>
                      <b>{formatExpiryDate(p.expiryDate)}</b>
                    </div>
                  </td>
                  <td className="p-4">
                    {expiry && <span className={expiry.badgeClass}>{expiry.label}</span>}
                  </td>
                  <td className="p-4">
                    <Link to={`/products/${p.id}/edit`} className="btn-ghost px-3 py-2 text-sm">
                      <Edit3 size={14} className="inline ml-1" /> تعديل
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default App;
