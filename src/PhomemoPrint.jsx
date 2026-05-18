/**
 * PhomemoPrint.jsx
 * نظام الطباعة الحراري — مخصص حصريًا لطابعة Phomemo M110
 *
 * المكونات المُصدَّرة:
 *   M110SettingsPage      — صفحة إعدادات الطابعة
 *   PrintM110LabelBtn     — زر طباعة ملصق منتج (للمخزون / تعديل المنتج)
 *   PrintM110ReceiptBtn   — زر طباعة إيصال مصغر (صفحة الفاتورة)
 *   WeightSaleLabelModal  — ملصق وزن بعد البيع (نقطة البيع)
 */

import JsBarcode from "jsbarcode";
import { Copy, Printer, Settings2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { money } from "./lib/format";
import {
  DEFAULT_M110,
  LABEL_SIZES,
  saveM110Settings,
  subscribeM110Settings,
} from "./lib/m110Service";

/* ══════════════════════════════════════════
   Hook — إعدادات M110 من Firebase
══════════════════════════════════════════ */
export function useM110Settings() {
  const [settings, setSettings] = useState({ ...DEFAULT_M110 });
  useEffect(() => {
    const unsub = subscribeM110Settings(setSettings);
    return unsub;
  }, []);
  return settings;
}

/* ══════════════════════════════════════════
   مكوّن الباركود (JsBarcode → SVG)
══════════════════════════════════════════ */
function BarcodeDisplay({ value, height = 28, fontSize = 7, displayValue = true }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !value?.trim()) return;
    try {
      JsBarcode(svgRef.current, String(value).trim(), {
        format: "CODE128",
        height,
        fontSize,
        margin: 0,
        displayValue,
        fontOptions: "bold",
        lineColor: "#000000",
        background: "#ffffff",
        textAlign: "center",
        textMargin: 1,
      });
    } catch {
      /* قيمة باركود غير صالحة */
    }
  }, [value, height, fontSize, displayValue]);

  if (!value?.trim()) {
    return (
      <p style={{ fontSize: "7px", color: "#999", textAlign: "center", margin: 0 }}>
        لا يوجد باركود
      </p>
    );
  }
  return <svg ref={svgRef} style={{ width: "100%", maxHeight: `${height + 14}px`, display: "block" }} />;
}

/* ══════════════════════════════════════════
   تنسيق التاريخ للملصق
══════════════════════════════════════════ */
function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
function today() {
  return fmtDate(new Date().toISOString());
}

