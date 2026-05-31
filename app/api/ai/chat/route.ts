import { OpenRouter } from "@openrouter/sdk";

export const runtime = "nodejs";

const MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response("OPENROUTER_API_KEY غير مضبوط في الخادم.", { status: 503 });
  }

  const { message, context } = (await request.json()) as {
    message?: string;
    context?: unknown;
  };

  if (!message?.trim()) {
    return new Response("السؤال فارغ.", { status: 400 });
  }

  const openrouter = new OpenRouter({
    apiKey,
    httpReferer: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    appTitle: "Blgasm Grocery POS",
  });

  const stream = await openrouter.chat.send({
    chatRequest: {
      model: MODEL,
      stream: true,
      messages: [
        {
          role: "system",
          content:
            "أنت مساعد تجاري داخل تطبيق محل مواد غذائية جزائري. أجب بالعربية باختصار وركّز على الأرقام والاقتراحات العملية. لا تطلب بيانات غير موجودة، واستعمل فقط ملخص البيانات المرسل.",
        },
        {
          role: "user",
          content: `ملخص بيانات المتجر الضرورية فقط:\n${JSON.stringify(context, null, 2)}\n\nسؤال التاجر: ${message}`,
        },
      ],
    },
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            controller.enqueue(encoder.encode(content));
          }
        }
      } catch (error) {
        controller.enqueue(
          encoder.encode(error instanceof Error ? `\nحدث خطأ: ${error.message}` : "\nحدث خطأ أثناء الاتصال."),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
