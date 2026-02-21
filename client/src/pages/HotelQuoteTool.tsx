import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, FileImage, Globe2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const PROMPTS = {
  en: {
    title: "Hotel Quote Extractor",
    subtitle:
      "Generate a strict, client-ready prompt for extracting hotel quotes from screenshots.",
    uploadLabel: "Screenshot (optional)",
    uploadHint: "Attach a screenshot to pass into the model.",
    systemPromptLabel: "System prompt",
    exampleLabel: "Example output",
    copyLabel: "Copy",
    copySuccess: "Copied to clipboard.",
    copyFail: "Copy failed. Please try again.",
    systemPrompt: `Role: You are an assistant for a B2B tour operator operations team.
Goal: Extract hotel quote details from a screenshot and produce a clean client-ready quote.

Rules (VERY IMPORTANT):
1. NEVER mention supplier / provider / website / platform name (examples: Expedia, Booking, Agoda, Hotelbeds, WebBeds, etc.).
   * If the image contains supplier names or logos, ignore them completely.
2. Only extract what is needed for a quote:
   * Hotel name
   * Address (if shown)
   * City/Country (if shown)
   * Check-in date + time (if shown)
   * Check-out date + time (if shown)
   * Nights (if shown)
   * Room type / meal plan (e.g., “Bed & Breakfast”)
   * Total price and currency
   * Payment breakdown (pay today / due at property) if shown
   * Cancellation / refund policy (e.g., Non-refundable / Free cancellation until X)
3. If a field is not visible, write “Not shown” (do not guess).
4. Normalize dates to this format: DDMon (example: 05Feb).
   * If year is shown, you may keep it in parentheses: 05Feb (2026).
5. Output must be client-ready and clean.

Output format (exactly like this):
Hotel name: …
Address: …
Check in: …
Check out: …
Room type: … (include meal plan if shown)
Price: … (currency)
Payment: … (Pay today / Due at property)  ← only if shown
Policy: … (Non Ref / Free cancellation until … / Not shown)`,
    example: `Hotel name: Montcalm Mayfair, Autograph Collection
Address: 2, Wallenberg Place, London, England W1H 7TN
Check in: 08Feb (2026) 2:00pm
Check out: 13Feb (2026) 12:00pm
Room type: Atelier, Guest room, 1 King (Not shown meal plan)
Price: 2702.89 USD
Payment: Pay today 2574.18 USD / Due at property 128.71 USD (GBP 94.56)
Policy: Not shown`,
  },
  ar: {
    title: "أداة استخراج عرض الفندق",
    subtitle:
      "أنشئ مطالبة دقيقة وجاهزة للعميل لاستخراج عروض الفنادق من لقطات الشاشة.",
    uploadLabel: "لقطة شاشة (اختياري)",
    uploadHint: "أرفق لقطة الشاشة لتمريرها إلى النموذج.",
    systemPromptLabel: "تعليمات النظام",
    exampleLabel: "مثال على الإخراج",
    copyLabel: "نسخ",
    copySuccess: "تم النسخ إلى الحافظة.",
    copyFail: "تعذر النسخ. حاول مرة أخرى.",
    systemPrompt: `الدور: أنت مساعد لفريق عمليات منظّم رحلات للشركات (B2B).
الهدف: استخرج تفاصيل عرض الفندق من لقطة شاشة وقدّم عرضًا نظيفًا وجاهزًا للعميل.

القواعد (مهم جدًا):
1. لا تذكر أبدًا اسم المورّد/المزوّد/الموقع/المنصة (مثل: Expedia, Booking, Agoda, Hotelbeds, WebBeds, إلخ).
   * إذا كانت الصورة تحتوي على أسماء أو شعارات للمورّدين، تجاهلها تمامًا.
2. استخرج فقط ما يلزم للعرض:
   * اسم الفندق
   * العنوان (إن وُجد)
   * المدينة/الدولة (إن وُجدت)
   * تاريخ ووقت تسجيل الوصول (إن وُجد)
   * تاريخ ووقت تسجيل المغادرة (إن وُجد)
   * عدد الليالي (إن وُجد)
   * نوع الغرفة / خطة الوجبات (مثل: مبيت وإفطار)
   * السعر الإجمالي والعملة
   * تفصيل الدفع (ادفع اليوم / مستحق في الفندق) إن وُجد
   * سياسة الإلغاء/الاسترداد (مثل: غير قابل للاسترداد / إلغاء مجاني حتى X)
3. إذا لم يكن الحقل ظاهرًا، اكتب "غير مذكور" (لا تفترض).
4. نسّق التواريخ بهذا الشكل: DDMon (مثال: 05Feb).
   * إذا ظهرت السنة، يمكنك إضافتها بين قوسين: 05Feb (2026).
5. يجب أن يكون الإخراج جاهزًا للعميل ونظيفًا.

تنسيق الإخراج (بنفس هذا الشكل):
اسم الفندق: …
العنوان: …
تسجيل الوصول: …
تسجيل المغادرة: …
نوع الغرفة: … (اذكر خطة الوجبات إن وُجدت)
السعر: … (العملة)
الدفع: … (ادفع اليوم / مستحق في الفندق)  ← فقط إذا ظهر
السياسة: … (غير قابل للاسترداد / إلغاء مجاني حتى … / غير مذكور)`,
    example: `اسم الفندق: Montcalm Mayfair, Autograph Collection
العنوان: 2, Wallenberg Place, London, England W1H 7TN
تسجيل الوصول: 08Feb (2026) 2:00pm
تسجيل المغادرة: 13Feb (2026) 12:00pm
نوع الغرفة: Atelier, Guest room, 1 King (غير مذكور لخطة الوجبات)
السعر: 2702.89 USD
الدفع: ادفع اليوم 2574.18 USD / مستحق في الفندق 128.71 USD (GBP 94.56)
السياسة: غير مذكور`,
  },
} as const;

