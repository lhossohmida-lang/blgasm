import { NextResponse } from "next/server";
import jpeg from "jpeg-js";
import jsQR from "jsqr";
import { PNG } from "pngjs";

export const runtime = "nodejs";

function decodeImage(buffer: Buffer, mime: string) {
  if (mime.includes("png")) {
    const png = PNG.sync.read(buffer);
    return {
      data: new Uint8ClampedArray(png.data),
      width: png.width,
      height: png.height,
    };
  }

  if (mime.includes("jpeg") || mime.includes("jpg")) {
    const image = jpeg.decode(buffer, { useTArray: true });
    return {
      data: new Uint8ClampedArray(image.data),
      width: image.width,
      height: image.height,
    };
  }

  throw new Error("يدعم استخراج QR حالياً صور PNG و JPG.");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "لم يتم رفع صورة." }, { status: 400 });
    }

    const arrayBuffer = await image.arrayBuffer();
    const decoded = decodeImage(Buffer.from(arrayBuffer), image.type || "image/png");
    const qr = jsQR(decoded.data, decoded.width, decoded.height, {
      inversionAttempts: "attemptBoth",
    });

    if (!qr?.data) {
      return NextResponse.json({ error: "لم يتم العثور على QR داخل الصورة." }, { status: 422 });
    }

    return NextResponse.json({ code: qr.data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذر معالجة الصورة." },
      { status: 500 },
    );
  }
}
