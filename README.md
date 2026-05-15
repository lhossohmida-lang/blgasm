# متجر المواد الغذائية

تطبيق ويب عربي RTL لإدارة محل بيع مواد غذائية، مبني بـ React + Vite + Tailwind CSS ومربوط بـ Firebase Authentication وFirestore وStorage.

## الميزات

- تسجيل دخول بالبريد وكلمة المرور عبر Firebase Authentication.
- حماية لوحة الإدارة ومنع الوصول بدون تسجيل دخول.
- Dashboard بإحصائيات المخزون، المبيعات، الديون، المنتجات قليلة المخزون، النشاط الأخير، ورسوم بيانية.
- إدارة المخزون: بحث، فلاتر فئات، إضافة/تعديل/حذف منتجات، رفع صور، وتنبيهات نقص المخزون.
- إدخال المنتجات للمخزون عبر QR بالكاميرا أو ماسح QR/Barcode يدوي.
- نقطة بيع POS: سلة مشتريات، خصم، دفع نقدي أو كريديت، ربط الفاتورة بالزبون، وإنقاص الكميات تلقائيًا.
- إخراج المنتجات للبيع عبر QR بالكاميرا أو ماسح QR/Barcode.
- فاتورة بيع قابلة للطباعة والمشاركة.
- زبائن الكريديت: إضافة وتعديل وحذف، عرض الحساب، تسجيل دفعات، وسجل معاملات لكل زبون.
- تقارير: المبيعات، الأرباح، الديون، أكثر المنتجات مبيعًا، وتوزيع الفئات.
- بيانات تجريبية أولية تضاف تلقائيًا عند أول تسجيل دخول إذا كانت قاعدة البيانات فارغة.
- الأرقام بصيغة لاتينية والعملة الافتراضية هي الدينار الجزائري `دج`.
- مساعد ذكي (`/assistant`) عبر OpenRouter يقرأ ويعدّل بيانات المتجر، مع تأكيد لكل عملية كتابة. المفتاح السرّي محفوظ على Vercel، لا في المتصفح.

## التشغيل المحلي

```bash
npm install
npm run dev
```

ثم افتح:

```text
http://localhost:5173
```

## إعداد Firebase

الإعدادات مضافة داخل:

```text
src/lib/firebase.js
```

قبل الاستخدام الحقيقي:

1. افتح Firebase Console للمشروع `blgasm`.
2. فعّل Authentication > Sign-in method > Email/Password.
3. أنشئ مستخدمًا للمالك أو الموظف.
4. انشر قواعد Firestore من ملف `firestore.rules`.
5. فعّل Firebase Storage إذا رغبت برفع صور المنتجات.
6. انشر قواعد Storage من ملف `storage.rules`.

## قواعد Firestore

الملف:

```text
firestore.rules
```

القواعد الحالية تمنع القراءة والكتابة إلا للمستخدمين المسجلين دخولًا.

## البناء للإنتاج

```bash
npm run build
```

يمكن معاينة نسخة الإنتاج عبر:

```bash
npm run preview
```

## بنية البيانات

المجموعات المستخدمة:

- `products`
- `sales`
- `customers`
- `customers/{customerId}/transactions`
- `payments`
- `activityLogs`

كل عمليات البيع والدفعات تستخدم معاملات Firestore للحفاظ على اتساق الكميات والديون.

## النشر على Vercel + المساعد الذكي

التطبيق يستخدم Vercel Serverless Function (`api/chat.js`) كوسيط بين الواجهة وOpenRouter. هذا يبقي مفتاح API السرّي على الخادم بدلاً من إظهاره في حزمة الـ JavaScript.

### 1. النشر الأول

```bash
npm install -g vercel
vercel login
vercel        # نشر تجريبي (preview)
vercel --prod # نشر إنتاجي
```

أو من خلال GitHub: ارفع المشروع إلى GitHub ثم اربطه من [vercel.com/new](https://vercel.com/new).

### 2. ضبط متغير البيئة

أنشئ مفتاحاً على [openrouter.ai/keys](https://openrouter.ai/keys)، ثم على Vercel:

**Dashboard → Project → Settings → Environment Variables → Add**

| Name | Value |
|---|---|
| `OPENROUTER_API_KEY` | `sk-or-v1-...` |
| `ALLOWED_ORIGINS` *(اختياري)* | `https://your-app.vercel.app` |

بعد إضافة المتغير، أعد النشر (`vercel --prod`) ليلتقطها.

### 3. التطوير المحلي

طريقتان للعمل محلياً مع الـ API:

**أ) `vercel dev`** — يشغّل Vite + serverless functions معاً على المنفذ نفسه:

```bash
vercel dev
```

**ب) `npm run dev` + Vercel البعيد** — استخدم نشر Vercel كباك-إند:

في صفحة المساعد → ⚙️ → "عنوان الـ API"، الصق:
```
https://your-app.vercel.app
```

### 4. تغيير النموذج

من صفحة المساعد اضغط ⚙️ وغيّر "اسم النموذج". معرّفات النماذج المتاحة:

| النموذج | يدعم الأدوات؟ | الحجم |
|---|---|---|
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | ❌ قراءة فقط | 30B |
| `nvidia/nemotron-3-super-120b-a12b:free` | ❌ قراءة فقط | 120B |
| `meta-llama/llama-3.3-70b-instruct:free` | ✅ كامل | 70B |
| `qwen/qwen-2.5-72b-instruct:free` | ✅ كامل | 72B |
| `google/gemini-2.0-flash-exp:free` | ✅ كامل | — |

النماذج التي لا تدعم استدعاء الأدوات تعمل تلقائياً في وضع القراءة فقط مع لقطة من بيانات المتجر.