/* ══════════════════════════════════════════
   ① ملصق المنتج الكامل
══════════════════════════════════════════ */
function ProductLabelContent({ product, settings, labelKey }) {
  const size = LABEL_SIZES[labelKey] || LABEL_SIZES["40x30"];
  const isReceipt = labelKey === "receipt";
  const w = size.w;
  const h = size.h;
  const isSmall = w <= 30;
  const nameFontSize = isSmall ? "6.5px" : "8px";
  const priceFontSize = isSmall ? "7px" : "9px";
  const bcHeight = isSmall ? 18 : h && h <= 30 ? 22 : 32;
  const storeFontSize = "5.5px";

  // سعر المنتجات الوزنية
  const weightPrice =
    product.isWeightBased && settings.showPrice
      ? settings.weightPriceMode === "per100g"
        ? `100غ = ${money((product.salePrice || 0) / 10)}`
        : `1كغ = ${money(product.salePrice || 0)}`
      : null;

  return (
    <div
      style={{
        width: isReceipt ? "57mm" : `${w}mm`,
        height: h ? `${h}mm` : undefined,
        padding: isSmall ? "1mm" : "1.5mm",
        fontFamily: "'Tajawal','Cairo',Arial,sans-serif",
        direction: "rtl",
        overflow: "hidden",
        boxSizing: "border-box",
        background: "#fff",
        color: "#000",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: "0.5mm",
      }}
    >
      {/* اسم المنتج */}
      {settings.showProductName && (
        <div
          style={{
            fontWeight: 900,
            fontSize: nameFontSize,
            lineHeight: 1.2,
            wordBreak: "break-word",
            textAlign: "right",
          }}
        >
          {product.name}
        </div>
      )}

      {/* السعر */}
      {settings.showPrice && (
        <div style={{ fontSize: priceFontSize, fontWeight: 900 }}>
          {product.isWeightBased ? weightPrice : `السعر: ${money(product.salePrice)}`}
        </div>
      )}

      {/* الوحدة */}
      {settings.showUnit && product.unit && (
        <div style={{ fontSize: "6.5px", color: "#333" }}>
          {product.unit}
        </div>
      )}

      {/* الباركود */}
      {settings.showBarcode && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <BarcodeDisplay value={product.barcode || product.qrCode} height={bcHeight} fontSize={6} />
        </div>
      )}

      {/* الكود الداخلي */}
      {settings.showInternalCode && product.id && (
        <div style={{ fontSize: "5px", color: "#555" }}>ID: {product.id.slice(-8)}</div>
      )}

      {/* تاريخ الانتهاء */}
      {settings.showExpiryDate && product.expiryDate && (
        <div style={{ fontSize: "6px", fontWeight: 700 }}>
          EXP: {fmtDate(product.expiryDate)}
        </div>
      )}

      {/* اسم المتجر */}
      {settings.showStoreName && (
        <div style={{ fontSize: storeFontSize, color: "#555", textAlign: "center", borderTop: "0.3px solid #ccc", paddingTop: "0.3mm" }}>
          {settings.receiptHeader}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   ② ملصق السعر السريع
══════════════════════════════════════════ */
function PriceLabelContent({ product, settings, labelKey }) {
  const size = LABEL_SIZES[labelKey] || LABEL_SIZES["40x30"];
  const w = size.w;
  const h = size.h;
  const isSmall = w <= 30;
  const barcodeOptional = settings.showBarcode;

  const weightPrice =
    product.isWeightBased
      ? settings.weightPriceMode === "per100g"
        ? `100غ = ${money((product.salePrice || 0) / 10)}`
        : `1كغ = ${money(product.salePrice || 0)}`
      : money(product.salePrice || 0);

  return (
    <div
      style={{
        width: `${w}mm`,
        height: h ? `${h}mm` : undefined,
        padding: "1.5mm",
        fontFamily: "'Tajawal','Cairo',Arial,sans-serif",
        direction: "rtl",
        overflow: "hidden",
        boxSizing: "border-box",
        background: "#fff",
        color: "#000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1mm",
        textAlign: "center",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: isSmall ? "7px" : "9px", lineHeight: 1.2 }}>
        {product.name}
      </div>
      <div style={{ fontWeight: 900, fontSize: isSmall ? "11px" : "14px", lineHeight: 1 }}>
        {weightPrice}
      </div>
      {product.isWeightBased && (
        <div style={{ fontSize: "5.5px", color: "#444" }}>يباع بالغرام</div>
      )}
      {barcodeOptional && (
        <BarcodeDisplay value={product.barcode || product.qrCode} height={isSmall ? 14 : 20} fontSize={5} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   ③ ملصق الباركود فقط
══════════════════════════════════════════ */
function BarcodeLabelContent({ product, settings, labelKey }) {
  const size = LABEL_SIZES[labelKey] || LABEL_SIZES["40x30"];
  const w = size.w;
  const h = size.h;
  const isSmall = w <= 30;

  if (!product.barcode && !product.qrCode) {
    return (
      <div
        style={{
          width: `${w}mm`,
          height: h ? `${h}mm` : undefined,
          padding: "2mm",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial",
          fontSize: "7px",
          color: "#999",
          direction: "rtl",
        }}
      >
        لا يوجد باركود لهذا المنتج
      </div>
    );
  }

  return (
    <div
      style={{
        width: `${w}mm`,
        height: h ? `${h}mm` : undefined,
        padding: "1mm",
        fontFamily: "'Tajawal','Cairo',Arial,sans-serif",
        direction: "rtl",
        overflow: "hidden",
        boxSizing: "border-box",
        background: "#fff",
        color: "#000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5mm",
      }}
    >
      {settings.showProductName && (
        <div style={{ fontWeight: 700, fontSize: isSmall ? "6px" : "7.5px", textAlign: "center" }}>
          {product.name.length > 20 ? product.name.slice(0, 18) + "…" : product.name}
        </div>
      )}
      <BarcodeDisplay
        value={product.barcode || product.qrCode}
        height={isSmall ? 20 : h && h <= 30 ? 26 : 36}
        fontSize={isSmall ? 6 : 7}
      />
    </div>
  );
}

/* ══════════════════════════════════════════
   ④ ملصق وزن البيع (بعد بيع منتج وزني)
══════════════════════════════════════════ */
function WeightSaleLabelContent({ product, grams, totalPrice, settings, labelKey }) {
  const size = LABEL_SIZES[labelKey] || LABEL_SIZES["40x30"];
  const w = size.w;
  const h = size.h;
  const isSmall = w <= 30;
  const ref = Math.random().toString(36).slice(2, 8).toUpperCase();

  return (
    <div
      style={{
        width: `${w}mm`,
        height: h ? `${h}mm` : undefined,
        padding: "1.5mm",
        fontFamily: "'Tajawal','Cairo',Arial,sans-serif",
        direction: "rtl",
        overflow: "hidden",
        boxSizing: "border-box",
        background: "#fff",
        color: "#000",
        display: "flex",
        flexDirection: "column",
        gap: "0.5mm",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: isSmall ? "7px" : "9px", lineHeight: 1.2 }}>
        {product.name}
      </div>
      <div style={{ fontSize: isSmall ? "7px" : "8.5px", fontWeight: 700 }}>
        الوزن: {grams}غ
      </div>
      <div style={{ fontSize: isSmall ? "8px" : "10px", fontWeight: 900 }}>
        السعر: {money(totalPrice)}
      </div>
      <div style={{ fontSize: "5.5px", color: "#444" }}>
        التاريخ: {today()}
      </div>
      {settings.showBarcode && (
        <BarcodeDisplay value={product.barcode || product.qrCode || ref} height={isSmall ? 16 : 22} fontSize={6} />
      )}
      {settings.showStoreName && (
        <div style={{ fontSize: "5px", color: "#555", textAlign: "center", marginTop: "auto" }}>
          {settings.receiptHeader}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   ⑤ إيصال M110 المصغر
══════════════════════════════════════════ */
function M110ReceiptContent({ invoice, settings }) {
  return (
    <div
      style={{
        width: "57mm",
        padding: "2mm",
        fontFamily: "'Tajawal','Cairo',Arial,sans-serif",
        fontSize: "8px",
        direction: "rtl",
        background: "#fff",
        color: "#000",
        lineHeight: 1.4,
      }}
    >
      {/* الرأس */}
      <div style={{ textAlign: "center", marginBottom: "1mm" }}>
        <div style={{ fontWeight: 900, fontSize: "10px" }}>{settings.receiptHeader}</div>
      </div>
      <div style={{ borderTop: "0.5px dashed #000", margin: "1mm 0" }} />

      {/* رقم الفاتورة والتاريخ */}
      <div>فاتورة #{invoice.invoiceNumber}</div>
      <div>{invoice.createdAt ? new Date(invoice.createdAt).toLocaleString("ar-DZ") : today()}</div>
      <div>{invoice.paymentMethod === "cash" ? "نقدي" : `كريديت — ${invoice.customerName || ""}` }</div>
      <div style={{ borderTop: "0.5px dashed #000", margin: "1mm 0" }} />

      {/* المنتجات */}
      {invoice.items?.map((item, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: "1mm" }}>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.name.length > 14 ? item.name.slice(0, 13) + "…" : item.name}
            {item.isWeightBased ? ` ${item.quantity}غ` : ` ×${item.quantity}`}
          </span>
          <span style={{ whiteSpace: "nowrap", fontWeight: 700 }}>
            {Math.round(item.total)}
          </span>
        </div>
      ))}

      <div style={{ borderTop: "0.5px dashed #000", margin: "1mm 0" }} />

      {/* المجاميع */}
      {Number(invoice.discount) > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>الخصم</span><span>{money(invoice.discount)}</span>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: "9px" }}>
        <span>الإجمالي</span><span>{money(invoice.total)}</span>
      </div>
      {invoice.paymentMethod === "cash" && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>المدفوع</span><span>{money(invoice.paidAmount)}</span>
        </div>
      )}
      {invoice.paymentMethod === "credit" && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>مستحق</span><span>{money(invoice.remainingAmount)}</span>
        </div>
      )}

      <div style={{ borderTop: "0.5px dashed #000", margin: "1mm 0" }} />
      <div style={{ textAlign: "center", fontSize: "7px" }}>{settings.receiptFooter}</div>
    </div>
  );
}

/* ══════════════════════════════════════════
   أداة الطباعة — تُطبع منطقة محددة بمقاس mm
══════════════════════════════════════════ */
let _printStyleEl = null;
function printArea(areaId, widthMm, heightMm) {
  if (!_printStyleEl) {
    _printStyleEl = document.createElement("style");
    _printStyleEl.id = "m110-dynamic-print";
    document.head.appendChild(_printStyleEl);
  }
  const sizeStr = heightMm ? `${widthMm}mm ${heightMm}mm` : `${widthMm}mm auto`;
  _printStyleEl.textContent = `
    @media print {
      @page { size: ${sizeStr}; margin: 0mm; }

      /* إخفاء كل شيء بـ visibility (يمكن للأبناء تجاوزه) وليس display:none */
      body {
        visibility: hidden !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
      }

      /* إظهار منطقة الطباعة فقط */
      #${areaId} {
        visibility: visible !important;
        display: block !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: ${widthMm}mm !important;
        ${heightMm ? `height: ${heightMm}mm !important; overflow: hidden !important;` : ""}
        direction: rtl !important;
        background: #fff !important;
      }

      /* إظهار كل أبناء منطقة الطباعة */
      #${areaId} * {
        visibility: visible !important;
        color: #000 !important;
        background: transparent !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      /* حفاظ على خلفية بيضاء للحاويات الرئيسية داخل منطقة الطباعة */
      #${areaId} > div {
        background: #fff !important;
      }
    }
  `;
  window.print();
  _printStyleEl.textContent = "";
}

/* ══════════════════════════════════════════
   مودال المعاينة والطباعة العام
══════════════════════════════════════════ */
const LABEL_MODES = [
  { id: "product", label: "ملصق منتج كامل" },
  { id: "price",   label: "ملصق سعر سريع" },
  { id: "barcode", label: "ملصق باركود فقط" },
];

function M110PreviewModal({ product, initialMode = "product", weightData, onClose }) {
  const settings = useM110Settings();
  const [labelKey, setLabelKey] = useState(settings.defaultLabelSize || "40x30");
  const [mode, setMode] = useState(initialMode);
  const [copies, setCopies] = useState(settings.defaultCopies || 1);
  const printAreaId = "m110-label-print-area";
  const size = LABEL_SIZES[labelKey] || LABEL_SIZES["40x30"];
  const isReceipt = labelKey === "receipt";

  // حجم المعاينة — نكبّره 4× للوضوح على الشاشة
  const previewScale = isReceipt ? 2 : 4;

  function renderLabel() {
    if (weightData) {
      return (
        <WeightSaleLabelContent
          product={product}
          grams={weightData.grams}
          totalPrice={weightData.totalPrice}
          settings={settings}
          labelKey={labelKey}
        />
      );
    }
    switch (mode) {
      case "price":   return <PriceLabelContent   product={product} settings={settings} labelKey={labelKey} />;
      case "barcode": return <BarcodeLabelContent  product={product} settings={settings} labelKey={labelKey} />;
      default:        return <ProductLabelContent  product={product} settings={settings} labelKey={labelKey} />;
    }
  }

  function doPrint() {
    printArea(printAreaId, size.w, size.h);
  }

  return (
    <>
      {/* منطقة الطباعة المخفية (خارج الشاشة) */}
      <div id={printAreaId} style={{ position: "fixed", left: "-9999px", top: 0 }}>
        {Array.from({ length: Math.max(1, copies) }, (_, i) => (
          <div key={i} style={{ pageBreakAfter: i < copies - 1 ? "always" : "auto" }}>
            {renderLabel()}
          </div>
        ))}
      </div>

      {/* المودال */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <div
          className="card w-full max-w-lg overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* رأس المودال */}
          <div className="flex items-center justify-between border-b bg-gray-50 p-4">
            <h2 className="text-lg font-black">🖨️ معاينة الطباعة — M110</h2>
            <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200">
              <X size={16} />
            </button>
          </div>

          <div className="p-5">
            {/* نوع الملصق + حجمه */}
            {!weightData && (
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-500">نوع الملصق</label>
                  <select
                    className="input text-sm"
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                  >
                    {LABEL_MODES.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-500">مقاس الملصق</label>
                  <select
                    className="input text-sm"
                    value={labelKey}
                    onChange={(e) => setLabelKey(e.target.value)}
                  >
                    {Object.entries(LABEL_SIZES).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            {weightData && (
              <div className="mb-4">
                <label className="mb-1 block text-xs font-bold text-gray-500">مقاس الملصق</label>
                <select
                  className="input text-sm"
                  value={labelKey}
                  onChange={(e) => setLabelKey(e.target.value)}
                >
                  {Object.entries(LABEL_SIZES).filter(([k]) => k !== "receipt").map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* المعاينة */}
            <div className="mb-4 flex items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-4">
              <div
                style={{
                  transform: `scale(${previewScale})`,
                  transformOrigin: "top center",
                  marginBottom: size.h ? `${size.h * previewScale - size.h}px` : "60px",
                  border: "0.3px solid #ccc",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                }}
              >
                {renderLabel()}
              </div>
            </div>

            {/* معلومات */}
            <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs text-gray-500">
              <div className="rounded-xl bg-gray-50 py-2">
                <b className="block text-gray-800">
                  {isReceipt ? "57" : size.w}×{isReceipt ? "auto" : size.h}مم
                </b>
                مقاس الورق
              </div>
              <div className="rounded-xl bg-gray-50 py-2">
                {product.barcode || product.qrCode
                  ? <b className="block text-green-700">✓ يوجد</b>
                  : <b className="block text-red-500">✗ لا يوجد</b>}
                الباركود
              </div>
              <div className="rounded-xl bg-gray-50 py-2">
                {product.expiryDate
                  ? <b className="block text-green-700">{fmtDate(product.expiryDate)}</b>
                  : <b className="block text-gray-400">—</b>}
                تاريخ الانتهاء
              </div>
            </div>

            {/* عدد النسخ */}
            <div className="mb-5 flex items-center gap-3">
              <Copy size={16} className="text-gray-500" />
              <span className="text-sm font-bold">عدد النسخ:</span>
              <div className="flex items-center rounded-xl border">
                <button
                  onClick={() => setCopies((c) => Math.max(1, c - 1))}
                  className="px-3 py-2 text-lg font-bold hover:bg-gray-50"
                >
                  −
                </button>
                <span className="w-10 text-center font-black">{copies}</span>
                <button
                  onClick={() => setCopies((c) => Math.min(20, c + 1))}
                  className="px-3 py-2 text-lg font-bold hover:bg-gray-50"
                >
                  +
                </button>
              </div>
              <span className="text-xs text-gray-400">نسخة</span>
            </div>

            {/* أزرار */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={doPrint}
                className="btn-primary flex h-13 items-center justify-center gap-2 font-black"
              >
                <Printer size={18} /> طباعة M110
              </button>
              <button onClick={onClose} className="btn-ghost h-13 font-bold text-gray-600">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════
   زر طباعة ملصق المنتج (في المخزون / نموذج المنتج)
══════════════════════════════════════════ */
export function PrintM110LabelBtn({ product, variant = "icon" }) {
  const [open, setOpen] = useState(false);

  if (!product?.name) return null;

  if (variant === "icon") {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          title="طباعة ملصق M110"
          className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
        >
          🏷️
        </button>
        {open && <M110PreviewModal product={product} onClose={() => setOpen(false)} />}
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-ghost flex h-12 items-center gap-2 px-4 font-bold text-blue-700"
      >
        <Printer size={16} /> طباعة ملصق M110
      </button>
      {open && <M110PreviewModal product={product} onClose={() => setOpen(false)} />}
    </>
  );
}

/* ══════════════════════════════════════════
   زر طباعة ملصق الوزن (بعد بيع منتج وزني)
══════════════════════════════════════════ */
export function PrintWeightSaleLabelBtn({ product, grams, totalPrice }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100"
        title="طباعة ملصق الوزن"
      >
        🏷️ ملصق وزن
      </button>
      {open && (
        <M110PreviewModal
          product={product}
          weightData={{ grams, totalPrice }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/* ══════════════════════════════════════════
   زر طباعة إيصال M110 (في صفحة الفاتورة)
══════════════════════════════════════════ */
export function PrintM110ReceiptBtn({ invoice }) {
  const settings = useM110Settings();
  const [preview, setPreview] = useState(false);
  const printAreaId = "m110-receipt-print-area";

  function doPrint() {
    printArea(printAreaId, 57, null);
  }

  return (
    <>
      {/* منطقة الطباعة */}
      <div id={printAreaId} style={{ position: "fixed", left: "-9999px", top: 0 }}>
        <M110ReceiptContent invoice={invoice} settings={settings} />
      </div>

      <button
        onClick={() => setPreview(true)}
        className="btn-primary flex h-14 items-center gap-2 px-5 font-black"
      >
        <Printer size={18} /> طباعة إيصال M110
      </button>

      {/* مودال معاينة الإيصال */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPreview(false)}
        >
          <div
            className="card w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b bg-gray-50 p-4">
              <h2 className="text-lg font-black">🖨️ معاينة إيصال M110</h2>
              <button onClick={() => setPreview(false)} className="grid h-9 w-9 place-items-center rounded-xl bg-gray-100">
                <X size={16} />
              </button>
            </div>
            <div className="p-5">
              <div className="mb-4 flex items-start justify-center rounded-2xl border-2 border-dashed bg-gray-50 p-4">
                <div style={{ transform: "scale(2)", transformOrigin: "top center", marginBottom: "60%" }}>
                  <M110ReceiptContent invoice={invoice} settings={settings} />
                </div>
              </div>
              <p className="mb-4 text-center text-xs text-gray-500">عرض الورق: 57مم — رول حراري M110</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={doPrint} className="btn-primary flex h-13 items-center justify-center gap-2 font-black">
                  <Printer size={18} /> طباعة
                </button>
                <button onClick={() => setPreview(false)} className="btn-ghost h-13 font-bold">إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════════
   صفحة إعدادات طابعة Phomemo M110
══════════════════════════════════════════ */
export function M110SettingsPage() {
  const [form, setForm] = useState({ ...DEFAULT_M110 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const unsub = subscribeM110Settings((s) => {
      setForm(s);
      setLoading(false);
    });
    return unsub;
  }, []);

  async function save() {
    setSaving(true);
    try {
      await saveM110Settings(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert("تعذر الحفظ: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  function toggle(key) {
    setForm((f) => ({ ...f, [key]: !f[key] }));
  }

  if (loading) return <div className="p-8 text-center text-gray-500">جاري التحميل...</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4">

      {/* ─── نبذة الطابعة ─── */}
      <div className="card flex items-center gap-4 p-5">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-black text-3xl text-white">🖨️</div>
        <div>
          <h2 className="text-xl font-black">Phomemo M110</h2>
          <p className="text-sm text-gray-500">طابعة حرارية للملصقات — عرض ورق 57مم</p>
          <p className="text-xs text-gray-400">مُعتمدة حصريًا لهذا التطبيق</p>
        </div>
      </div>

      {/* ─── نوع الورق ─── */}
      <div className="card p-5">
        <h3 className="mb-4 text-lg font-black">📐 نوع الورق الافتراضي</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {Object.entries(LABEL_SIZES).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setForm((f) => ({ ...f, defaultLabelSize: k }))}
              className={`rounded-2xl border-2 p-3 text-center text-sm font-bold transition ${
                form.defaultLabelSize === k
                  ? "border-[#0d6a42] bg-green-50 text-[#0d6a42]"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              {v.label}
              {k === "40x30" && <span className="mt-1 block text-xs font-normal text-gray-400">افتراضي</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ─── محتوى الملصق ─── */}
      <div className="card p-5">
        <h3 className="mb-4 text-lg font-black">🏷️ محتوى الملصق</h3>
        <div className="space-y-3">
          {[
            ["showProductName",  "اسم المنتج"],
            ["showPrice",        "السعر"],
            ["showBarcode",      "الباركود"],
            ["showInternalCode", "الكود الداخلي (ID)"],
            ["showExpiryDate",   "تاريخ الانتهاء"],
            ["showUnit",         "الوحدة / الوزن"],
            ["showStoreName",    "اسم المتجر"],
          ].map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center gap-3 rounded-xl border bg-gray-50 px-4 py-3 hover:bg-gray-100">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[#0d6a42]"
                checked={!!form[key]}
                onChange={() => toggle(key)}
              />
              <span className="font-bold">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ─── المنتجات الوزنية ─── */}
      <div className="card p-5">
        <h3 className="mb-4 text-lg font-black">⚖️ عرض سعر المنتجات الوزنية</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            ["perKg",   "سعر الكيلوغرام", "1كغ = 450 دج"],
            ["per100g", "سعر 100 غرام",   "100غ = 45 دج"],
          ].map(([v, label, eg]) => (
            <button
              key={v}
              onClick={() => setForm((f) => ({ ...f, weightPriceMode: v }))}
              className={`rounded-2xl border-2 p-4 text-right transition ${
                form.weightPriceMode === v
                  ? "border-[#0d6a42] bg-green-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <b className={form.weightPriceMode === v ? "text-[#0d6a42]" : ""}>{label}</b>
              <p className="mt-1 text-xs text-gray-500">مثال: {eg}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ─── عدد النسخ الافتراضي ─── */}
      <div className="card p-5">
        <h3 className="mb-4 text-lg font-black">📋 عدد النسخ الافتراضي</h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setForm((f) => ({ ...f, defaultCopies: Math.max(1, (f.defaultCopies || 1) - 1) }))}
            className="grid h-11 w-11 place-items-center rounded-xl border text-xl font-bold hover:bg-gray-50"
          >
            −
          </button>
          <span className="w-12 text-center text-2xl font-black">{form.defaultCopies || 1}</span>
          <button
            onClick={() => setForm((f) => ({ ...f, defaultCopies: Math.min(20, (f.defaultCopies || 1) + 1) }))}
            className="grid h-11 w-11 place-items-center rounded-xl border text-xl font-bold hover:bg-gray-50"
          >
            +
          </button>
          <span className="text-sm text-gray-500">نسخة</span>
        </div>
      </div>

      {/* ─── إعدادات الإيصال ─── */}
      <div className="card p-5">
        <h3 className="mb-4 text-lg font-black">🧾 إعدادات الإيصال المصغر</h3>
        <label className="mb-3 flex cursor-pointer items-center gap-3 rounded-xl border bg-gray-50 px-4 py-3">
          <input
            type="checkbox"
            className="h-5 w-5 accent-[#0d6a42]"
            checked={!!form.receiptEnabled}
            onChange={() => toggle("receiptEnabled")}
          />
          <span className="font-bold">تفعيل إيصال البيع عبر M110</span>
        </label>
        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-bold">رأس الإيصال (اسم المتجر)</span>
          <input
            className="input"
            value={form.receiptHeader || ""}
            onChange={(e) => setForm((f) => ({ ...f, receiptHeader: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">تذييل الإيصال</span>
          <input
            className="input"
            value={form.receiptFooter || ""}
            onChange={(e) => setForm((f) => ({ ...f, receiptFooter: e.target.value }))}
          />
        </label>
      </div>

      {/* ─── معلومات الطابعة ─── */}
      <div className="card p-5">
        <h3 className="mb-3 text-lg font-black">ℹ️ معلومات طابعة M110</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p>• <b>اتصال:</b> بلوتوث 5.0</p>
          <p>• <b>عرض الطباعة:</b> 48مم (ورق 57مم)</p>
          <p>• <b>دقة الطباعة:</b> 203 DPI</p>
          <p>• <b>أنواع الورق:</b> ملصقات حرارية 30–50مم، رول حراري 57مم</p>
          <p>• <b>الاتصال بالمتصفح:</b> اختر "Phomemo M110" عند فتح نافذة الطباعة</p>
        </div>
        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          <b>كيفية الاستخدام:</b> اربط الطابعة عبر البلوتوث → عند الضغط على "طباعة M110" اختر الطابعة من قائمة المتصفح ← سيتم ضبط حجم الورق تلقائيًا.
        </div>
      </div>

      {/* ─── حفظ ─── */}
      <button
        onClick={save}
        disabled={saving}
        className="btn-primary h-14 w-full text-lg font-black"
      >
        {saving ? "جاري الحفظ..." : saved ? "✓ تم الحفظ" : "💾 حفظ الإعدادات"}
      </button>
    </div>
  );
}

/* ── تصدير fmtDate لاستخدامها خارجًا إن احتجنا ── */
export { fmtDate };