export default function HotelQuoteTool() {
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const promptSet = PROMPTS[language];
  const systemPrompt = useMemo(() => promptSet.systemPrompt, [promptSet]);
  const exampleOutput = useMemo(() => promptSet.example, [promptSet]);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(promptSet.copySuccess);
    } catch (error) {
      toast.error(promptSet.copyFail);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F3FF]">
      <header className="bg-[#0C1026] relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute -top-20 -left-24 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 py-12">
          <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 text-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide border border-white/10">
                  <Globe2 className="w-3.5 h-3.5" />
                  B2B Tour Ops
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-4">
                  {promptSet.title}
                </h1>
                <p className="text-slate-300 mt-2 max-w-2xl">
                  {promptSet.subtitle}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-full bg-white/10 p-1 border border-white/10">
                  <button
                    onClick={() => setLanguage("en")}
                    className={cn(
                      "px-3 py-1.5 text-sm font-semibold rounded-full transition-colors",
                      language === "en"
                        ? "bg-white text-[#0F172A]"
                        : "text-slate-300 hover:text-white"
                    )}
                  >
                    English
                  </button>
                  <button
                    onClick={() => setLanguage("ar")}
                    className={cn(
                      "px-3 py-1.5 text-sm font-semibold rounded-full transition-colors",
                      language === "ar"
                        ? "bg-white text-[#0F172A]"
                        : "text-slate-300 hover:text-white"
                    )}
                  >
                    العربية
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Sparkles className="w-3.5 h-3.5" />
              {language === "en"
                ? "Copy-ready prompts for your workflow"
                : "مطالبات جاهزة للنسخ ضمن سير العمل"}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="space-y-6">
            <Card className="border-none shadow-xl shadow-indigo-100/60">
              <CardHeader>
                <CardTitle>{promptSet.uploadLabel}</CardTitle>
                <CardDescription>{promptSet.uploadHint}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                      className="cursor-pointer"
                    />
                    {file && (
                      <Button
                        variant="outline"
                        onClick={() => setFile(null)}
                        className="shrink-0"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Screenshot preview"
                        className="max-h-64 w-full rounded-xl object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 py-10">
                        <FileImage className="w-10 h-10 mb-3" />
                        <p className="text-sm">No screenshot attached.</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl shadow-indigo-100/60">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <CardTitle>{promptSet.exampleLabel}</CardTitle>
                    <CardDescription>
                      {language === "en"
                        ? "Share this example with your team for formatting reference."
                        : "شارك هذا المثال مع فريقك كمرجع للتنسيق."}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleCopy(exampleOutput)}
                    className="gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    {promptSet.copyLabel}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre
                  dir={language === "ar" ? "rtl" : "ltr"}
                  className="rounded-2xl bg-[#111827] text-slate-100 text-sm leading-6 p-5 whitespace-pre-wrap font-mono"
                >
                  {exampleOutput}
                </pre>
              </CardContent>
            </Card>
            <Card className="border-none shadow-xl shadow-indigo-100/60">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <CardTitle>{promptSet.systemPromptLabel}</CardTitle>
                    <CardDescription>
                      {language === "en"
                        ? "Paste this into the system role before sending the screenshot."
                        : "الصق هذا في رسالة النظام قبل إرسال لقطة الشاشة."}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleCopy(systemPrompt)}
                    className="gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    {promptSet.copyLabel}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre
                  dir={language === "ar" ? "rtl" : "ltr"}
                  className="rounded-2xl bg-[#111827] text-slate-100 text-sm leading-6 p-5 whitespace-pre-wrap font-mono"
                >
                  {systemPrompt}
                </pre>
              </CardContent>
            </Card>
        </div>
      </main>
    </div>
  );
}
