/**
 * PhomemoPrint.jsx
 * صفحة إعدادات الطباعة الحرارية (Phomemo / طابعات حرارية)
 * + مكوّن طباعة بطاقة منتج (Product Label)
 */

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { money } from "./lib/format";

/* ══════════════════════════════════════════════
   إعدادات الطباعة (localStorage)
══════════════════════════════════════════════ */

export function useThermalSettings() {
  const [paperWidth, setPaperWidthRaw] = useState(
    () => localStorage.getItem("thermalPaperWidth") || "80"
  );
  const [printerName, setPrinterNameRaw] = useState(
    () => localStorage.getItem("thermalPrinterName") || "Phomemo"
  );
  const [storeName, setStoreNameRaw] = useState(
    () => localStorage.getItem("thermalStoreName") || "متجر المواد الغذائية"
  );
  const [footerMsg, setFooterMsgRaw] = useState(
    () => localStorage.getItem("thermalFooter") || "شكراً لتعاملكم معنا 🌿"
  );
  const [showLogo, setShowLogoRaw] = useState(
    () => localStorage.getItem("thermalShowLogo") !== "false"
  );

  function set(key, setFn, storageKey) {
    return (v) => {
      localStorage.setItem(storageKey, String(v));
      setFn(v);
    };
  }

  return {
    paperWidth,
    setPaperWidth: set("paperWidth", setPaperWidthRaw, "thermalPaperWidth"),
    printerName,
    setPrinterName: set("printerName", setPrinterNameRaw, "thermalPrinterName"),
    storeName,
    setStoreName: set("storeName", setStoreNameRaw, "thermalStoreName"),
    footerMsg,
    setFooterMsg: set("footerMsg", setFooterMsgRaw, "thermalFooter"),
    showLogo,
    setShowLogo: set("showLogo", setShowLogoRaw, "thermalShowLogo"),
  };
}

/* ══════════════════════════════════════════════
   صفحة إعدادات الطباعة الحرارية
══════════════════════════════════════════════ */

