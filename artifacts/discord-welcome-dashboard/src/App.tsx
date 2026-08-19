import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation } from 'wouter';
import {
  Activity, AlertTriangle, ArrowUpLeft, Bot, Check, CheckCircle2, ChevronLeft, CircleDashed,
  Copy, Eye, Hash, LayoutDashboard, Link2, Menu, MessageSquareText, Moon,
  Palette, RefreshCw, Save, Server, Settings2, ShieldCheck, SlidersHorizontal,
  Sun, UserPlus, Users, WandSparkles, X,
} from 'lucide-react';
import {
  getGetDashboardSummaryQueryKey, getGetGuildQueryKey, getGetWelcomeSettingsQueryKey,
  getHealthCheckQueryKey, getGetDiscordStatusQueryKey, getListGuildActivityQueryKey,
  getListGuildsQueryKey, useGetDashboardSummary, useGetDiscordStatus, useGetGuild,
  useGetWelcomeSettings, useHealthCheck, useListGuildActivity, useListGuilds,
  useUpdateWelcomeSettings,
} from '@workspace/api-client-react';
import type {
  ActivityItem, CardDesign, CommandConfig, DiscordStatus, Guild, GuildDetails,
  MessageSuite, WelcomeSettings, WelcomeSettingsInput,
} from '@workspace/api-client-react';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

const navItems = [
  { href: '/', label: 'نظرة عامة', icon: LayoutDashboard },
  { href: '/servers', label: 'الخوادم', icon: Server },
  { href: '/welcome', label: 'بطاقة الترحيب', icon: MessageSquareText },
  { href: '/activity', label: 'النشاط', icon: Activity },
  { href: '/settings', label: 'الإعدادات', icon: Settings2 },
];

type DraftSettings = WelcomeSettingsInput;

function formatDate(value?: string | null) {
  if (!value) return 'غير متاح';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function useGuildSelection(guilds?: Guild[]) {
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try { return localStorage.getItem('discord-selected-guild'); } catch { return null; }
  });
  const guildIds = useMemo(() => (guilds ?? []).map((guild) => guild.id).join('|'), [guilds]);
  useEffect(() => {
    if (!guilds?.length) return;
    if (!selectedId || !guildIds.split('|').includes(selectedId)) setSelectedId(guilds[0].id);
  }, [guildIds, guilds, selectedId]);
  useEffect(() => {
    try {
      if (selectedId) localStorage.setItem('discord-selected-guild', selectedId);
      else localStorage.removeItem('discord-selected-guild');
    } catch { /* local preference is optional */ }
  }, [selectedId]);
  return { selectedId, setSelectedId, selectedGuild: guilds?.find((guild) => guild.id === selectedId) ?? null };
}

function AppShell({ children, selectedGuild, onSelectGuild, status }: {
  children: ReactNode; selectedGuild: Guild | null; onSelectGuild: () => void; status?: DiscordStatus;
}) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('discord-theme') === 'dark');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('discord-theme', dark ? 'dark' : 'light');
  }, [dark]);
  return <div dir="rtl" className="noise min-h-[100dvh] bg-background text-foreground">
    <aside className={`fixed inset-y-0 right-0 z-40 flex w-[272px] flex-col bg-[#111110] text-[#f6f3ed] transition-transform duration-300 max-md:w-[292px] ${mobileOpen ? 'translate-x-0' : 'max-md:translate-x-full'}`}>
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center bg-[#ed1c24] text-white diagonal-cut"><Bot size={23} strokeWidth={2.5} /><span className="absolute bottom-1 left-1 h-2 w-2 rounded-full bg-white" /></div>
          <div><p className="font-display text-lg font-bold leading-none tracking-tight">مرحبًا</p><p className="mt-1 text-[10px] font-medium tracking-[.2em] text-white/45">CONTROL ROOM</p></div>
        </div>
        <button type="button" aria-label="إغلاق القائمة" data-testid="button-close-menu" className="hidden rounded-lg p-2 text-white/65 hover:bg-white/10 max-md:block" onClick={() => setMobileOpen(false)}><X size={18} /></button>
      </div>
      <div className="px-5 pt-7">
        <p className="mb-3 px-2 text-[10px] font-bold tracking-[.18em] text-white/35">مساحة العمل</p>
        <button type="button" onClick={onSelectGuild} data-testid="button-select-guild" className="flex w-full items-center gap-3 border border-white/10 bg-white/[.045] p-3 text-right transition hover:border-[#ed1c24]/60 hover:bg-white/[.08]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#f1eee7] font-display font-bold text-[#111110]">{selectedGuild?.iconUrl ? <img src={selectedGuild.iconUrl} alt="" className="h-full w-full object-cover" /> : selectedGuild ? initials(selectedGuild.name) : <Server size={17} />}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{selectedGuild?.name ?? 'اختر خادمًا'}</p><p className="mt-0.5 text-[11px] text-white/45">{selectedGuild ? `${selectedGuild.memberCount.toLocaleString('ar-SA')} عضو` : 'لا يوجد خادم محدد'}</p></div>
          <ChevronLeft size={16} className="text-white/35" />
        </button>
      </div>
      <nav className="flex-1 px-5 pt-8">
        <p className="mb-3 px-2 text-[10px] font-bold tracking-[.18em] text-white/35">التنقّل</p>
        <div className="space-y-1">{navItems.map(({ href, label, icon: Icon }) => {
          const active = location === href;
          return <Link key={href} href={href} onClick={() => setMobileOpen(false)} data-testid={`link-nav-${href === '/' ? 'overview' : href.slice(1)}`} className={`group flex items-center gap-3 border-r-2 px-3 py-3 text-sm font-medium transition ${active ? 'border-[#ed1c24] bg-[#ed1c24]/10 text-white' : 'border-transparent text-white/55 hover:bg-white/[.05] hover:text-white'}`}>
            <Icon size={18} strokeWidth={active ? 2.5 : 1.8} className={active ? 'text-[#ed1c24]' : 'text-white/40 group-hover:text-white/70'} /><span>{label}</span>{active && <ArrowUpLeft size={14} className="mr-auto text-[#ed1c24]" />}
          </Link>;
        })}</div>
      </nav>
      <div className="m-5 border-t border-white/10 pt-4">
        <div className="flex items-center gap-2 px-2 pb-3 text-[11px] text-white/55"><span className={`h-2 w-2 rounded-full ${status?.connected ? 'bg-[#4ade80]' : 'bg-[#ed1c24]'}`} />{status?.connected ? 'متصل بـ Discord' : status?.configured ? 'في انتظار الاتصال' : 'الاتصال غير مُعد'}</div>
        <button type="button" onClick={() => setDark((value) => !value)} data-testid="button-toggle-theme" className="flex w-full items-center gap-3 px-3 py-2 text-xs text-white/45 transition hover:bg-white/[.06] hover:text-white">{dark ? <Sun size={16} /> : <Moon size={16} />}{dark ? 'الوضع الفاتح' : 'الوضع الداكن'}</button>
      </div>
    </aside>
    {mobileOpen && <button type="button" aria-label="إغلاق القائمة" data-testid="button-menu-overlay" className="fixed inset-0 z-30 bg-[#111110]/50 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />}
    <main className="min-h-[100dvh] md:mr-[272px]">
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border/70 bg-background/90 px-5 backdrop-blur-md md:px-10">
        <div className="flex items-center gap-3"><button type="button" aria-label="فتح القائمة" data-testid="button-open-menu" className="rounded-lg p-2 hover:bg-muted md:hidden" onClick={() => setMobileOpen(true)}><Menu size={21} /></button><div className="hidden h-7 w-px bg-border md:block" /><p className="text-xs font-medium text-muted-foreground">لوحة تحكم الترحيب</p></div>
        <div className="flex items-center gap-4"><div className="hidden items-center gap-2 text-[11px] text-muted-foreground sm:flex"><span className={`h-2 w-2 rounded-full ${status?.connected ? 'bg-emerald-500' : 'bg-primary'}`} />{status?.message ?? 'جارٍ التحقق من الاتصال'}</div><div className="flex h-8 w-8 items-center justify-center bg-[#ed1c24] text-[11px] font-bold text-white">م</div></div>
      </header>
      <div className="mx-auto max-w-[1440px] px-5 py-8 md:px-10 md:py-10">{children}</div>
    </main>
  </div>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-3 flex items-center gap-2 text-[11px] font-bold tracking-[.13em] text-primary"><span className="h-1.5 w-1.5 bg-primary" />{eyebrow}</p><h1 className="font-display text-3xl font-bold tracking-tight md:text-[42px]">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">{description}</p>}</div>{action}</div>;
}

