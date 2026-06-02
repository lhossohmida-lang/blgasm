"use client";

import jsQR from "jsqr";

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("تعذر فتح الصورة."));
    };
    image.src = url;
  });
}

export async function decodeQrImageViaCloud(file: File) {
  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("تعذر تجهيز الصورة للقراءة.");
  }

  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const qr = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: "attemptBoth",
  });

  if (!qr?.data) {
    throw new Error("لم يتم العثور على QR داخل الصورة.");
  }

  return qr.data;
}

type NavigatorWithDevices = Navigator & {
  hid?: {
    requestDevice: (options: { filters: Array<Record<string, unknown>> }) => Promise<unknown[]>;
  };
  usb?: {
    requestDevice: (options: { filters: Array<Record<string, unknown>> }) => Promise<unknown>;
  };
};

export async function tryHardwareScannerDiscovery() {
  const nav = navigator as NavigatorWithDevices;

  if (nav.hid) {
    const devices = await nav.hid.requestDevice({ filters: [] }).catch(() => []);
    return devices.length > 0 ? "تم اكتشاف جهاز عبر WebHID." : "لم يتم اكتشاف جهاز عبر WebHID.";
  }

  if (nav.usb) {
    const device = await nav.usb.requestDevice({ filters: [] }).catch(() => null);
    return device ? "تم اكتشاف جهاز عبر WebUSB." : "لم يتم اكتشاف جهاز عبر WebUSB.";
  }

  return "المتصفح لا يدعم WebUSB أو WebHID، سيتم استعمال Keyboard Scanner Input.";
}
