# Nimbus Core V35.2 — Free-Plan Safe Unified Pipeline

نسخة موحدة ونظيفة لمشروع Nimbus Core، مصممة للعمل على Cloudflare Pages + D1 + Queues + Worker Consumer + Cron.

## المزايا الأساسية
- 300 مصدر داخل الكتالوج.
- 80 مصدرًا مفعّلًا افتراضيًا و220 متوقفًا.
- Queue Producer في Pages وQueue Worker.
- Queue Consumer مستقل مع Batch Size = 1 وConcurrency = 1.
- Cron كل خمس دقائق للاستعادة.
- Pause / Resume / Cancel.
- منع تشغيل أكثر من Run في الوقت نفسه.
- استعادة المهام العالقة.
- Crawl محدود لصفحات النتائج.
- Folder-only extraction ورفض File وFolder دون Key.
- Archive وCSV/JSON Export وExtract وSources وTools.
- Pagination لجميع المصادر الـ300.
- Metrics دقيقة مع 403/429/5xx وCaptcha detection وCooldown.
- حماية اختيارية للمسارات الإدارية باستخدام ADMIN_TOKEN.

## النشر
Pages ينشر من GitHub. Worker المستهلك يستخدم:

```bash
npx wrangler deploy --config wrangler.queue.jsonc
```

بعد النشر اضغط Repair DB مرة واحدة لإنشاء جداول `nimbus_v352_*` وزرع المصادر.

## ADMIN_TOKEN اختياري
للحماية، أضف Secret باسم `ADMIN_TOKEN` في مشروع Pages، ثم اكتب القيمة نفسها داخل Tools في التطبيق. إذا لم تضفه، سيعمل المشروع دون Token للحفاظ على التوافق.

## الاختبارات

```bash
npm run verify
npx wrangler deploy --config wrangler.queue.jsonc --dry-run
```
