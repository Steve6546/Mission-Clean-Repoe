# Discord Welcome Dashboard

لوحة تحكم عربية لإدارة بوت ترحيب Discord، إعداد بطاقات الترحيب، الرتب التلقائية، تتبع الدعوات، وسجل الانضمامات بواجهة RTL مستوحاة من الأسود والأبيض والأحمر.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — تشغيل خادم Discord والـ API
- `pnpm --filter @workspace/discord-welcome-dashboard run dev` — تشغيل لوحة التحكم
- `pnpm run typecheck` — فحص الحزم (قد يتأثر بمكوّنات Canvas القديمة غير المرتبطة بالتطبيق)
- `pnpm --filter @workspace/api-spec run codegen` — إعادة توليد hooks وZod بعد تعديل OpenAPI
- `pnpm --filter @workspace/db run push` — تطبيق تغييرات مخطط قاعدة البيانات في التطوير
- الأسرار المطلوبة لتفعيل Discord الحقيقي: `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`
- إعداد OAuth غير السري: `DISCORD_REDIRECT_URI` ويجب أن يطابق الرابط المسجل في Discord Developer Portal
- `DATABASE_URL` و`SESSION_SECRET` تتم إدارتهما من بيئة Replit

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + TanStack Query + Wouter
- API: Express 5 + Discord.js
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/discord-welcome-dashboard` — الواجهة العربية ومسارات اللوحة
- `artifacts/api-server/src/lib/discord.ts` — اتصال Discord.js، الترحيب، الرتب، والدعوات
- `artifacts/api-server/src/routes/discord.ts` — مسارات API
- `lib/api-spec/openapi.yaml` — مصدر عقد API الوحيد
- `lib/db/src/schema/discord.ts` — إعدادات السيرفر وسجل أحداث الترحيب
- `attached_assets/` — مراجع التصميم المرفقة من المستخدم

## Architecture decisions

- Discord.js يعمل كعميل واحد داخل خادم API بدل إنشاء عميل لكل طلب، لتقليل الاتصالات والضغط.
- التغييرات في بطاقة الترحيب محلية أولًا ولا تُحفظ إلا بعد تأكيد المستخدم من شريط التطبيق الثابت.
- OpenAPI هو مصدر الحقيقة، وتُولّد منه React Query hooks وZod schemas بدل كتابة أنواع متكررة.
- عند غياب أسرار Discord، تعيد API حالة إعداد صريحة وقوائم فارغة؛ لا يتم اختلاق أرقام أو سيرفرات.

## Product

اللوحة تعرض حالة اتصال Discord، السيرفرات القابلة للإدارة، ملخص الأعضاء والانضمامات، محرر نمطي لبطاقة الترحيب، اختيار القناة والرتب، رابط الخلفية، تضمين الداعي، وسجل النشاط.

## User preferences

- اللغة العربية وRTL أولًا.
- هوية بصرية عالية التباين: أسود، أبيض، وأحمر، مع أزرار واضحة ووظيفة واحدة لكل زر.
- الأولوية لبيانات Discord الحقيقية وعدم استخدام بيانات تجريبية مضللة.

## Gotchas

- يجب إضافة أسرار Discord قبل توقع ظهور السيرفرات أو بدء أحداث الترحيب.
- بعد تعديل `lib/api-spec/openapi.yaml` يجب تشغيل codegen قبل استخدام hooks الجديدة.
- أسرار Discord لا توضع في الملفات أو المحادثة؛ تُحفظ عبر Replit Secrets.
- فحص `pnpm run typecheck` الشامل يشمل Canvas القديم وقد يفشل في ملفات لا تخص لوحة Discord.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
