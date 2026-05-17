/**
 * Firebase Cloud Functions — blgasm
 *
 * searchProductImage:
 *   تستقبل اسم منتج وتعيد URL صورة مناسبة له.
 *   تستخدم Unsplash API (يتطلب مفتاح مجاني من unsplash.com/developers)
 *   أو تتراجع إلى صورة placeholder محلية بناءً على الفئة.
 *
 * إعداد المفاتيح (Firebase Secrets):
 *   firebase functions:secrets:set UNSPLASH_ACCESS_KEY
 *   ثم أدخل مفتاح Unsplash عند الطلب.
 *
 * النشر:
 *   firebase deploy --only functions
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const https = require("https");

// ─── Secret: مفتاح Unsplash (اختياري) ───
const UNSPLASH_KEY = defineSecret("UNSPLASH_ACCESS_KEY");

// ─── خريطة الكلمات المفتاحية → URL Unsplash ───
const KEYWORD_MAP = {
  milk: "milk", حليب: "milk", لبن: "milk",
  cheese: "cheese", جبن: "cheese",
  butter: "butter", زبدة: "butter",
  bread: "bread", خبز: "bread",
  oil: "olive oil", زيت: "olive oil",
  sugar: "sugar", سكر: "sugar",
  flour: "flour", دقيق: "flour",
  rice: "rice", أرز: "rice", رز: "rice",
  pasta: "pasta", معكرونة: "pasta", مكرونة: "pasta",
  tomato: "tomatoes", طماطم: "tomatoes",
  juice: "juice", عصير: "juice",
  coffee: "coffee", قهوة: "coffee",
  tea: "tea", شاي: "tea",
  water: "water", ماء: "water", مياه: "water",
  eggs: "eggs", بيض: "eggs",
  chicken: "chicken", دجاج: "chicken",
  meat: "meat", لحم: "meat",
  fish: "fish", سمك: "fish",
  fruit: "fruit", فاكهة: "fruit",
  apple: "apple", تفاح: "apple",
  banana: "banana", موز: "banana",
  orange: "orange", برتقال: "orange",
  potato: "potato", بطاطس: "potato",
  onion: "onion", بصل: "onion",
  garlic: "garlic", ثوم: "garlic",
  chocolate: "chocolate", شوكولاطة: "chocolate", شوكولا: "chocolate",
  biscuit: "biscuit", بسكويت: "cookies",
  soap: "soap", صابون: "soap",
  detergent: "cleaning products", منظف: "cleaning products", مسحوق: "laundry detergent",
};

// ─── أفضل كلمة بحث بناءً على اسم المنتج ───
function getSearchQuery(productName) {
  const name = String(productName || "").trim().toLowerCase();
  for (const [keyword, query] of Object.entries(KEYWORD_MAP)) {
    if (name.includes(keyword)) return `${query} food grocery`;
  }
  // استخدام الاسم مباشرة إن لم يتطابق
  return `${productName} food grocery`;
}

// ─── طلب HTTP بسيط (Promise) ───
function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = new URL(url);
    const req = https.request(
      { hostname: options.hostname, path: options.pathname + options.search, headers },
      (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          try { resolve(JSON.parse(data)); } catch { reject(new Error("JSON parse error")); }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

// ─── Cloud Function: searchProductImage ───
exports.searchProductImage = onCall(
  { secrets: [UNSPLASH_KEY], region: "us-central1" },
  async (request) => {
    const { productName } = request.data || {};
    if (!productName) throw new HttpsError("invalid-argument", "productName مطلوب");

    const query = getSearchQuery(productName);
    const key = UNSPLASH_KEY.value();

    // ── محاولة Unsplash API ──
    if (key) {
      try {
        const encodedQuery = encodeURIComponent(query);
        const url = `https://api.unsplash.com/search/photos?query=${encodedQuery}&per_page=1&orientation=squarish`;
        const data = await fetchJson(url, { Authorization: `Client-ID ${key}` });

        if (data?.results?.[0]?.urls?.regular) {
          const photo = data.results[0];
          return {
            imageUrl: photo.urls.regular,
            thumbnailUrl: photo.urls.thumb,
            source: "unsplash",
            title: photo.alt_description || productName,
          };
        }
      } catch (err) {
        console.warn("Unsplash API error:", err.message);
      }
    }

    // ── Fallback: Unsplash Source (لا يتطلب مفتاح) ──
    try {
      const encodedQuery = encodeURIComponent(query);
      const fallbackUrl = `https://source.unsplash.com/400x400/?${encodedQuery}`;
      return {
        imageUrl: fallbackUrl,
        thumbnailUrl: fallbackUrl,
        source: "unsplash-source",
        title: productName,
      };
    } catch {
      // إذا فشل كل شيء أعد null — سيتم استخدام الصور المحلية في الواجهة
      return { imageUrl: null, source: "fallback" };
    }
  }
);
