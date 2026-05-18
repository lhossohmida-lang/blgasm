/**
 * api/image-search.js — Vercel Serverless Function
 * بديل آمن لـ Firebase Cloud Function (لا يتطلب Blaze plan).
 * يستقبل اسم منتج ويعيد URL صورة من Unsplash API.
 *
 * المتغيرات البيئية المطلوبة على Vercel:
 *   UNSPLASH_ACCESS_KEY — مفتاح Unsplash (مجاني من unsplash.com/developers)
 */

const UNSPLASH_API = "https://api.unsplash.com/search/photos";

const KEYWORD_MAP = {
  حليب: "milk dairy", لبن: "milk dairy", جبن: "cheese dairy",
  زبدة: "butter dairy", خبز: "bread bakery", زيت: "olive oil",
  سكر: "sugar", دقيق: "flour", أرز: "rice", رز: "rice",
  معكرونة: "pasta", مكرونة: "pasta", طماطم: "tomatoes",
  عصير: "juice drink", قهوة: "coffee", شاي: "tea",
  ماء: "water bottle", مياه: "water bottle", بيض: "eggs",
  دجاج: "chicken meat", لحم: "meat beef", سمك: "fish seafood",
  فاكهة: "fresh fruit", تفاح: "apple fruit", موز: "banana fruit",
  برتقال: "orange fruit", بطاطس: "potato vegetable",
  بصل: "onion vegetable", ثوم: "garlic", شوكولاطة: "chocolate",
  شوكولا: "chocolate", بسكويت: "cookies biscuit",
  حلوى: "candy sweets", صابون: "soap", منظف: "cleaning detergent",
  مسحوق: "laundry powder", ذرة: "corn cereal",
  توابل: "spices herbs", بهارات: "spices herbs",
};

function getQuery(productName) {
  const name = String(productName || "").trim();
  for (const [kw, q] of Object.entries(KEYWORD_MAP)) {
    if (name.includes(kw)) return `${q} food`;
  }
  return `${name} food grocery`;
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { productName } = req.body || {};
  if (!productName) return res.status(400).json({ error: "productName مطلوب" });

  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    // لا يوجد مفتاح — أعد null ليستخدم الواجهة الصور المحلية
    return res.status(200).json({ imageUrl: null, source: "no-key" });
  }

  try {
    const query = encodeURIComponent(getQuery(productName));
    const url = `${UNSPLASH_API}?query=${query}&per_page=1&orientation=squarish&content_filter=high`;
    const response = await fetch(url, {
      headers: { Authorization: `Client-ID ${key}` },
    });

    if (!response.ok) throw new Error(`Unsplash error: ${response.status}`);

    const data = await response.json();
    const photo = data?.results?.[0];

    if (!photo) return res.status(200).json({ imageUrl: null, source: "no-results" });

    return res.status(200).json({
      imageUrl: photo.urls?.regular || photo.urls?.small,
      thumbnailUrl: photo.urls?.thumb,
      source: "unsplash",
      title: photo.alt_description || productName,
    });
  } catch (err) {
    console.error("image-search error:", err.message);
    return res.status(200).json({ imageUrl: null, source: "error", error: err.message });
  }
}
