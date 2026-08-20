import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import {
  Activity, AlertTriangle, ArrowUpLeft, Bot, Check, CheckCircle2, ChevronLeft, ChevronRight, CircleDashed,
  Copy, Eye, Hash, LayoutDashboard, Link2, Menu, MessageSquareText, Moon,
  Palette, Plus, RefreshCw, Save, Server, Settings2, ShieldCheck, SlidersHorizontal,
  Sun, ToggleLeft, ToggleRight, Trash2, UserPlus, Users, WandSparkles, X, Zap, Power, Key,
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
  { href: '/activity', label: 'النشاط', icon: Activity },
  { href: '/settings', label: 'الإعدادات', icon: Settings2 },
];

type DraftSettings = WelcomeSettingsInput;

interface BotCredentials {
  botToken: string;
  clientId: string;
  clientSecret: string;
  isOnline: boolean;
}

function getDefaultCredentials(): BotCredentials {
  try {
    const stored = localStorage.getItem('discord-bot-credentials');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch { /* ignore */ }
  return { botToken: '', clientId: '', clientSecret: '', isOnline: false };
}

function saveCredentials(credentials: BotCredentials) {
  try {
    localStorage.setItem('discord-bot-credentials', JSON.stringify(credentials));
  } catch { /* ignore */ }
}

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
  return <div data-testid="empty-state" className="flex min-h-[220px] flex-col items-center justify-center border border-dashed border-border bg-card/50 px-6 text-center"><div className="mb-4 flex h-12 w-12 shrink-0 items-center justify-center bg-muted text-muted-foreground"><Icon size={22} /></div><h3 className="font-semibold">{title}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{detail}</p>{action && <div className="mt-5">{action}</div>}</div>;
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

function Servers({ guilds, isLoading, isError, refetch, selectedId, onSelect }: { guilds?: Guild[]; isLoading: boolean; isError: boolean; refetch: () => void; selectedId: string | null; onSelect: (id: string) => void }) {
  const [, navigate] = useLocation();
  const credentials = getDefaultCredentials();
  const inviteUrl = credentials.clientId ? `https://discord.com/api/oauth2/authorize?client_id=${credentials.clientId}&permissions=8&scope=bot%20applications.commands` : '#';
  
  return <div><PageHeading eyebrow="الخوادم / ٠٢" title="اختر مساحتك" description="الخوادم التي يمكن لحسابك إدارتها. أضف البوت إلى أي مساحة لتفعيل رسائل الترحيب." action={<div className="flex items-center gap-2"><a href={inviteUrl} target="_blank" rel="noopener noreferrer" data-testid="button-add-server" className="inline-flex items-center gap-2 bg-[#ed1c24] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#ed1c24]/90 disabled:opacity-50 disabled:cursor-not-allowed" onClick={(e) => { if (!credentials.clientId) { e.preventDefault(); alert('يرجى إدخال Client ID في صفحة الإعدادات أولاً'); } }}><Plus size={15} /> إضافة خادم</a><button type="button" onClick={refetch} data-testid="button-refresh-guilds" className="inline-flex items-center gap-2 border border-border bg-card px-4 py-3 text-xs font-bold hover:border-primary hover:text-primary"><RefreshCw size={15} /> تحديث القائمة</button></div>} />
    {isLoading ? <div data-testid="loading-guilds" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((i) => <div key={i} className="h-44 animate-pulse bg-muted" />)}</div> : isError ? <ErrorState onRetry={refetch} label="تعذر الوصول إلى قائمة الخوادم" /> : !guilds?.length ? <EmptyState icon={Server} title="لا توجد خوادم متاحة" detail="لا توجد خوادم جاهزة للعرض. تحقق من إعداد Discord وصلاحيات البوت." action={<a href={inviteUrl} target="_blank" rel="noopener noreferrer" className="bg-primary px-4 py-2.5 text-xs font-bold text-white inline-flex items-center gap-2"><Plus size={14} /> إضافة خادم جديد</a>} /> : <div data-testid="list-guilds" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{guilds.map((guild) => <button key={guild.id} type="button" onClick={() => { onSelect(guild.id); navigate(`/server/${guild.id}`); }} data-testid={`card-guild-${guild.id}`} className={`group relative overflow-hidden border p-5 text-right transition hover:-translate-y-0.5 hover:shadow-[var(--shadow)] cursor-pointer ${selectedId === guild.id ? 'border-primary bg-accent/40' : 'border-card-border bg-card'}`}><div className={`absolute left-0 top-0 h-1 w-full ${guild.botPresent ? 'bg-emerald-500' : 'bg-primary'}`} /><div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center bg-[#111110] font-display text-lg font-bold text-white">{guild.iconUrl ? <img src={guild.iconUrl} alt="" className="h-full w-full object-cover" /> : initials(guild.name)}</div><div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{guild.name}</h2><p className="mt-1 text-xs text-muted-foreground">{guild.memberCount.toLocaleString('ar-SA')} عضو</p></div>{selectedId === guild.id && <CheckCircle2 size={19} className="text-primary" />}</div><div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4 text-[11px]"><span className={`flex items-center gap-1.5 font-semibold ${guild.botPresent ? 'text-emerald-600' : 'text-primary'}`}><span className={`h-1.5 w-1.5 rounded-full ${guild.botPresent ? 'bg-emerald-500' : 'bg-primary'}`} />{guild.botPresent ? 'البوت موجود' : 'البوت غير مضاف'}</span><span className="text-muted-foreground">{guild.canManage ? 'صلاحية إدارة' : 'قراءة فقط'}</span></div></button>)}</div>}
  </div>;
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
  return <div className="border-r-2 border-primary bg-accent/45 p-3 text-xs leading-6 text-muted-foreground">المتغيرات المتاحة: <code className="font-display text-primary">{'{user}'}</code> للاسم، <code className="font-display text-primary">{'{userName}'}</code> للاسم الظاهر، <code className="font-display text-primary">{'{server}'}</code> لاسم الخادم، <code className="font-display text-primary">{'{memberCount}'}</code> لعدد الأعضاء، <code className="font-display text-primary">{'{inviter}'}</code> للداعي، <code className="font-display text-primary">{'{invitesCount}'}</code> لعدد دعواته، <code className="font-display text-primary">{'{prefix}'}</code> للبادئة، <code className="font-display text-primary">{'{userCreatedDays}'}</code> لعمر الحساب.</div>;
}

function RolePicker({ roles, selectedIds, onChange, testPrefix, label }: { roles: GuildDetails['roles']; selectedIds: string[]; onChange: (ids: string[]) => void; testPrefix: string; label: string }) {
  return <div className="border-t border-border/60 pt-5"><div className="mb-3 flex items-center justify-between gap-3"><p className="text-xs font-semibold">{label}</p><span className="text-[10px] text-muted-foreground">{selectedIds.length} محددة</span></div>{roles.length ? <div className="space-y-2">{roles.map((role) => <label key={role.id} className="flex items-center gap-3 border border-border/70 px-3 py-2.5 text-xs"><input type="checkbox" checked={selectedIds.includes(role.id)} onChange={(e) => onChange(e.target.checked ? [...selectedIds, role.id] : selectedIds.filter((id) => id !== role.id))} data-testid={`checkbox-${testPrefix}-${role.id}`} className="accent-primary" /><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: role.color || '#ed1c24' }} /><span className="flex-1">{role.name}</span>{role.permissions?.includes('Administrator') && <span className="text-[10px] text-primary">إدارية — لن تُسند</span>}</label>)}</div> : <p className="text-xs text-muted-foreground">لا توجد أدوار مؤهلة للإسناد التلقائي.</p>}</div>;
}

function Preview({ draft, guild }: { draft: DraftSettings; guild: Guild }) {
  return <aside className="sticky top-[96px]"><div className="mb-3 flex items-center justify-between"><p className="flex items-center gap-2 text-xs font-bold"><Eye size={15} className="text-primary" /> معاينة مباشرة</p><span className="font-display text-[10px] text-muted-foreground">١:١</span></div><div className="overflow-hidden border border-[#272523] bg-[#151413] p-4 text-[#f7f3eb] shadow-[0_20px_70px_rgba(20,16,12,.16)]"><div className="flex items-center gap-2 border-b border-white/10 pb-3"><div className="flex h-7 w-7 items-center justify-center bg-[#ed1c24] text-[9px] font-bold">{initials(guild.name)}</div><span className="text-[10px] text-white/55">رسالة ترحيب جديدة</span></div><div className="mt-4 border-r-4 p-4" style={{ borderColor: draft.accentColor || '#ed1c24' }}><p className="text-lg font-bold">{draft.headline || 'عنوان الترحيب'}</p><p className="mt-3 text-xs leading-6 text-white/60">{draft.body || 'اكتب نصًا يعبّر عن مجتمعك.'}</p>{draft.includeInviter && <p className="mt-5 text-[10px] text-white/40">انضم بدعوة من عضو في المجتمع</p>}</div><div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-[10px] text-white/40"><span>الآن</span><span>{draft.style === 'banner' ? 'شريط عريض' : 'رسالة مدمجة'}</span></div></div></aside>;
}

function ServerSettingsPage({ guildId, onBack }: { guildId: string; onBack?: () => void }) {
  const guildQuery = useGetGuild(guildId, { query: { enabled: true, queryKey: getGetGuildQueryKey(guildId) } });
  const welcomeQuery = useGetWelcomeSettings(guildId, { query: { enabled: true, queryKey: getGetWelcomeSettingsQueryKey(guildId) } });
  
  if (guildQuery.isLoading || welcomeQuery.isLoading) return <div>{onBack && <div className="mb-4"><button onClick={onBack} className="inline-flex items-center gap-2 border border-border bg-card px-4 py-2 text-xs font-bold hover:border-primary hover:text-primary"><ChevronRight size={16} /> رجوع</button></div>}<div className="h-[500px] animate-pulse bg-muted" /></div>;
  if (guildQuery.isError || welcomeQuery.isError) return <div>{onBack && <div className="mb-4"><button onClick={onBack} className="inline-flex items-center gap-2 border border-border bg-card px-4 py-2 text-xs font-bold hover:border-primary hover:text-primary"><ChevronRight size={16} /> رجوع</button></div>}<ErrorState onRetry={() => { guildQuery.refetch(); welcomeQuery.refetch(); }} label="تعذر تحميل إعدادات الخادم" /></div>;
  if (!guildQuery.data || !welcomeQuery.data) return <div>{onBack && <div className="mb-4"><button onClick={onBack} className="inline-flex items-center gap-2 border border-border bg-card px-4 py-2 text-xs font-bold hover:border-primary hover:text-primary"><ChevronRight size={16} /> رجوع</button></div>}<EmptyState icon={SlidersHorizontal} title="الإعدادات غير متاحة" detail="لا توجد إعدادات محفوظة لهذا الخادم حتى الآن." /></div>;
  
  const details = guildQuery.data as GuildDetails;
  const settings = welcomeQuery.data;
  const channels = details.channels.filter((ch) => ch.type === "text" || ch.type === "announcement");
  const roles = details.roles.filter((role) => !role.managed);
  
  return <div>{onBack && <div className="mb-4"><button onClick={onBack} data-testid="button-back-to-server" className="inline-flex items-center gap-2 border border-border bg-card px-4 py-2 text-xs font-bold hover:border-primary hover:text-primary transition"><ChevronRight size={16} /> رجوع</button></div>}<PageHeading eyebrow="إعدادات الخادم / ٠٥" title="ضبط غرفة التحكم" description={`إعدادات الترحيب والخادم لـ ${details.name}.`} /><div className="grid gap-7 xl:grid-cols-[1fr_380px]"><div className="space-y-6"><section className="border border-card-border bg-card p-5 md:p-7"><SectionTitle index="٠١" icon={MessageSquareText} title="إعدادات الترحيب" detail="تحكم في رسالة الترحيب وقناتها." /><div className="space-y-5"><Field label="قناة الترحيب" icon={Hash}><select value={settings.channelId ?? ""} disabled className="field bg-muted/50"><option value="">اختر قناة الترحيب</option>{channels.map((ch) => <option value={ch.id} key={ch.id}>#{ch.name}</option>)}</select></Field><Toggle checked={settings.enabled} onChange={() => {}} label="تفعيل الترحيب" detail="يبدأ البوت بإرسال الرسائل عند دخول عضو جديد." testId="toggle-server-settings-enabled" /><Toggle checked={settings.includeInviter} onChange={() => {}} label="إظهار الداعي" detail="أضف مصدر الدعوة إلى رسالة الترحيب عند توفره." testId="toggle-server-settings-inviter" /></div></section><section className="border border-card-border bg-card p-5 md:p-7"><SectionTitle index="٠٢" icon={UserPlus} title="الأدوار التلقائية" detail="الأدوار التي تُمنح تلقائيًا عند الانضمام." /><RolePicker roles={roles} selectedIds={settings.memberAutoRoleIds} onChange={() => {}} testPrefix="server-settings-member-role" label="أدوار الأعضاء" /><div className="mt-4"><RolePicker roles={roles} selectedIds={settings.botAutoRoleIds} onChange={() => {}} testPrefix="server-settings-bot-role" label="أدوار البوتات" /></div></section></div><section className="border border-card-border bg-card p-5 md:p-7"><SectionTitle index="٠٣" icon={Palette} title="تفضيلات المظهر" detail="ألوان وخلفيات بطاقة الترحيب." /><div className="space-y-5"><Field label="لون اللمسة"><div className="flex gap-2"><input type="color" value={settings.accentColor} disabled className="h-11 w-14 cursor-not-allowed border border-input bg-muted/50 p-1" /><input value={settings.accentColor} disabled className="field font-display bg-muted/50 cursor-not-allowed" dir="ltr" /></div></Field><Field label="نمط الرسالة"><div className="grid gap-3 sm:grid-cols-2"><button type="button" disabled className={`border p-4 text-right transition ${settings.style === "embed" ? "border-primary bg-accent/40" : "border-border"}`}><p className="text-sm font-bold">رسالة مدمجة</p><p className="mt-1 text-xs text-muted-foreground">هادئة وواضحة</p></button><button type="button" disabled className={`border p-4 text-right transition ${settings.style === "banner" ? "border-primary bg-accent/40" : "border-border"}`}><p className="text-sm font-bold">شريط عريض</p><p className="mt-1 text-xs text-muted-foreground">يفت الانتباه</p></button></div></Field></div></section></div></div>;
}

function Router() {
  const [, navigate] = useLocation();
  const statusQuery = useGetDiscordStatus({ query: { queryKey: getGetDiscordStatusQueryKey() } });
  const guildQuery = useListGuilds({ query: { queryKey: getListGuildsQueryKey() } });
  const { selectedId, setSelectedId, selectedGuild } = useGuildSelection(guildQuery.data);
  
  return <AppShell selectedGuild={selectedGuild} onSelectGuild={() => navigate("/servers")} status={statusQuery.data}>
    <Switch>
      <Route path="/"><Dashboard status={statusQuery.data} statusError={statusQuery.isError} selectedGuild={selectedGuild} guilds={guildQuery.data} onSelectGuild={() => navigate("/servers")} /></Route>
      <Route path="/servers"><Servers guilds={guildQuery.data} isLoading={guildQuery.isLoading} isError={guildQuery.isError} refetch={() => guildQuery.refetch()} selectedId={selectedId} onSelect={setSelectedId} /></Route>
      <Route path="/server/:guildId">{(params) => <ServerDashboard guildId={params.guildId} onBack={() => navigate("/servers")} />}</Route>
      <Route path="/server/:guildId/welcome">{(params) => <WelcomePage selectedGuild={selectedGuild} selectedId={params.guildId} onBack={() => navigate(`/server/${params.guildId}`)} />}</Route>
      <Route path="/server/:guildId/activity">{(params) => <ActivityPage selectedId={params.guildId} selectedGuild={selectedGuild} onBack={() => navigate(`/server/${params.guildId}`)} />}</Route>
      <Route path="/server/:guildId/settings">{(params) => <ServerSettingsPage guildId={params.guildId} onBack={() => navigate(`/server/${params.guildId}`)} />}</Route>
      <Route path="/settings"><SettingsPage status={statusQuery.data} statusError={statusQuery.isError} /></Route>
      <Route component={NotFound} />
    </Switch>
  </AppShell>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><Router /><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