export function PrintSettingsPage() {
  const s = useThermalSettings();
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function testPrint() {
    const el = document.getElementById("thermal-test-receipt");
    if (!el) return;
    document.body.classList.add(`receipt-${s.paperWidth}`);
    // إخفاء كل شيء ما عدا الإيصال التجريبي
    const oldDisplay = el.style.display;
    el.style.display = "block";
    window.print();
    el.style.display = oldDisplay;
    document.body.classList.remove(`receipt-${s.paperWidth}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="card p-6">
        <h2 className="mb-6 text-2xl font-black text-[#063f2b]">⚙️ إعدادات الطابعة الحرارية</h2>

        {/* اسم المتجر في الإيصال */}
        <label className="mb-4 block">
          <span className="mb-1 block font-bold">اسم المتجر في الإيصال</span>
          <input
            className="input"
            value={s.storeName}
            onChange={(e) => s.setStoreName(e.target.value)}
          />
        </label>

        {/* نص التذييل */}
        <label className="mb-4 block">
          <span className="mb-1 block font-bold">رسالة التذييل</span>
          <input
            className="input"
            value={s.footerMsg}
            onChange={(e) => s.setFooterMsg(e.target.value)}
          />
        </label>

        {/* عرض الورق */}
        <label className="mb-4 block">
          <span className="mb-1 block font-bold">عرض الورق الحراري</span>
          <select
            className="input"
            value={s.paperWidth}
            onChange={(e) => s.setPaperWidth(e.target.value)}
          >
            <option value="53">53mm — Phomemo M02 / M02 Pro</option>
            <option value="58">58mm — طابعة حرارية صغيرة</option>
            <option value="80">80mm — طابعة حرارية متوسطة</option>
            <option value="110">110mm — طابعة حرارية كبيرة</option>
          </select>
        </label>

        {/* اسم الطابعة (للمرجع فقط) */}
        <label className="mb-4 block">
          <span className="mb-1 block font-bold">نوع الطابعة (للمرجع)</span>
          <input
            className="input"
            value={s.printerName}
            onChange={(e) => s.setPrinterName(e.target.value)}
            placeholder="Phomemo M02..."
          />
        </label>

        {/* إظهار الشعار */}
        <label className="mb-6 flex cursor-pointer items-center gap-3 rounded-2xl border bg-green-50 p-4">
          <input
            type="checkbox"
            className="h-5 w-5 accent-[#0d6a42]"
            checked={s.showLogo}
            onChange={(e) => s.setShowLogo(e.target.checked)}
          />
          <div>
            <b>إظهار الشعار في الإيصال</b>
            <p className="text-xs text-gray-500">بعض الطابعات الضيقة لا تدعم الصور</p>
          </div>
        </label>

        <div className="flex flex-wrap gap-3">
          <button onClick={save} className="btn-primary h-12 px-6 font-black">
            {saved ? "✓ تم الحفظ" : "حفظ الإعدادات"}
          </button>
          <button onClick={testPrint} className="btn-ghost h-12 px-6 font-black text-[#0d6a42]">
            🖨️ طباعة تجريبية
          </button>
        </div>
      </div>

      {/* معلومات الطابعات المدعومة */}
      <div className="card p-6">
        <h3 className="mb-4 text-xl font-black">الطابعات الحرارية المدعومة</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            { name: "Phomemo M02", width: "53mm", note: "بلوتوث — الأكثر شيوعاً" },
            { name: "Phomemo M02 Pro", width: "53mm", note: "بلوتوث — دقة عالية" },
            { name: "Phomemo T02", width: "53mm", note: "بلوتوث — صغير الحجم" },
            { name: "طابعة 58mm عادية", width: "58mm", note: "USB / بلوتوث" },
            { name: "طابعة 80mm عادية", width: "80mm", note: "USB / شبكة" },
            { name: "طابعة 110mm عادية", width: "110mm", note: "USB / شبكة" },
          ].map((p) => (
            <div key={p.name} className="soft-card p-3">
              <b className="text-[#0d6a42]">{p.name}</b>
              <p className="text-sm text-gray-500">العرض: {p.width} — {p.note}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <b>كيفية الاستخدام مع Phomemo:</b>
          <ol className="mt-2 list-decimal list-inside space-y-1 text-right">
            <li>اربط الطابعة بالجهاز عبر البلوتوث</li>
            <li>افتح إعدادات الطابعة في المتصفح (اختر Phomemo كطابعة)</li>
            <li>اضغط "طباعة" من صفحة الفاتورة</li>
            <li>حدد الطابعة Phomemo من قائمة الطابعات</li>
          </ol>
        </div>
      </div>

      {/* إيصال تجريبي مخفي */}
      <TestReceipt settings={s} />
    </div>
  );
}

function TestReceipt({ settings }) {
  return (
    <div id="thermal-test-receipt" className="receipt-page hidden">
      <div className="text-center">
        <b className="block text-base">{settings.storeName}</b>
        <div className="border-t border-dashed my-1" />
        <p className="text-xs">إيصال تجريبي</p>
        <p className="text-xs">عرض الورق: {settings.paperWidth}mm</p>
        <div className="border-t border-dashed my-1" />
        <p className="text-xs">المنتج الأول ....... 100.00 دج</p>
        <p className="text-xs">المنتج الثاني ...... 250.00 دج</p>
        <div className="border-t border-dashed my-1" />
        <b className="text-sm">الإجمالي: 350.00 دج</b>
        <div className="border-t border-dashed my-1" />
        <p className="text-xs">{settings.footerMsg}</p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   بطاقة منتج للطباعة الحرارية (Product Label)
══════════════════════════════════════════════ */

export function ProductLabel({ product, width = "80" }) {
  const canvasRef = useRef(null);
  const storeName = localStorage.getItem("thermalStoreName") || "متجر المواد الغذائية";

  useEffect(() => {
    if (!canvasRef.current) return;
    const code = product.qrCode || product.barcode || product.id;
    QRCode.toCanvas(canvasRef.current, code, {
      width: 80,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    }).catch(console.error);
  }, [product]);

  return (
    <div
      className="product-label receipt-page"
      style={{ width: `${width}mm`, fontFamily: "monospace", fontSize: "10px", padding: "4px" }}
    >
      <div style={{ textAlign: "center", borderBottom: "1px dashed #000", paddingBottom: "4px", marginBottom: "4px" }}>
        <b style={{ display: "block", fontSize: "11px" }}>{storeName}</b>
      </div>
      <b style={{ display: "block", fontSize: "12px", textAlign: "center" }}>{product.name}</b>
      <div style={{ display: "flex", justifyContent: "center", margin: "4px 0" }}>
        <canvas ref={canvasRef} />
      </div>
      {product.barcode && (
        <p style={{ textAlign: "center", fontSize: "9px", letterSpacing: "1px" }}>{product.barcode}</p>
      )}
      <div style={{ borderTop: "1px dashed #000", marginTop: "4px", paddingTop: "4px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>سعر البيع:</span>
          <b>{money(product.salePrice)}</b>
        </div>
        {product.isWeightBased && (
          <p style={{ fontSize: "9px", textAlign: "center" }}>سعر الكغ — يُباع بالغرام</p>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   زر طباعة بطاقة المنتج (يُستخدم في جدول المخزون)
══════════════════════════════════════════════ */

export function PrintLabelButton({ product }) {
  const [show, setShow] = useState(false);
  const width = localStorage.getItem("thermalPaperWidth") || "80";

  function printLabel() {
    setShow(true);
    setTimeout(() => {
      document.body.classList.add(`receipt-${width}`);
      window.print();
      document.body.classList.remove(`receipt-${width}`);
      setShow(false);
    }, 200);
  }

  return (
    <>
      <button
        onClick={printLabel}
        title="طباعة بطاقة المنتج"
        className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600"
      >
        🏷️
      </button>
      {show && (
        <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
          <ProductLabel product={product} width={width} />
        </div>
      )}
    </>
  );
}