function ConnectionCard({ status, compact = false, error = false }: { status?: DiscordStatus; compact?: boolean; error?: boolean }) {
  if (error) return <ErrorState label="تعذر التحقق من اتصال Discord" />;
  if (!status) return <div data-testid="status-discord-loading" className="h-24 animate-pulse bg-muted" />;
  const ok = status.configured && status.connected;
  return <div data-testid="status-discord" className={`relative overflow-hidden border p-5 ${ok ? 'border-emerald-200 bg-emerald-50/65 dark:border-emerald-900 dark:bg-emerald-950/20' : 'border-primary/20 bg-accent/55'}`}>
    <div className="absolute -left-4 -top-10 h-24 w-24 rotate-45 bg-primary/10" /><div className="relative flex items-start gap-4"><div className={`flex h-10 w-10 shrink-0 items-center justify-center ${ok ? 'bg-emerald-500 text-white' : 'bg-primary text-white'}`}>{ok ? <CheckCircle2 size={21} /> : <AlertTriangle size={21} />}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{ok ? 'الاتصال جاهز' : status.configured ? 'الاتصال يحتاج انتباهًا' : 'أكمل إعداد Discord'}</p><span className="border border-current/20 px-2 py-0.5 text-[10px]">{ok ? 'متصل' : 'إجراء مطلوب'}</span></div><p className={`mt-1 text-sm leading-6 ${compact ? 'line-clamp-1' : ''} text-muted-foreground`}>{status.message}</p>{!ok && <Link href="/settings" data-testid="link-setup-from-status" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">عرض خطوات الإعداد <ArrowUpLeft size={14} /></Link>}</div></div>
  </div>;
}

function EmptyState({ icon: Icon, title, detail, action }: { icon: typeof Bot; title: string; detail: string; action?: ReactNode }) {
  return <div data-testid="empty-state" className="flex min-h-[220px] flex-col items-center justify-center border border-dashed border-border bg-card/50 px-6 text-center"><div className="mb-4 flex h-12 w-12 items-center justify-center bg-muted text-muted-foreground"><Icon size={22} /></div><h3 className="font-semibold">{title}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{detail}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

function ErrorState({ onRetry, label = 'تعذر تحميل البيانات' }: { onRetry?: () => void; label?: string }) {
  return <div data-testid="error-state" className="border border-primary/25 bg-accent/35 p-6"><div className="flex items-start gap-3"><AlertTriangle size={20} className="mt-0.5 shrink-0 text-primary" /><div><p className="font-semibold">{label}</p><p className="mt-1 text-sm text-muted-foreground">تحقق من اتصال الخدمة ثم حاول مرة أخرى.</p>{onRetry && <button type="button" onClick={onRetry} data-testid="button-retry" className="mt-4 inline-flex items-center gap-2 border border-primary/30 px-3 py-2 text-xs font-bold text-primary hover:bg-accent"><RefreshCw size={14} /> إعادة المحاولة</button>}</div></div></div>;
}

function StatCard({ label, value, detail, icon: Icon, accent = false }: { label: string; value?: string | number; detail: string; icon: typeof Users; accent?: boolean }) {
  return <div data-testid={`stat-${label}`} className={`relative overflow-hidden border p-5 ${accent ? 'border-[#111110] bg-[#111110] text-[#f5f1e9]' : 'border-card-border bg-card'}`}><div className={`absolute -left-2 -top-5 h-16 w-16 rotate-45 ${accent ? 'bg-primary' : 'bg-primary/10'}`} /><div className="relative flex items-start justify-between"><div><p className={`text-xs ${accent ? 'text-white/55' : 'text-muted-foreground'}`}>{label}</p><p className="mt-3 font-display text-3xl font-bold">{value === undefined ? '—' : value}</p></div><Icon size={19} className="text-primary" /></div><p className={`relative mt-5 text-[11px] ${accent ? 'text-white/50' : 'text-muted-foreground'}`}>{detail}</p></div>;
}

function ActivityList({ items, compact = false }: { items: ActivityItem[]; compact?: boolean }) {
  return <div data-testid="list-activity" className="divide-y divide-border/70">{items.map((item) => <div key={item.id} data-testid={`activity-item-${item.id}`} className="flex gap-4 py-4 first:pt-0 last:pb-0"><div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center bg-accent text-primary"><Activity size={15} /></div><div className="min-w-0 flex-1"><div className="flex flex-col justify-between gap-1 sm:flex-row"><p className="text-sm font-semibold">{item.title}</p><time className="font-display text-[10px] text-muted-foreground">{formatDate(item.createdAt)}</time></div><p className={`mt-1 text-xs leading-6 text-muted-foreground ${compact ? 'line-clamp-1' : ''}`}>{item.detail}</p></div></div>)}</div>;
}

function Dashboard({ status, statusError, selectedGuild, guilds, onSelectGuild }: { status?: DiscordStatus; statusError?: boolean; selectedGuild: Guild | null; guilds?: Guild[]; onSelectGuild: () => void }) {
  const summaryQuery = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const summary = summaryQuery.data;
  return <div><PageHeading eyebrow="نظرة عامة / ٠١" title={selectedGuild ? `أهلًا بك في ${selectedGuild.name}` : 'مركز قيادة الترحيب'} description={selectedGuild ? 'كل ما تحتاجه ليصل العضو الجديد إلى المكان الصحيح، من أول ثانية.' : 'اختر خادمًا لتبدأ في ضبط تجربة الانضمام.'} action={<Link href="/welcome" data-testid="link-customize-welcome" className="inline-flex items-center justify-center gap-2 bg-[#111110] px-5 py-3 text-sm font-bold text-white transition hover:bg-primary">تخصيص البطاقة <ArrowUpLeft size={16} /></Link>} /><ConnectionCard status={status} error={statusError} />
    {!selectedGuild && <div className="mt-6"><EmptyState icon={Server} title="لم تختر خادمًا بعد" detail={guilds?.length ? 'اختر خادمًا من قائمة الخوادم لعرض بياناته وإعداداته.' : 'عند اتصال Discord، ستظهر هنا الخوادم التي يمكنك إدارتها.'} action={<button type="button" onClick={onSelectGuild} data-testid="button-choose-server-dashboard" className="bg-primary px-4 py-2.5 text-xs font-bold text-white">اختيار خادم</button>} /></div>}
    <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="الخوادم المُدارة" value={summary?.guildCount} detail={summary ? `${summary.configuredGuildCount} مُعدّة للترحيب` : 'بانتظار بيانات Discord'} icon={Server} /><StatCard label="إجمالي الأعضاء" value={summary?.totalMembers?.toLocaleString('ar-SA')} detail="عبر الخوادم المتاحة لك" icon={Users} accent /><StatCard label="انضمامات حديثة" value={summary?.recentJoins} detail="آخر ٧ أيام" icon={UserPlus} /><StatCard label="نسبة الإسناد" value={summary ? `${summary.inviteAttributionRate}%` : undefined} detail="دعوات منسوبة بدقة" icon={Link2} /></div>
    <div className="mt-7 grid gap-7 xl:grid-cols-[1.25fr_.75fr]"><section className="border border-card-border bg-card p-5 md:p-7"><div className="mb-6 flex items-center justify-between"><div><p className="text-[11px] font-bold tracking-[.12em] text-primary">آخر الإشارات</p><h2 className="mt-1 text-xl font-bold">نشاط البوت الأخير</h2></div><Link href="/activity" data-testid="link-view-all-activity" className="text-xs font-bold text-muted-foreground hover:text-primary">عرض الكل <ArrowUpLeft size={14} className="inline" /></Link></div>{summaryQuery.isLoading ? <div data-testid="loading-dashboard-activity" className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse bg-muted" />)}</div> : summaryQuery.isError ? <ErrorState onRetry={() => summaryQuery.refetch()} /> : summary?.latestActivity?.length ? <ActivityList items={summary.latestActivity.slice(0, 5)} compact /> : <EmptyState icon={Activity} title="لا نشاط حديث" detail="سيظهر نشاط الترحيب هنا بعد انضمام أعضاء جدد." />}</section><section className="relative overflow-hidden border border-[#111110] bg-[#111110] p-6 text-[#f5f1e9] md:p-7"><div className="absolute -left-16 top-10 h-44 w-44 rotate-45 border-[18px] border-primary/80" /><div className="absolute bottom-0 right-0 h-2 w-full stripe-accent" /><div className="relative"><div className="mb-8 flex items-center gap-3"><div className="h-2 w-2 bg-primary" /><span className="text-[11px] font-bold tracking-[.14em] text-white/45">حالة المساحة</span></div><h2 className="max-w-xs text-2xl font-bold leading-[1.45]">اجعل أول رسالة<br /><span className="text-primary">تشبه خادمك.</span></h2><p className="mt-5 text-sm leading-7 text-white/55">الترحيب ليس إشعارًا آليًا. إنه الانطباع الأول الذي تختاره لأعضاء مجتمعك.</p><Link href="/welcome" data-testid="link-design-card-promo" className="mt-8 inline-flex items-center gap-2 border border-white/20 px-4 py-3 text-xs font-bold transition hover:border-primary hover:text-primary">ابدأ التصميم <ArrowUpLeft size={15} /></Link></div></section></div>
  </div>;
}

function Servers({ guilds, isLoading, isError, refetch, selectedId, onSelect }: { guilds?: Guild[]; isLoading: boolean; isError: boolean; refetch: () => void; selectedId: string | null; onSelect: (id: string) => void }) {
  const [, navigate] = useLocation();
  return <div><PageHeading eyebrow="الخوادم / ٠٢" title="اختر مساحتك" description="الخوادم التي يمكن لحسابك إدارتها. أضف البوت إلى أي مساحة لتفعيل رسائل الترحيب." action={<button type="button" onClick={refetch} data-testid="button-refresh-guilds" className="inline-flex items-center gap-2 border border-border bg-card px-4 py-3 text-xs font-bold hover:border-primary hover:text-primary"><RefreshCw size={15} /> تحديث القائمة</button>} />{isLoading ? <div data-testid="loading-guilds" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((i) => <div key={i} className="h-44 animate-pulse bg-muted" />)}</div> : isError ? <ErrorState onRetry={refetch} label="تعذر الوصول إلى قائمة الخوادم" /> : !guilds?.length ? <EmptyState icon={Server} title="لا توجد خوادم متاحة" detail="لا توجد خوادم جاهزة للعرض. تحقق من إعداد Discord وصلاحيات البوت." /> : <div data-testid="list-guilds" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{guilds.map((guild) => <button key={guild.id} type="button" onClick={() => { onSelect(guild.id); navigate('/'); }} data-testid={`card-guild-${guild.id}`} className={`group relative overflow-hidden border p-5 text-right transition hover:-translate-y-0.5 hover:shadow-[var(--shadow)] ${selectedId === guild.id ? 'border-primary bg-accent/40' : 'border-card-border bg-card'}`}><div className={`absolute left-0 top-0 h-1 w-full ${guild.botPresent ? 'bg-emerald-500' : 'bg-primary'}`} /><div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center bg-[#111110] font-display text-lg font-bold text-white">{guild.iconUrl ? <img src={guild.iconUrl} alt="" className="h-full w-full object-cover" /> : initials(guild.name)}</div><div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{guild.name}</h2><p className="mt-1 text-xs text-muted-foreground">{guild.memberCount.toLocaleString('ar-SA')} عضو</p></div>{selectedId === guild.id && <CheckCircle2 size={19} className="text-primary" />}</div><div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4 text-[11px]"><span className={`flex items-center gap-1.5 font-semibold ${guild.botPresent ? 'text-emerald-600' : 'text-primary'}`}><span className={`h-1.5 w-1.5 rounded-full ${guild.botPresent ? 'bg-emerald-500' : 'bg-primary'}`} />{guild.botPresent ? 'البوت موجود' : 'البوت غير مضاف'}</span><span className="text-muted-foreground">{guild.canManage ? 'صلاحية إدارة' : 'قراءة فقط'}</span></div></button>)}</div>}</div>;
}

function SectionTitle({ index, icon: Icon, title, detail }: { index: string; icon: typeof Bot; title: string; detail: string }) {
  return <div className="mb-6 flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center bg-accent text-primary"><Icon size={17} /></div><div><p className="font-display text-[10px] font-bold text-primary">{index}</p><h2 className="mt-0.5 text-lg font-bold">{title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></div></div>;
}

function Field({ label, children, icon: Icon }: { label: string; children: ReactNode; icon?: typeof Hash }) {
  return <label className="block"><span className="mb-2 flex items-center gap-1.5 text-xs font-semibold">{Icon && <Icon size={13} className="text-muted-foreground" />}{label}</span>{children}</label>;
}

function Toggle({ checked, onChange, label, detail, testId }: { checked: boolean; onChange: (value: boolean) => void; label: string; detail?: string; testId: string }) {
  return <button type="button" role="switch" aria-checked={checked} data-testid={testId} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 text-right"><span><span className="block text-sm font-semibold">{label}</span>{detail && <span className="mt-1 block text-xs leading-5 text-muted-foreground">{detail}</span>}</span><span className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}><span className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-transform ${checked ? 'translate-x-1' : 'translate-x-5'}`} /></span></button>;
}

function SuiteField({ enabled, onEnabled, label, testId, children }: { enabled: boolean; onEnabled: (value: boolean) => void; label: string; testId: string; children: ReactNode }) {
  return <div className="border-t border-border/60 pt-4 first:border-t-0 first:pt-0"><Toggle checked={enabled} onChange={onEnabled} label={label} testId={testId} />{enabled && children}</div>;
}

function VariableHelp() {
  return <div className="border-r-2 border-primary bg-accent/45 p-3 text-xs leading-6 text-muted-foreground">المتغيرات المتاحة: <code className="font-display text-primary">{'{user}'}</code> للاسم، <code className="font-display text-primary">{'{server}'}</code> لاسم الخادم، <code className="font-display text-primary">{'{inviter}'}</code> للداعي.</div>;
}

function Preview({ draft, guild }: { draft: DraftSettings; guild: Guild }) {
  return <aside className="sticky top-[96px]"><div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 text-xs font-bold"><Eye size={15} className="text-primary" /> معاينة مباشرة</p><span className="font-display text-[10px] text-muted-foreground">١:١</span></div><div className="overflow-hidden border border-[#272523] bg-[#151413] p-4 text-[#f7f3eb] shadow-[0_20px_70px_rgba(20,16,12,.16)]"><div className="flex items-center gap-2 border-b border-white/10 pb-3"><div className="flex h-7 w-7 items-center justify-center bg-[#ed1c24] text-[9px] font-bold">{initials(guild.name)}</div><span className="text-[10px] text-white/55">رسالة ترحيب جديدة</span></div><div className="mt-4 border-r-4 p-4" style={{ borderColor: draft.accentColor || '#ed1c24' }}><p className="text-lg font-bold">{draft.headline || 'عنوان الترحيب'}</p><p className="mt-3 text-xs leading-6 text-white/60">{draft.body || 'اكتب نصًا يعبّر عن مجتمعك.'}</p>{draft.includeInviter && <p className="mt-5 text-[10px] text-white/40">انضم بدعوة من عضو في المجتمع</p>}</div><div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-[10px] text-white/40"><span>الآن</span><span>{draft.style === 'banner' ? 'شريط عريض' : 'رسالة مدمجة'}</span></div></div></aside>;
}

function WelcomePage({ selectedGuild, selectedId }: { selectedGuild: Guild | null; selectedId: string | null }) {
  const guildQuery = useGetGuild(selectedId ?? '', { query: { enabled: Boolean(selectedId), queryKey: getGetGuildQueryKey(selectedId ?? '') } });
  const settingsQuery = useGetWelcomeSettings(selectedId ?? '', { query: { enabled: Boolean(selectedId), queryKey: getGetWelcomeSettingsQueryKey(selectedId ?? '') } });
  const update = useUpdateWelcomeSettings();
  const client = useQueryClient();
  const [draft, setDraft] = useState<DraftSettings | null>(null);
  const [original, setOriginal] = useState<DraftSettings | null>(null);
  const initializedForId = useRef<string | null>(null);
  const [tab, setTab] = useState<'message' | 'card' | 'automation'>('message');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  useEffect(() => {
    if (!settingsQuery.data || !selectedId || initializedForId.current === selectedId) return;
    const value = settingsQuery.data;
    const next: DraftSettings = { enabled: value.enabled, style: value.style, channelId: value.channelId, headline: value.headline, body: value.body, accentColor: value.accentColor, backgroundUrl: value.backgroundUrl, includeInviter: value.includeInviter, autoRoleIds: value.autoRoleIds, cardDesign: value.cardDesign, messageSuite: value.messageSuite, commandConfig: value.commandConfig };
    initializedForId.current = selectedId; setDraft(next); setOriginal(next); setSaved(false);
  }, [settingsQuery.data, selectedId]);
  const hasChanges = Boolean(draft && original && JSON.stringify(draft) !== JSON.stringify(original));
  const updateDraft = <K extends keyof DraftSettings>(key: K, value: DraftSettings[K]) => { setSaved(false); setSaveError(false); setDraft((current) => current ? { ...current, [key]: value } : current); };
  const updateCard = <K extends keyof CardDesign>(key: K, value: CardDesign[K]) => setDraft((current) => current?.cardDesign ? { ...current, cardDesign: { ...current.cardDesign, [key]: value } } : current);
  const updateMessage = <K extends keyof MessageSuite>(key: K, value: MessageSuite[K]) => setDraft((current) => current?.messageSuite ? { ...current, messageSuite: { ...current.messageSuite, [key]: value } } : current);
  const updateCommand = (index: number, value: Partial<CommandConfig>) => setDraft((current) => current ? { ...current, commandConfig: (current.commandConfig ?? []).map((command, i) => i === index ? { ...command, ...value } : command) } : current);
  const save = () => {
    if (!selectedId || !draft || update.isPending) return;
    setSaveError(false);
    update.mutate({ guildId: selectedId, data: draft }, { onSuccess: (result) => { const next = result as WelcomeSettings; const normalized = { enabled: next.enabled, style: next.style, channelId: next.channelId, headline: next.headline, body: next.body, accentColor: next.accentColor, backgroundUrl: next.backgroundUrl, includeInviter: next.includeInviter, autoRoleIds: next.autoRoleIds, cardDesign: next.cardDesign, messageSuite: next.messageSuite, commandConfig: next.commandConfig }; setDraft(normalized); setOriginal(normalized); setSaved(true); client.setQueryData(getGetWelcomeSettingsQueryKey(selectedId), result); client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); client.invalidateQueries({ queryKey: getListGuildsQueryKey() }); }, onError: () => setSaveError(true) });
  };
  if (!selectedGuild || !selectedId) return <div><PageHeading eyebrow="بطاقة الترحيب / ٠٣" title="صمّم لحظة الوصول" description="اختر خادمًا أولًا حتى تظهر إعدادات القنوات والأدوار الخاصة به." /><EmptyState icon={MessageSquareText} title="لا يوجد خادم محدد" detail="اختر خادمًا من مبدّل الخادم أعلى اللوحة للبدء." action={<Link href="/servers" data-testid="link-choose-server-welcome" className="bg-primary px-4 py-2.5 text-xs font-bold text-white">اختيار خادم</Link>} /></div>;
  if (settingsQuery.isLoading || guildQuery.isLoading) return <div><PageHeading eyebrow="بطاقة الترحيب / ٠٣" title="صمّم لحظة الوصول" /><div data-testid="loading-welcome" className="grid gap-6 lg:grid-cols-[1fr_400px]"><div className="h-[500px] animate-pulse bg-muted" /><div className="h-[500px] animate-pulse bg-muted" /></div></div>;
  if (settingsQuery.isError || guildQuery.isError) return <div><PageHeading eyebrow="بطاقة الترحيب / ٠٣" title="صمّم لحظة الوصول" /><ErrorState onRetry={() => { settingsQuery.refetch(); guildQuery.refetch(); }} label="تعذر تحميل إعدادات الخادم" /></div>;
  if (!draft || !guildQuery.data) return <div><PageHeading eyebrow="بطاقة الترحيب / ٠٣" title="صمّم لحظة الوصول" /><EmptyState icon={SlidersHorizontal} title="الإعدادات غير متاحة" detail="لا توجد إعدادات محفوظة لهذا الخادم حتى الآن، أو أن البوت غير متصل." /></div>;
  const details = guildQuery.data as GuildDetails;
  const card = draft.cardDesign;
  const suite = draft.messageSuite;
  const commands = draft.commandConfig ?? [];
  const channels = details.channels.filter((channel) => channel.type === 'text' || channel.type === 'announcement');
  const roles = details.roles.filter((role) => !role.managed);
  return <div className="pb-24"><PageHeading eyebrow="الاستوديو / ٠٣" title="صمّم لحظة الوصول" description={`تجربة الانضمام في ${selectedGuild.name}. اعمل على اللوحة، ثم طبّق التغييرات دفعة واحدة.`} action={<div className={`flex items-center gap-2 text-xs font-semibold ${draft.enabled ? 'text-emerald-600' : 'text-muted-foreground'}`}><span className={`h-2 w-2 ${draft.enabled ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />{draft.enabled ? 'الترحيب مفعّل' : 'الترحيب متوقف'}</div>} />
    <div className="mb-6 flex items-center justify-between gap-4 border-y border-border bg-card px-2 py-2"><div className="flex min-w-0 items-center gap-2"><span className="h-8 w-8 shrink-0 bg-[#111110] p-1">{selectedGuild.iconUrl ? <img src={selectedGuild.iconUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-[10px] font-bold text-white">{initials(selectedGuild.name)}</span>}</span><span className="truncate text-xs font-bold">{selectedGuild.name}</span></div><div className="flex shrink-0 gap-1" role="tablist" aria-label="أقسام محرر الترحيب">{([['message', 'الرسالة'], ['card', 'البطاقة'], ['automation', 'الأتمتة']] as const).map(([value, label], index) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} data-testid={`tab-welcome-${value}`} className={`border-b-2 px-3 py-2 text-xs font-bold transition ${tab === value ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}><span className="ml-1 font-display text-[10px] text-primary">٠{index + 1}</span>{label}</button>)}</div></div>
    <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_410px]"><section className="space-y-6">
      {tab === 'message' && <><div className="border border-card-border bg-card p-5 md:p-7"><SectionTitle index="٠١" icon={Palette} title="شكل الرسالة" detail="اختر الحضور الأول للترحيب داخل Discord." /><div className="grid gap-3 sm:grid-cols-2"><button type="button" data-testid="button-style-embed" onClick={() => updateDraft('style', 'embed')} className={`border p-4 text-right transition ${draft.style === 'embed' ? 'border-primary bg-accent/40' : 'border-border hover:border-primary/50'}`}><div className="mb-5 flex h-20 items-end gap-1 bg-[#111110] p-3"><span className="h-8 w-1 bg-primary" /><span className="h-2 w-24 bg-white/80" /><span className="mr-auto h-2 w-8 bg-primary" /></div><p className="text-sm font-bold">رسالة مدمجة</p><p className="mt-1 text-xs text-muted-foreground">هادئة وواضحة داخل القناة</p></button><button type="button" data-testid="button-style-banner" onClick={() => updateDraft('style', 'banner')} className={`border p-4 text-right transition ${draft.style === 'banner' ? 'border-primary bg-accent/40' : 'border-border hover:border-primary/50'}`}><div className="mb-5 flex h-20 items-center justify-center bg-[#111110] px-3"><span className="w-full border-y border-primary py-2 text-center text-[10px] font-bold text-white">أهلًا بك في المساحة</span></div><p className="text-sm font-bold">شريط عريض</p><p className="mt-1 text-xs text-muted-foreground">افتتاحية تلفت الانتباه</p></button></div></div>
        <div className="border border-card-border bg-card p-5 md:p-7"><SectionTitle index="٠٢" icon={MessageSquareText} title="الكلمات والقناة" detail="اكتب أقل ما يلزم ليعرف العضو أين يبدأ." /><div className="space-y-5"><Field label="قناة الإرسال" icon={Hash}><select value={draft.channelId ?? ''} onChange={(event) => updateDraft('channelId', event.target.value || null)} data-testid="select-welcome-channel" className="field"><option value="">اختر قناة الترحيب</option>{channels.map((channel) => <option value={channel.id} key={channel.id}>#{channel.name}</option>)}</select></Field><Field label="العنوان"><input value={draft.headline} onChange={(event) => updateDraft('headline', event.target.value)} data-testid="input-welcome-headline" className="field" placeholder="أهلًا بك في المساحة" /></Field><Field label="نص الرسالة"><textarea value={draft.body} onChange={(event) => updateDraft('body', event.target.value)} data-testid="textarea-welcome-body" className="field min-h-28 resize-y" placeholder="اكتب رسالة ترحيب..." /></Field><VariableHelp /></div></div>
        {suite && <div className="border border-card-border bg-card p-5 md:p-7"><SectionTitle index="٠٣" icon={MessageSquareText} title="حزمة الرسائل" detail="وحّد النبرة عبر الترحيب الخاص ورسالة المغادرة." /><div className="space-y-5"><SuiteField enabled={suite.welcomeChannelEnabled} onEnabled={(value) => updateMessage('welcomeChannelEnabled', value)} label="رسالة القناة" testId="toggle-suite-channel"><textarea value={suite.welcomeMessage} onChange={(event) => updateMessage('welcomeMessage', event.target.value)} data-testid="textarea-suite-welcome" className="field mt-3 min-h-20" /></SuiteField><SuiteField enabled={suite.dmEnabled} onEnabled={(value) => updateMessage('dmEnabled', value)} label="رسالة خاصة للعضو" testId="toggle-suite-dm"><textarea value={suite.dmMessage} onChange={(event) => updateMessage('dmMessage', event.target.value)} data-testid="textarea-suite-dm" className="field mt-3 min-h-20" /></SuiteField><SuiteField enabled={suite.leaveEnabled} onEnabled={(value) => updateMessage('leaveEnabled', value)} label="رسالة المغادرة" testId="toggle-suite-leave"><textarea value={suite.leaveMessage} onChange={(event) => updateMessage('leaveMessage', event.target.value)} data-testid="textarea-suite-leave" className="field mt-3 min-h-20" /></SuiteField></div></div>}</>}
      {tab === 'card' && <><div className="border border-card-border bg-card p-5 md:p-7"><SectionTitle index="٠١" icon={WandSparkles} title="استوديو البطاقة" detail="اضبط مساحة العرض، الخلفية، ومكان المعلومات." />{card ? <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="العرض"><input type="number" min="320" max="2400" value={card.width} onChange={(e) => updateCard('width', Number(e.target.value))} data-testid="input-card-width" className="field" /></Field><Field label="الارتفاع"><input type="number" min="180" max="1400" value={card.height} onChange={(e) => updateCard('height', Number(e.target.value))} data-testid="input-card-height" className="field" /></Field></div><Field label="رابط الخلفية"><input value={card.backgroundUrl ?? ''} onChange={(e) => updateCard('backgroundUrl', e.target.value || null)} data-testid="input-card-background" className="field" placeholder="https://..." dir="ltr" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="شكل الصورة"><select value={card.avatar.shape} onChange={(e) => updateCard('avatar', { ...card.avatar, shape: e.target.value as CardDesign['avatar']['shape'] })} data-testid="select-avatar-shape" className="field"><option value="circle">دائرية</option><option value="rounded">مستديرة</option><option value="square">مربعة</option></select></Field><Field label="حجم الصورة"><input type="number" min="32" max="600" value={card.avatar.size} onChange={(e) => updateCard('avatar', { ...card.avatar, size: Number(e.target.value) })} data-testid="input-avatar-size" className="field" /></Field></div><div className="border-t border-border/60 pt-5"><Toggle checked={card.username.enabled} onChange={(value) => updateCard('username', { ...card.username, enabled: value })} label="إظهار اسم العضو" detail="يظهر الاسم فوق البطاقة حسب الإحداثيات المحفوظة." testId="toggle-card-username" /></div><Field label="محاذاة الاسم"><select value={card.username.align} onChange={(e) => updateCard('username', { ...card.username, align: e.target.value as CardDesign['username']['align'] })} data-testid="select-username-align" className="field"><option value="right">يمين</option><option value="center">وسط</option><option value="left">يسار</option></select></Field><Field label="لون اللمسة"><div className="flex gap-2"><input type="color" value={draft.accentColor} onChange={(e) => updateDraft('accentColor', e.target.value)} data-testid="input-accent-color" className="h-11 w-14 cursor-pointer border border-input bg-background p-1" /><input value={draft.accentColor} onChange={(e) => updateDraft('accentColor', e.target.value)} data-testid="input-accent-hex" className="field font-display" dir="ltr" /></div></Field></div> : <EmptyState icon={Palette} title="استوديو البطاقة غير متاح" detail="أعد تحميل إعدادات الخادم للمتابعة." />}</div></>}
      {tab === 'automation' && <><div className="border border-card-border bg-card p-5 md:p-7"><SectionTitle index="٠١" icon={SlidersHorizontal} title="التشغيل التلقائي" detail="تحكم بما يحدث لحظة انضمام العضو." /><div className="space-y-5"><Toggle checked={draft.enabled} onChange={(value) => updateDraft('enabled', value)} label="تفعيل الترحيب" detail="يبدأ البوت بإرسال الرسائل عند دخول عضو جديد." testId="toggle-welcome-enabled" /><Toggle checked={draft.includeInviter} onChange={(value) => updateDraft('includeInviter', value)} label="إظهار الداعي" detail="أضف مصدر الدعوة إلى رسالة الترحيب عند توفره." testId="toggle-include-inviter" /><div className="border-t border-border/60 pt-5"><p className="mb-3 text-xs font-semibold">الأدوار التلقائية</p>{roles.length ? <div className="space-y-2">{roles.map((role) => <label key={role.id} className="flex items-center gap-3 border border-border/70 px-3 py-2.5 text-xs"><input type="checkbox" checked={draft.autoRoleIds.includes(role.id)} onChange={(e) => updateDraft('autoRoleIds', e.target.checked ? [...draft.autoRoleIds, role.id] : draft.autoRoleIds.filter((id) => id !== role.id))} data-testid={`checkbox-role-${role.id}`} className="accent-primary" /><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: role.color || '#ed1c24' }} /><span>{role.name}</span></label>)}</div> : <p className="text-xs text-muted-foreground">لا توجد أدوار مؤهلة للإسناد التلقائي.</p>}</div></div></div><div className="border border-card-border bg-card p-5 md:p-7"><SectionTitle index="٠٢" icon={Hash} title="أوامر الترحيب" detail="اجعل التحكم واضحًا لمن يدير المجتمع." />{commands.length ? <div className="space-y-4">{commands.map((command, index) => <div key={`${command.name}-${index}`} className="border border-border/70 p-4"><Toggle checked={command.enabled} onChange={(value) => updateCommand(index, { enabled: value })} label={`/${command.name}`} testId={`toggle-command-${command.name}`} /><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={command.deleteCommand} onChange={(e) => updateCommand(index, { deleteCommand: e.target.checked })} data-testid={`checkbox-delete-command-${command.name}`} className="accent-primary" /> حذف الأمر بعد التنفيذ</label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={command.deleteBotResponse} onChange={(e) => updateCommand(index, { deleteBotResponse: e.target.checked })} data-testid={`checkbox-delete-response-${command.name}`} className="accent-primary" /> حذف رد البوت</label></div></div>)}</div> : <p className="text-sm text-muted-foreground">لا توجد أوامر مهيّأة لهذا الخادم.</p>}</div></>}
    </section><Preview draft={draft} guild={selectedGuild} /></div>
    <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-background/95 px-5 py-3 backdrop-blur-md md:right-[272px] md:px-10"><div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4"><div className="flex items-center gap-2 text-xs text-muted-foreground">{saved ? <><Check size={15} className="text-emerald-600" /> تم تطبيق آخر تغييرات</> : hasChanges ? <><CircleDashed size={15} className="text-primary" /> تغييرات محلية غير محفوظة</> : 'كل التغييرات محفوظة'}{saveError && <span className="text-primary">تعذر الحفظ</span>}</div><button type="button" onClick={save} disabled={!hasChanges || update.isPending} data-testid="button-save-welcome" className="inline-flex items-center gap-2 bg-primary px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#c4161d] disabled:cursor-not-allowed disabled:opacity-40">{update.isPending ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}{update.isPending ? 'جارٍ التطبيق' : 'حفظ وتطبيق'}</button></div></div>
  </div>;
}

function ActivityPage({ selectedId, selectedGuild }: { selectedId: string | null; selectedGuild: Guild | null }) {
  const query = useListGuildActivity(selectedId ?? '', { query: { enabled: Boolean(selectedId), queryKey: getListGuildActivityQueryKey(selectedId ?? '') } });
  if (!selectedGuild || !selectedId) return <div><PageHeading eyebrow="النشاط / ٠٤" title="سجل الوصول" description="كل ما يفعله البوت داخل مساحة العمل." /><EmptyState icon={Activity} title="اختر خادمًا لمراجعة النشاط" detail="تظهر هنا رسائل الترحيب وإسناد الدعوات للخادم المحدد." action={<Link href="/servers" data-testid="link-choose-server-activity" className="bg-primary px-4 py-2.5 text-xs font-bold text-white">اختيار خادم</Link>} /></div>;
  return <div><PageHeading eyebrow="النشاط / ٠٤" title="سجل الوصول" description={`آخر إشارات البوت في ${selectedGuild.name}.`} action={<button type="button" onClick={() => query.refetch()} data-testid="button-refresh-activity" className="inline-flex items-center gap-2 border border-border bg-card px-4 py-3 text-xs font-bold hover:border-primary hover:text-primary"><RefreshCw size={15} /> تحديث النشاط</button>} />{query.isLoading ? <div data-testid="loading-activity" className="space-y-3 border border-card-border bg-card p-6">{[1, 2, 3, 4].map((i) => <div key={i} className="h-16 animate-pulse bg-muted" />)}</div> : query.isError ? <ErrorState onRetry={() => query.refetch()} label="تعذر تحميل نشاط الخادم" /> : query.data?.length ? <section className="border border-card-border bg-card p-5 md:p-7"><ActivityList items={query.data} /></section> : <EmptyState icon={Activity} title="لا يوجد نشاط بعد" detail="سيظهر سجل الوصول هنا عندما يعالج البوت أول انضمام." />}</div>;
}

function SettingsPage({ status, statusError }: { status?: DiscordStatus; statusError?: boolean }) {
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey() } });
  const [copied, setCopied] = useState(false);
  const [alerts, setAlerts] = useState(() => localStorage.getItem('discord-alerts') !== 'off');
  const copy = () => { if (status?.botUser) { navigator.clipboard?.writeText(status.botUser); setCopied(true); setTimeout(() => setCopied(false), 1600); } };
  const toggleAlerts = (value: boolean) => { setAlerts(value); localStorage.setItem('discord-alerts', value ? 'on' : 'off'); };
  return <div><PageHeading eyebrow="الإعدادات / ٠٥" title="ضبط غرفة التحكم" description="إرشادات الاتصال والتفضيلات التي تؤثر على تجربتك داخل اللوحة." /><div className="grid gap-7 xl:grid-cols-[1fr_380px]"><div className="space-y-6"><section className="border border-card-border bg-card p-5 md:p-7"><SectionTitle index="٠١" icon={Bot} title="اتصال Discord" detail="الحالة الحالية للتطبيق والبوت." /><ConnectionCard status={status} error={statusError} />{status?.botUser && <div className="mt-4 flex items-center justify-between gap-3 border border-border p-3"><div><p className="text-[10px] text-muted-foreground">حساب البوت</p><p className="mt-1 font-display text-xs" dir="ltr">{status.botUser}</p></div><button type="button" onClick={copy} data-testid="button-copy-bot-user" className="inline-flex items-center gap-1.5 border border-border px-3 py-2 text-xs font-bold hover:border-primary hover:text-primary">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'تم النسخ' : 'نسخ'}</button></div>}</section><section className="border border-card-border bg-card p-5 md:p-7"><SectionTitle index="٠٢" icon={ShieldCheck} title="خطوات الإعداد" detail="إذا كان الاتصال غير جاهز، اتبع المسار المختصر." /><div className="space-y-4">{['تأكد من وجود متغيرات Discord في بيئة الخدمة.', 'امنح البوت صلاحية قراءة القنوات وإرسال الرسائل.', 'ارجع إلى صفحة الخوادم واختر مساحة لإكمال الضبط.'].map((step, i) => <div key={step} className="flex gap-4"><div className="flex h-7 w-7 shrink-0 items-center justify-center bg-[#111110] font-display text-xs font-bold text-white">{String(i + 1).padStart(2, '0')}</div><p className="pt-1 text-sm leading-6">{step}</p></div>)}</div><Link href="/servers" data-testid="link-open-servers-settings" className="mt-6 inline-flex items-center gap-2 bg-primary px-4 py-3 text-xs font-bold text-white">فتح قائمة الخوادم <ArrowUpLeft size={15} /></Link></section></div><section className="border border-card-border bg-card p-5 md:p-7"><SectionTitle index="٠٣" icon={SlidersHorizontal} title="تفضيلات اللوحة" detail="تفضيلات محلية لهذا المتصفح." /><Toggle checked={alerts} onChange={toggleAlerts} label="تنبيهات الحفظ" detail="إظهار حالة واضحة بعد تطبيق إعدادات الترحيب." testId="toggle-save-alerts" /><div className="mt-6 border-t border-border/60 pt-5"><p className="text-xs font-semibold">اللغة</p><p className="mt-1 text-xs text-muted-foreground">العربية هي اللغة الأساسية للوحة.</p><div className="mt-3 flex items-center justify-between border border-primary bg-accent/40 px-3 py-2 text-xs font-semibold">العربية <Check size={15} className="text-primary" /></div><div className="mt-6 border-t border-border/60 pt-5"><p className="text-xs font-semibold">خدمة اللوحة</p><p data-testid="status-health" className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><span className={`h-2 w-2 rounded-full ${health.data?.status === 'ok' ? 'bg-emerald-500' : 'bg-primary'}`} />{health.isLoading ? 'جارٍ فحص الخدمة' : health.data?.status === 'ok' ? 'الخدمة تعمل' : 'حالة الخدمة غير متاحة'}</p></div></div></section></div></div>;
}

function Router() {
  const [, navigate] = useLocation();
  const statusQuery = useGetDiscordStatus({ query: { queryKey: getGetDiscordStatusQueryKey() } });
  const guildQuery = useListGuilds({ query: { queryKey: getListGuildsQueryKey() } });
  const { selectedId, setSelectedId, selectedGuild } = useGuildSelection(guildQuery.data);
  return <AppShell selectedGuild={selectedGuild} onSelectGuild={() => navigate('/servers')} status={statusQuery.data}><Switch><Route path="/"><Dashboard status={statusQuery.data} statusError={statusQuery.isError} selectedGuild={selectedGuild} guilds={guildQuery.data} onSelectGuild={() => navigate('/servers')} /></Route><Route path="/servers"><Servers guilds={guildQuery.data} isLoading={guildQuery.isLoading} isError={guildQuery.isError} refetch={() => guildQuery.refetch()} selectedId={selectedId} onSelect={setSelectedId} /></Route><Route path="/welcome"><WelcomePage selectedGuild={selectedGuild} selectedId={selectedId} /></Route><Route path="/activity"><ActivityPage selectedId={selectedId} selectedGuild={selectedGuild} /></Route><Route path="/settings"><SettingsPage status={statusQuery.data} statusError={statusQuery.isError} /></Route><Route component={NotFound} /></Switch></AppShell>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><Router /><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;