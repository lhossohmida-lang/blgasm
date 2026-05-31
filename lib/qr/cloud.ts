"use client";

export async function decodeQrImageViaCloud(file: File) {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch("/api/qr/decode", {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json()) as { code?: string; error?: string };
  if (!response.ok || !payload.code) {
    throw new Error(payload.error ?? "تعذر استخراج QR من الصورة.");
  }

  return payload.code;
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
