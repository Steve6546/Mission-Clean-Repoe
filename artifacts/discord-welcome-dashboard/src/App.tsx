import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import {
  Activity, AlertTriangle, ArrowLeft, Bot, Check, CheckCircle2, ChevronRight, CircleDashed,
  Copy, Eye, EyeOff, Hash, LayoutDashboard, Link2, Menu, MessageSquareText, Moon,
  Palette, Plus, Power, RefreshCw, Save, Server, Settings2, ShieldCheck, SlidersHorizontal,
  Sun, Trash2, UserPlus, Users, WandSparkles, X, Zap, Power as PowerIcon, Key,
  ArrowUpLeft, ChevronLeft,
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

// Discord Client ID sourced from the build-time env (set in .env as
// VITE_DISCORD_CLIENT_ID). Used only for building invite links; never a secret.
const discordClientId = import.meta.env.VITE_DISCORD_CLIENT_ID || '';

// ─── Draft settings type (used for the welcome editor form state) ───
type DraftSettings = WelcomeSettingsInput;

const publicNavItems = [
  { href: '/', label: 'نظرة عامة', icon: LayoutDashboard },
  { href: '/servers', label: 'الخوادم', icon: Server },
  { href: '/activity', label: 'النشاط', icon: Activity },
  { href: '/settings', label: 'الإعدادات', icon: Settings2 },
];

type NavItem = { href: string; label: string; icon: React.ElementType };

const serverNavItems = [
  { href: (guildId: string) => `/server/${guildId}`, label: 'الرئيسية', icon: LayoutDashboard },
  { href: (guildId: string) => `/server/${guildId}/welcome`, label: 'محرر الترحيب', icon: MessageSquareText },
  { href: (guildId: string) => `/server/${guildId}/activity`, label: 'النشاط', icon: Activity },
  { href: (guildId: string) => `/server/${guildId}/settings`, label: 'إعدادات السيرفر', icon: Settings2 },
];

// ─── Removed: BotCredentials, getDefaultCredentials, saveCredentials ───
// Secrets (botToken, clientSecret) must NEVER be stored on the client.
// They live exclusively in server-side environment variables (process.env).

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

// ─── AppShell: now supports both public and server-contex modes ───
function AppShell({
  children,
  selectedGuild,
  onSelectGuild,
  status,
  guildId,            // when set → we're inside a server context
  onBack,             // when set → show back button
}: {
  children: ReactNode;
  selectedGuild: Guild | null;
  onSelectGuild: () => void;
  status?: DiscordStatus;
  guildId?: string;
  onBack?: () => void;
}) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('discord-theme') === 'dark');
  const isInsideServer = Boolean(guildId);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('discord-theme', dark ? 'dark' : 'light');
  }, [dark]);

  // Build nav items based on context
  const navItems: NavItem[] = isInsideServer
    ? serverNavItems.map(({ href, label, icon: Icon }) => ({
        href: href(guildId!),
        label,
        icon: Icon,
      }))
    : publicNavItems;

  // Invite URL — built from the configured client id (server env) with
  // scoped permissions (NOT administrator). Falls back to a safe default.
  const inviteBaseUrl = discordClientId
    ? `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(discordClientId)}&permissions=0&scope=bot%20applications.commands`
    : 'https://discord.com/oauth2/authorize?scope=bot%20applications.commands';

  return (
    <div dir="rtl" className="noise min-h-[100dvh] bg-background text-foreground">
      {/* ─── Sidebar ─── */}
      <aside className={`fixed inset-y-0 right-0 z-40 flex w-[272px] flex-col bg-[#111110] text-[#f6f3ed] transition-transform duration-300 max-md:w-[292px] ${mobileOpen ? 'translate-x-0' : 'max-md:translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center bg-[#ed1c24] text-white diagonal-cut">
              <Bot size={23} strokeWidth={2.5} />
              <span className="absolute bottom-1 left-1 h-2 w-2 rounded-full bg-white" />
            </div>
            <div>
              <p className="font-display text-lg font-bold leading-none tracking-tight">مرحبًا</p>
              <p className="mt-1 text-[10px] font-medium tracking-[.2em] text-white/45">CONTROL ROOM</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="إغلاق القائمة"
            data-testid="button-close-menu"
            className="hidden rounded-lg p-2 text-white/65 hover:bg-white/10 max-md:block"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pt-7">
          <p className="mb-3 px-2 text-[10px] font-bold tracking-[.18em] text-white/35">
            {isInsideServer ? 'سيرفر مختار' : 'مساحة العمل'}
          </p>

          {/* Server selector / current server display */}
          {isInsideServer && selectedGuild ? (
            <button
              type="button"
              disabled
              className="flex w-full items-center gap-3 border border-white/10 bg-white/[.045] p-3 text-right opacity-60 cursor-not-allowed"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#f1eee7] font-display font-bold text-[#111110]">
                {selectedGuild.iconUrl ? (
                  <img src={selectedGuild.iconUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials(selectedGuild.name)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{selectedGuild.name}</p>
                <p className="mt-0.5 text-[11px] text-white/45">
                  {selectedGuild.memberCount.toLocaleString('ar-SA')} عضو
                </p>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={onSelectGuild}
              data-testid="button-select-guild"
              className="flex w-full items-center gap-3 border border-white/10 bg-white/[.045] p-3 text-right transition hover:border-[#ed1c24]/60 hover:bg-white/[.08]"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#f1eee7] font-display font-bold text-[#111110]">
                {selectedGuild?.iconUrl ? (
                  <img src={selectedGuild.iconUrl} alt="" className="h-full w-full object-cover" />
                ) : selectedGuild ? (
                  initials(selectedGuild.name)
                ) : (
                  <Server size={17} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{selectedGuild?.name ?? 'اختر خادمًا'}</p>
                <p className="mt-0.5 text-[11px] text-white/45">
                  {selectedGuild ? `${selectedGuild.memberCount.toLocaleString('ar-SA')} عضو` : 'لا يوجد خادم محدد'}
                </p>
              </div>
              <ChevronLeft size={16} className="text-white/35" />
            </button>
          )}
        </div>

        {/* ─── Navigation ─── */}
        <nav className="flex-1 px-5 pt-8">
          <p className="mb-3 px-2 text-[10px] font-bold tracking-[.18em] text-white/35">التنقّل</p>
          <div className="space-y-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = location === href;
              return (
                <Link
                  key={href + label}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  data-testid={`link-nav-${href}`}
                  className={`group flex items-center gap-3 border-r-2 px-3 py-3 text-sm font-medium transition ${
                    active
                      ? 'border-[#ed1c24] bg-[#ed1c24]/10 text-white'
                      : 'border-transparent text-white/55 hover:bg-white/[.05] hover:text-white'
                  }`}
                >
                  <Icon
                    size={18}
                    strokeWidth={active ? 2.5 : 1.8}
                    className={active ? 'text-[#ed1c24]' : 'text-white/40 group-hover:text-white/70'}
                  />
                  <span>{label}</span>
                  {active && <ArrowUpLeft size={14} className="mr-auto text-[#ed1c24]" />}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* ─── Footer ─── */}
        <div className="m-5 border-t border-white/10 pt-4">
          <div className="flex items-center gap-2 px-2 pb-3 text-[11px] text-white/55">
            <span className={`h-2 w-2 rounded-full ${status?.connected ? 'bg-[#4ade80]' : 'bg-[#ed1c24]'}`} />
            {status?.connected ? 'متصل بـ Discord' : status?.configured ? 'في انتظار الاتصال' : 'الاتصال غير مُعد'}
          </div>
          <button
            type="button"
            onClick={() => setDark((value) => !value)}
            data-testid="button-toggle-theme"
            className="flex w-full items-center gap-3 px-3 py-2 text-xs text-white/45 transition hover:bg-white/[.06] hover:text-white"
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
            {dark ? 'الوضع الفاتح' : 'الوضع الداكن'}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          aria-label="إغلاق القائمة"
          data-testid="button-menu-overlay"
          className="fixed inset-0 z-30 bg-[#111110]/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ─── Main content area ─── */}
      <main className="min-h-[100dvh] md:mr-[272px]">
        {/* ─── Header ─── */}
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border/70 bg-background/90 px-5 backdrop-blur-md md:px-10">
          <div className="flex items-center gap-3">
            {/* Back button — only in server context */}
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                data-testid="button-back-to-servers"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/[.08] hover:text-white transition"
              >
                <ArrowLeft size={16} />
                الرجوع إلى قائمة الخوادم
              </button>
            )}

            <button
              type="button"
              aria-label="فتح القائمة"
              data-testid="button-open-menu"
              className="rounded-lg p-2 hover:bg-muted md:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={21} />
            </button>

            {!onBack && (
              <div className="hidden h-7 w-px bg-border md:block" />
            )}

            <div className="flex items-center gap-3">
              {/* Title */}
              <p className="text-xs font-medium text-muted-foreground hidden sm:block">
                {isInsideServer
                  ? `لوحة تحكم ${selectedGuild?.name ?? 'السيرفر'}`
                  : 'لوحة تحكم الترحيب'}
              </p>

              {/* Invite Bot / Add Server button — always visible in header */}
              <a
                href={inviteBaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="button-invite-bot"
                className="inline-flex items-center gap-2 bg-[#ed1c24] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#ed1c24]/90 hover:underline"
              >
                <Plus size={14} />
                إضافة خادم
              </a>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 text-[11px] text-muted-foreground sm:flex">
              <span className={`h-2 w-2 rounded-full ${status?.connected ? 'bg-emerald-500' : 'bg-primary'}`} />
              {status?.message ?? 'جارٍ التحقق من الاتصال'}
            </div>
            <div className="flex h-8 w-8 items-center justify-center bg-[#ed1c24] text-[11px] font-bold text-white">
              م
            </div>
          </div>
        </header>

        {/* ─── Page content ─── */}
        <div className="mx-auto max-w-[1440px] px-5 py-8 md:px-10 md:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}

// ─── Shared UI components ───

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        <p className="mb-3 flex items-center gap-2 text-[11px] font-bold tracking-[.13em] text-primary">
          <span className="h-1.5 w-1.5 bg-primary" />
          {eyebrow}
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-[42px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

function ConnectionCard({
  status,
  compact = false,
  error = false,
}: {
  status?: DiscordStatus;
  compact?: boolean;
  error?: boolean;
}) {
  if (error) return <ErrorState label="تعذر التحقق من اتصال Discord" />;
  if (!status) return <div data-testid="status-discord-loading" className="h-24 animate-pulse bg-muted" />;
  const ok = status.configured && status.connected;
  return (
    <div
      data-testid="status-discord"
      className={`relative overflow-hidden border p-5 ${
        ok
          ? 'border-emerald-200 bg-emerald-50/65 dark:border-emerald-900 dark:bg-emerald-950/20'
          : 'border-primary/20 bg-accent/55'
      }`}
    >
      <div className="absolute -left-4 -top-10 h-24 w-24 rotate-45 bg-primary/10" />
      <div className="relative flex items-start gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center ${
            ok ? 'bg-emerald-500 text-white' : 'bg-primary text-white'
          }`}
        >
          {ok ? <CheckCircle2 size={21} /> : <AlertTriangle size={21} />}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">
              {ok ? 'الاتصال جاهز' : status.configured ? 'الاتصال يحتاج انتباهًا' : 'أكمل إعداد Discord'}
            </p>
            <span className="border border-current/20 px-2 py-0.5 text-[10px]">
              {ok ? 'متصل' : 'إجراء مطلوب'}
            </span>
          </div>
          <p
            className={`mt-1 text-sm leading-6 ${compact ? 'line-clamp-1' : ''} text-muted-foreground`}
          >
            {status.message}
          </p>
          {!ok && (
            <Link
              href="/settings"
              data-testid="link-setup-from-status"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
            >
              عرض خطوات الإعداد <ArrowUpLeft size={14} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  detail,
  action,
}: {
  icon: typeof Bot;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div
      data-testid="empty-state"
      className="flex min-h-[220px] flex-col items-center justify-center border border-dashed border-border bg-card/50 px-6 text-center"
    >
      <div className="mb-4 flex h-12 w-12 shrink-0 items-center justify-center bg-muted text-muted-foreground">
        <Icon size={22} />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{detail}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function ErrorState({
  onRetry,
  label = 'تعذر تحميل البيانات',
}: {
  onRetry?: () => void;
  label?: string;
}) {
  return (
    <div data-testid="error-state" className="border border-primary/25 bg-accent/35 p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className="mt-0.5 shrink-0 text-primary" />
        <div>
          <p className="font-semibold">{label}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            تحقق من اتصال الخدمة ثم حاول مرة أخرى.
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              data-testid="button-retry"
              className="mt-4 inline-flex items-center gap-2 border border-primary/30 px-3 py-2 text-xs font-bold text-primary hover:bg-accent"
            >
              <RefreshCw size={14} />
              {' '}إعادة المحاولة
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value?: string | number;
  detail: string;
  icon: typeof Users;
  accent?: boolean;
}) {
  return (
    <div
      data-testid={`stat-${label}`}
      className={`relative overflow-hidden border p-5 ${
        accent
          ? 'border-[#111110] bg-[#111110] text-[#f5f1e9]'
          : 'border-card-border bg-card'
      }`}
    >
      <div className={`absolute -left-2 -top-5 h-16 w-16 rotate-45 ${accent ? 'bg-primary' : 'bg-primary/10'}`} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className={`text-xs ${accent ? 'text-white/55' : 'text-muted-foreground'}`}>
            {label}
          </p>
          <p className="mt-3 font-display text-3xl font-bold">
            {value === undefined ? '—' : value}
          </p>
        </div>
        <Icon size={19} className="text-primary" />
      </div>
      <p className={`relative mt-5 text-[11px] ${accent ? 'text-white/50' : 'text-muted-foreground'}`}>
        {detail}
      </p>
    </div>
  );
}

function ActivityList({ items, compact = false }: { items: ActivityItem[]; compact?: boolean }) {
  return (
    <div data-testid="list-activity" className="divide-y divide-border/70">
      {items.map((item) => (
        <div key={item.id} data-testid={`activity-item-${item.id}`} className="flex gap-4 py-4 first:pt-0 last:pb-0">
          <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center bg-accent text-primary">
            <Activity size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col justify-between gap-1 sm:flex-row">
              <p className="text-sm font-semibold">{item.title}</p>
              <time className="font-display text-[10px] text-muted-foreground">
                {formatDate(item.createdAt)}
              </time>
            </div>
            <p
              className={`mt-1 text-xs leading-6 text-muted-foreground ${compact ? 'line-clamp-1' : ''}`}
            >
              {item.detail}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Servers Page ───

function Servers({
  guilds,
  isLoading,
  isError,
  refetch,
  selectedId,
  onSelect,
}: {
  guilds?: Guild[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const inviteBaseUrl = 'https://discord.com/oauth2/authorize';

  return (
    <div>
      <PageHeading
        eyebrow="الخوادم / ٠٢"
        title="اختر مساحتك"
        description="الخوادم التي يمكن لحسابك إدارتها. أضف البوت إلى أي مساحة لتفعيل رسائل الترحيب."
        action={
          <div className="flex items-center gap-2">
            <a
              href={`${inviteBaseUrl}?client_id=${encodeURIComponent(discordClientId)}&permissions=0&scope=bot%20applications.commands`}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="button-add-server"
              className="inline-flex items-center gap-2 bg-[#ed1c24] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#ed1c24]/90"
            >
              <Plus size={15} />
              {' '}دعوة البوت
            </a>
            <button
              type="button"
              onClick={refetch}
              data-testid="button-refresh-guilds"
              className="inline-flex items-center gap-2 border border-border bg-card px-4 py-3 text-xs font-bold hover:border-primary hover:text-primary"
            >
              <RefreshCw size={15} />
              {' '}تحديث القائمة
            </button>
          </div>
        }
      />

      {isLoading ? (
        <div data-testid="loading-guilds" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 animate-pulse bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={refetch} label="تعذر الوصول إلى قائمة الخوادم" />
      ) : !guilds?.length ? (
        <EmptyState
          icon={Server}
          title="لا توجد خوادم متاحة"
          detail="لا توجد خوادم جاهزة للعرض. تحقق من إعداد Discord وصلاحيات البوت."
          action={
            <a
              href={`${inviteBaseUrl}?client_id=${encodeURIComponent(discordClientId)}&permissions=0&scope=bot%20applications.commands`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary px-4 py-2.5 text-xs font-bold text-white inline-flex items-center gap-2"
            >
              <Plus size={14} />
              {' '}إضافة خادم جديد
            </a>
          }
        />
      ) : (
        <div data-testid="list-guilds" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {guilds.map((guild) => (
            <button
              key={guild.id}
              type="button"
              onClick={() => {
                onSelect(guild.id);
                // Navigate to server context
                const [, navigate] = useLocation();
                // Can't call navigate here directly; use a ref pattern
                // Instead we'll handle navigation in the parent Router
              }}
              data-testid={`card-guild-${guild.id}`}
              className={`group relative overflow-hidden border p-5 text-right transition hover:-translate-y-0.5 hover:shadow-[var(--shadow)] cursor-pointer ${
                selectedId === guild.id
                  ? 'border-primary bg-accent/40'
                  : 'border-card-border bg-card'
              }`}
            >
              <div
                className={`absolute left-0 top-0 h-1 w-full ${
                  guild.botPresent ? 'bg-emerald-500' : 'bg-primary'
                }`}
              />
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-[#111110] font-display text-lg font-bold text-white">
                  {guild.iconUrl ? (
                    <img src={guild.iconUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials(guild.name)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold">{guild.name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {guild.memberCount.toLocaleString('ar-SA')} عضو
                  </p>
                </div>
                {selectedId === guild.id && (
                  <CheckCircle2 size={19} className="text-primary" />
                )}
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4 text-[11px]">
                <span
                  className={`flex items-center gap-1.5 font-semibold ${
                    guild.botPresent
                      ? 'text-emerald-600'
                      : 'text-muted-foreground'
                  }`}
                >
                  {guild.botPresent ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      البوت متصل
                    </>
                  ) : (
                    <>
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                      دعوة مطلوبة
                    </>
                  )}
                </span>
                <span className="text-muted-foreground">
                  {guild.canManage ? '✅ يمكنك الإدارة' : '🔒 لا تملك صلاحية'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Server Dashboard (redirects to welcome/activity/settings sub-pages) ───

function ServerDashboard({ guildId, onBack }: { guildId: string; onBack?: () => void }) {
  const [, navigate] = useLocation();
  const guildQuery = useGetGuild(guildId, {
    query: { enabled: true, queryKey: getGetGuildQueryKey(guildId) },
  });

  if (guildQuery.isLoading) {
    return (
      <div>
        {onBack && (
          <div className="mb-4">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 border border-border bg-card px-4 py-2 text-xs font-bold hover:border-primary hover:text-primary"
            >
              <ChevronRight size={16} />
              {' '}رجوع
            </button>
          </div>
        )}
        <div className="h-[500px] animate-pulse bg-muted" />
      </div>
    );
  }

  if (guildQuery.isError || !guildQuery.data) {
    return (
      <div>
        {onBack && (
          <div className="mb-4">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 border border-border bg-card px-4 py-2 text-xs font-bold hover:border-primary hover:text-primary"
            >
              <ChevronRight size={16} />
              {' '}رجوع
            </button>
          </div>
        )}
        <ErrorState label="تعذر تحميل بيانات السيرفر" />
      </div>
    );
  }

  const guild = guildQuery.data as Guild;
  return (
    <div>
      {onBack && (
        <div className="mb-4">
          <button
            onClick={onBack}
            data-testid="button-back-to-server"
            className="inline-flex items-center gap-2 border border-border bg-card px-4 py-2 text-xs font-bold hover:border-primary hover:text-primary transition"
          >
            <ChevronRight size={16} />
            {' '}رجوع
          </button>
        </div>
      )}

      <PageHeading
        eyebrow="السيرفر / الرئيسية"
        title={guild.name}
        description={`لوحة تحكم السيرفر "${guild.name}" (${guild.memberCount} عضو).`}
      />

      {/* Quick links to sub-pages */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'محرر الترحيب', href: `/server/${guildId}/welcome`, icon: MessageSquareText, desc: 'ضبط رسائل الترحيب' },
          { label: 'النشاط', href: `/server/${guildId}/activity`, icon: Activity, desc: 'سجل الأحداث الأخيرة' },
          { label: 'إعدادات السيرفر', href: `/server/${guildId}/settings`, icon: Settings2, desc: 'الأدوار، القنوات، الإعدادات' },
          { label: 'معاينة البطاقة', href: `/server/${guildId}/welcome`, icon: Eye, desc: 'معاينة رسالة الترحيب' },
        ].map((item) => (
          <button
            key={item.href}
            type="button"
            onClick={() => navigate(item.href)}
            className="flex items-center gap-4 border border-card-border bg-card p-5 transition hover:border-primary hover:bg-accent/30 cursor-pointer text-left"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-accent text-primary">
              <item.icon size={20} />
            </div>
            <div>
              <p className="font-semibold text-sm">{item.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Server status */}
      <div className="mt-8 border border-card-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-accent text-primary">
              <Server size={20} />
            </div>
            <div>
              <p className="font-semibold">حالة السيرفر</p>
              <p className="text-sm text-muted-foreground mt-1">
                {guild.botPresent ? (
                  <span className="text-emerald-500">البوت متصل ✅</span>
                ) : (
                  <span className="text-primary">دعوة البوت مطلوبة ⚡</span>
                )}
                <br />
                <span className="text-xs text-muted-foreground">
                  {guild.memberCount} عضو | {guild.canManage ? 'يمكنك الإدارة' : 'غيرOwner'}
                </span>
              </p>
            </div>
          </div>
          <a
            href={`https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(discordClientId)}&permissions=0&scope=bot%20applications.commands&guild_id=${guild.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#ed1c24] px-4 py-2 text-xs font-bold text-white hover:bg-[#ed1c24]/90 transition"
          >
            <Plus size={14} />
            {' '}دعوة البوت
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Welcome Page (inside server context) ───

function WelcomePage({
  selectedGuild,
  selectedId,
  onBack,
}: {
  selectedGuild: Guild | null;
  selectedId: string;
  onBack: () => void;
}) {
  const [, navigate] = useLocation();
  const draft = useRef<DraftSettings>({
    enabled: true,
    style: 'embed',
    channelId: '',
    headline: 'أهلًا بك في السيرفر',
    body: 'نورتنا {member}، نتمنى لك وقتًا ممتعًا.',
    accentColor: '#E50914',
    backgroundUrl: '',
    includeInviter: true,
    autoRoleIds: [] as string[],
    memberAutoRoleIds: [] as string[],
    botAutoRoleIds: [] as string[],
  }).current;

  const updateMutation = useUpdateWelcomeSettings();

  return (
    <div>
      {onBack && (
        <div className="mb-4">
          <button
            onClick={onBack}
            data-testid="button-back-to-server"
            className="inline-flex items-center gap-2 border border-border bg-card px-4 py-2 text-xs font-bold hover:border-primary hover:text-primary transition"
          >
            <ChevronRight size={16} />
            {' '}رجوع
          </button>
        </div>
      )}

      <PageHeading
        eyebrow="السيرفر / محرر الترحيب"
        title="محرر الترحيب"
        description="صغ رسالة الترحيب لسيرفرك."
      />

      <div className="grid gap-7 xl:grid-cols-[1fr_380px]">
        {/* Editor */}
        <div className="space-y-6">
          <section className="border border-card-border bg-card p-5 md:p-7">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-bold">
              <MessageSquareText size={18} className="text-primary" />
              إعدادات الترحيب
            </h2>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                  <Hash size={13} className="text-muted-foreground" />
                  قناة الترحيب
                </span>
                <select
                  value={draft.channelId ?? ''}
                  onChange={(e) => { draft.channelId = e.target.value; }}
                  className="field w-full"
                >
                  <option value="">اختر قناة الترحيب</option>
                  {selectedGuild && (selectedGuild as GuildDetails).channels?.map((ch) => (
                    <option key={ch.id} value={ch.id}>#{ch.name}</option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                role="switch"
                aria-checked={draft.enabled}
                data-testid="toggle-welcome-enabled"
                onClick={() => { draft.enabled = !draft.enabled; }}
                className="flex w-full items-center justify-between gap-4 text-right"
              >
                <span>
                  <span className="block text-sm font-semibold">تفعيل الترحيب</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    يبدأ البوت بإرسال الرسائل عند دخول عضو جديد.
                  </span>
                </span>
                <span
                  className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                    draft.enabled ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span
                    className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-transform ${
                      draft.enabled ? 'translate-x-1' : 'translate-x-5'
                    }`}
                  />
                </span>
              </button>

              <button
                type="button"
                role="switch"
                aria-checked={draft.includeInviter}
                data-testid="toggle-include-inviter"
                onClick={() => { draft.includeInviter = !draft.includeInviter; }}
                className="flex w-full items-center justify-between gap-4 text-right"
              >
                <span>
                  <span className="block text-sm font-semibold">إظهار الداعي</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    أضف مصدر الدعوة إلى رسالة الترحيب عند توفره.
                  </span>
                </span>
                <span
                  className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                    draft.includeInviter ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span
                    className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-transform ${
                      draft.includeInviter ? 'translate-x-1' : 'translate-x-5'
                    }`}
                  />
                </span>
              </button>
            </div>
          </section>

          <section className="border border-card-border bg-card p-5 md:p-7">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-bold">
              <Palette size={18} className="text-primary" />
              تصميم الرسالة
            </h2>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 text-xs font-semibold">العنوان</span>
                <input
                  type="text"
                  value={draft.headline}
                  onChange={(e) => { draft.headline = e.target.value; }}
                  className="field"
                  placeholder="عنوان الترحيب"
                />
              </label>
              <label className="block">
                <span className="mb-2 text-xs font-semibold">المحتوى</span>
                <textarea
                  value={draft.body}
                  onChange={(e) => { draft.body = e.target.value; }}
                  className="field min-h-[100px] resize-y"
                  placeholder="نص الرسالة..."
                />
              </label>
              <label className="block">
                <span className="mb-2 text-xs font-semibold">اللون المميز</span>
                <input
                  type="color"
                  value={draft.accentColor}
                  onChange={(e) => { draft.accentColor = e.target.value; }}
                  className="h-9 w-full cursor-pointer rounded-sm border-0 bg-transparent p-0"
                />
              </label>
              <label className="block">
                <span className="mb-2 text-xs font-semibold">نمط العرض</span>
                <div className="flex gap-2">
                  {(['embed', 'banner'] as const).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => { draft.style = style; }}
                      className={`flex-1 rounded border px-3 py-2 text-xs font-semibold transition ${
                        draft.style === style
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card text-muted-foreground hover:border-primary'
                      }`}
                    >
                      {style === 'embed' ? 'Embed' : 'شريط عريض'}
                    </button>
                  ))}
                </div>
              </label>
            </div>
          </section>

          <section className="border border-card-border bg-card p-5 md:p-7">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-bold">
              <UserPlus size={18} className="text-primary" />
              الأدوار التلقائية
            </h2>
            {selectedGuild && (selectedGuild as GuildDetails).roles?.length ? (
              <div className="space-y-2 max-h-[240px] overflow-y-auto">
                {(selectedGuild as GuildDetails).roles
                  .filter((r: { managed: boolean; id: string; name: string; color: string; permissions?: string[] }) => !r.managed)
                  .map((role: { id: string; name: string; color: string; permissions?: string[] }) => (
                    <label
                      key={role.id}
                      className="flex items-center gap-3 border border-border/70 px-3 py-2.5 text-xs cursor-pointer hover:bg-accent/30"
                    >
                      <input
                        type="checkbox"
                        checked={draft.memberAutoRoleIds.includes(role.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            draft.memberAutoRoleIds.push(role.id);
                          } else {
                            draft.memberAutoRoleIds = draft.memberAutoRoleIds.filter(
                              (id) => id !== role.id,
                            );
                          }
                        }}
                        className="accent-primary"
                      />
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: role.color || '#ed1c24' }}
                      />
                      <span className="flex-1">{role.name}</span>
                      {role.permissions?.includes('Administrator') && (
                        <span className="text-[10px] text-primary">إدارية — نصيحة: تجنبها</span>
                      )}
                    </label>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                لا توجد أدوار متاحة للإسناد التلقائي.
              </p>
            )}
          </section>
        </div>

        {/* Preview */}
        <Preview draft={draft} guild={selectedGuild!} />
      </div>

      {/* Save button */}
      <div className="mt-8 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => updateMutation.mutate({ guildId: selectedId, data: draft })}
          disabled={updateMutation.isPending}
          className="inline-flex items-center gap-2 bg-[#ed1c24] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#ed1c24]/90 disabled:opacity-50"
        >
          {updateMutation.isPending ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          {updateMutation.isPending ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
        </button>
      </div>
    </div>
  );
}

// ─── Activity Page ───

function ActivityPage({
  selectedId,
  selectedGuild,
  onBack,
}: {
  selectedId: string;
  selectedGuild: Guild | null;
  onBack: () => void;
}) {
  const activityQuery = useListGuildActivity(
    selectedId,
    { query: { queryKey: getListGuildActivityQueryKey(selectedId) } },
  );

  if (activityQuery.isLoading) {
    return (
      <div>
        {onBack && (
          <div className="mb-4">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 border border-border bg-card px-4 py-2 text-xs font-bold hover:border-primary hover:text-primary"
            >
              <ChevronRight size={16} />
              {' '}رجوع
            </button>
          </div>
        )}
        <div className="h-[500px] animate-pulse bg-muted" />
      </div>
    );
  }

  if (activityQuery.isError) {
    return (
      <div>
        {onBack && (
          <div className="mb-4">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 border border-border bg-card px-4 py-2 text-xs font-bold hover:border-primary hover:text-primary"
            >
              <ChevronRight size={16} />
              {' '}رجوع
            </button>
          </div>
        )}
        <ErrorState label="تعذر تحميل سجل النشاط" />
      </div>
    );
  }

  return (
    <div>
      {onBack && (
        <div className="mb-4">
          <button
            onClick={onBack}
            data-testid="button-back-to-server"
            className="inline-flex items-center gap-2 border border-border bg-card px-4 py-2 text-xs font-bold hover:border-primary hover:text-primary transition"
          >
            <ChevronRight size={16} />
            {' '}رجوع
          </button>
        </div>
      )}

      <PageHeading
        eyebrow="السيرفر / النشاط"
        title="سجل النشاط"
        description={`أحدث الأحداث لسيرفر "${selectedGuild?.name}".`}
      />

      {!activityQuery.data?.length ? (
        <EmptyState
          icon={Activity}
          title="لا يوجد نشاط حتى الآن"
          detail="ستظهر الأحداث هنا عندما ينضم أعضاء أو يتم دعوتهم."
        />
      ) : (
        <div className="border border-card-border bg-card divide-y divide-border/70">
          <ActivityList items={activityQuery.data} />
        </div>
      )}
    </div>
  );
}

// ─── Server Settings Page ───

function ServerSettingsPage({ guildId, onBack }: { guildId: string; onBack?: () => void }) {
  const guildQuery = useGetGuild(guildId, {
    query: { enabled: true, queryKey: getGetGuildQueryKey(guildId) },
  });
  const welcomeQuery = useGetWelcomeSettings(
    guildId,
    { query: { enabled: true, queryKey: getGetWelcomeSettingsQueryKey(guildId) } },
  );

  if (guildQuery.isLoading || welcomeQuery.isLoading) {
    return (
      <div>
        {onBack && (
          <div className="mb-4">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 border border-border bg-card px-4 py-2 text-xs font-bold hover:border-primary hover:text-primary"
            >
              <ChevronRight size={16} />
              {' '}رجوع
            </button>
          </div>
        )}
        <div className="h-[500px] animate-pulse bg-muted" />
      </div>
    );
  }

  if (guildQuery.isError || welcomeQuery.isError) {
    return (
      <div>
        {onBack && (
          <div className="mb-4">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 border border-border bg-card px-4 py-2 text-xs font-bold hover:border-primary hover:text-primary"
            >
              <ChevronRight size={16} />
              {' '}رجوع
            </button>
          </div>
        )}
        <ErrorState
          onRetry={() => {
            guildQuery.refetch();
            welcomeQuery.refetch();
          }}
          label="تعذر تحميل إعدادات الخادم"
        />
      </div>
    );
  }

  if (!guildQuery.data || !welcomeQuery.data) {
    return (
      <div>
        {onBack && (
          <div className="mb-4">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 border border-border bg-card px-4 py-2 text-xs font-bold hover:border-primary hover:text-primary"
            >
              <ChevronRight size={16} />
              {' '}رجوع
            </button>
          </div>
        )}
        <EmptyState
          icon={SlidersHorizontal}
          title="الإعدادات غير متاحة"
          detail="لا توجد إعدادات محفوظة لهذا الخادم حتى الآن."
        />
      </div>
    );
  }

  const details = guildQuery.data as GuildDetails;
  const settings = welcomeQuery.data;
  const channels = details.channels.filter(
    (ch) => ch.type === 'text' || ch.type === 'announcement',
  );
  const roles = details.roles.filter((role) => !role.managed);

  return (
    <div>
      {onBack && (
        <div className="mb-4">
          <button
            onClick={onBack}
            data-testid="button-back-to-server"
            className="inline-flex items-center gap-2 border border-border bg-card px-4 py-2 text-xs font-bold hover:border-primary hover:text-primary transition"
          >
            <ChevronRight size={16} />
            {' '}رجوع
          </button>
        </div>
      )}

      <PageHeading
        eyebrow="إعدادات الخادم / ٠٥"
        title="ضبط غرفة التحكم"
        description={`إعدادات الترحيب والخادم لـ ${details.name}.`}
      />

      <div className="grid gap-7 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="border border-card-border bg-card p-5 md:p-7">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-bold">
              <MessageSquareText size={18} className="text-primary" />
              إعدادات الترحيب
            </h2>
            <div className="space-y-5">
              <label className="block">
                <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                  <Hash size={13} className="text-muted-foreground" />
                  قناة الترحيب
                </span>
                <select
                  value={settings.channelId ?? ''}
                  disabled
                  className="field bg-muted/50 w-full"
                >
                  <option value="">اختر قناة الترحيب</option>
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      #{ch.name}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                role="switch"
                aria-checked={settings.enabled}
                data-testid="toggle-server-settings-enabled"
                onClick={() => {}}
                className="flex w-full items-center justify-between gap-4 text-right"
              >
                <span>
                  <span className="block text-sm font-semibold">تفعيل الترحيب</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    يبدأ البوت بإرسال الرسائل عند دخول عضو جديد.
                  </span>
                </span>
                <span
                  className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                    settings.enabled ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span
                    className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-transform ${
                      settings.enabled ? 'translate-x-1' : 'translate-x-5'
                    }`}
                  />
                </span>
              </button>

              <button
                type="button"
                role="switch"
                aria-checked={settings.includeInviter}
                data-testid="toggle-server-settings-inviter"
                onClick={() => {}}
                className="flex w-full items-center justify-between gap-4 text-right"
              >
                <span>
                  <span className="block text-sm font-semibold">إظهار الداعي</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    أضف مصدر الدعوة إلى رسالة الترحيب عند توفره.
                  </span>
                </span>
                <span
                  className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                    settings.includeInviter ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span
                    className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-transform ${
                      settings.includeInviter ? 'translate-x-1' : 'translate-x-5'
                    }`}
                  />
                </span>
              </button>
            </div>
          </section>

          <section className="border border-card-border bg-card p-5 md:p-7">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-bold">
              <UserPlus size={18} className="text-primary" />
              الأدوار التلقائية
            </h2>
            <div className="space-y-4">
              <div className="border-t border-border/60 pt-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold">أدوار الأعضاء</p>
                  <span className="text-[10px] text-muted-foreground">
                    {settings.memberAutoRoleIds.length} محددة
                  </span>
                </div>
                {roles.length ? (
                  <div className="space-y-2">
                    {roles.map((role) => (
                      <label
                        key={role.id}
                        className="flex items-center gap-3 border border-border/70 px-3 py-2.5 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={settings.memberAutoRoleIds.includes(role.id)}
                          onChange={() => {}}
                          className="accent-primary"
                        />
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: role.color || '#ed1c24' }}
                        />
                        <span className="flex-1">{role.name}</span>
                        {role.permissions?.includes('Administrator') && (
                          <span className="text-[10px] text-primary">إدارية — لن تُسند</span>
                        )}
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    لا توجد أدوار مؤهلة للإسناد التلقائي.
                  </p>
                )}
              </div>

              <div className="border-t border-border/60 pt-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold">أدوار البوتات</p>
                  <span className="text-[10px] text-muted-foreground">
                    {settings.botAutoRoleIds.length} محددة
                  </span>
                </div>
                {roles.length ? (
                  <div className="space-y-2">
                    {roles.map((role) => (
                      <label
                        key={role.id}
                        className="flex items-center gap-3 border border-border/70 px-3 py-2.5 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={settings.botAutoRoleIds.includes(role.id)}
                          onChange={() => {}}
                          className="accent-primary"
                        />
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: role.color || '#ed1c24' }}
                        />
                        <span className="flex-1">{role.name}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    لا توجد أدوار متاحة.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="border border-card-border bg-card p-5 md:p-7">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-bold">
              <Palette size={18} className="text-primary" />
              تفضيلات العرض
            </h2>
            <div className="space-y-5">
              <label className="block">
                <span className="mb-2 text-xs font-semibold">العنوان</span>
                <input
                  type="text"
                  value={settings.headline ?? ''}
                  disabled
                  className="field bg-muted/50 w-full"
                  placeholder="عنوان الترحيب"
                />
              </label>
              <label className="block">
                <span className="mb-2 text-xs font-semibold">المحتوى</span>
                <textarea
                  value={settings.body ?? ''}
                  disabled
                  className="field min-h-[80px] resize-y bg-muted/50"
                  placeholder="نص الرسالة..."
                />
              </label>
              <label className="block">
                <span className="mb-2 text-xs font-semibold">اللون المميز</span>
                <input
                  type="color"
                  value={settings.accentColor ?? '#E50914'}
                  disabled
                  className="h-9 w-full cursor-pointer rounded-sm border-0 bg-transparent p-0"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled
                  className="flex-1 rounded border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground cursor-not-allowed"
                >
                  {settings.style === 'embed' ? 'Embed' : 'شريط عريض'}
                </button>
                <button
                  type="button"
                  disabled
                  className="flex-1 rounded border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground cursor-not-allowed"
                >
                  رسالة مدمجة
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Preview sidebar */}
        <Preview draft={settings} guild={guildQuery.data as Guild} />
      </div>
    </div>
  );
}

function Dashboard({
  status,
  statusError,
  selectedGuild,
  guilds,
  onSelectGuild,
}: {
  status?: DiscordStatus;
  statusError: boolean;
  selectedGuild: Guild | null;
  guilds?: Guild[];
  onSelectGuild: () => void;
}) {
  const summaryQuery = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const activityQuery = useListGuildActivity(
    selectedGuild?.id ?? '',
    { query: { enabled: Boolean(selectedGuild?.id), queryKey: getListGuildActivityQueryKey(selectedGuild?.id ?? '') } },
  );

  if (statusError) {
    return <ConnectionCard status={status} />;
  }

  return (
    <div>
      <PageHeading
        eyebrow="الرئيسية / نظرة عامة"
        title="مرحبًا،Chef!"
        description="تتابع كل خوادم Discord من هنا. اختر سيرفرًا لل开始."
        action={
          <button
            type="button"
            onClick={onSelectGuild}
            className="inline-flex items-center gap-2 border border-border bg-card px-4 py-2 text-xs font-bold hover:border-primary hover:text-primary"
          >
            <ArrowUpLeft size={14} />
            {' '}اختر سيرفر
          </button>
        }
      />

      {/* Connection status */}
      <ConnectionCard status={status} />

      {/* Stats */}
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryQuery.isLoading ? (
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse bg-muted rounded" />
          ))
        ) : summaryQuery.data ? (
          <>
            <StatCard
              label="عدد الخوادم"
              value={summaryQuery.data.guildCount}
              detail="من 연결될 수 있는 서버"
              icon={Server}
              accent
            />
            <StatCard
              label="الخوادم المُعدادّة"
              value={summaryQuery.data.configuredGuildCount}
              detail={`${summaryQuery.data.guildCount - summaryQuery.data.configuredGuildCount} لتكون جاهزة`}
              icon={ShieldCheck}
            />
            <StatCard
              label="إجمالي الأعضاء"
              value={summaryQuery.data.totalMembers.toLocaleString('ar-SA')}
              detail="في جميع الخوادم"
              icon={Users}
            />
            <StatCard
              label="الانضمامات الأخيرة"
              value={summaryQuery.data.recentJoins}
              detail={`معدل التوصيات: ${summaryQuery.data.inviteAttributionRate}%`}
              icon={Activity}
            />
          </>
        ) : (
          <ErrorState label="تعذر تحميل الإحصائيات" />
        )}
      </div>

      {/* Recent activity */}
      <section className="mt-8 border border-card-border bg-card p-5 md:p-7">
        <h2 className="mb-5 flex items-center gap-2 text-lg font-bold">
          <Activity size={18} className="text-primary" />
          آخر النشاط
        </h2>
        {activityQuery.isLoading ? (
          <div className="h-32 animate-pulse bg-muted rounded" />
        ) : activityQuery.isError ? (
          <ErrorState label="تعذر تحميل النشاط" />
        ) : !activityQuery.data?.length ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            لا يوجد نشاط حتى الآن.
          </p>
        ) : (
          <ActivityList items={activityQuery.data} />
        )}
      </section>

      {/* Server cards (if any) */}
      {guilds?.length && guilds.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-5 flex items-center gap-2 text-lg font-bold">
            <Server size={18} className="text-primary" />
            خوادمك
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {guilds.slice(0, 3).map((guild) => (
              <div
                key={guild.id}
                className="flex items-center gap-4 border border-card-border bg-card p-4 transition hover:border-primary hover:bg-accent/30 cursor-pointer"
                onClick={() => {
                  const [, navigate] = useLocation();
                  navigate(`/server/${guild.id}`);
                }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#111110] font-display text-base font-bold text-white">
                  {guild.iconUrl ? (
                    <img src={guild.iconUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials(guild.name)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{guild.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {guild.memberCount} عضو | {guild.botPresent ? 'البوت متصل' : 'دعوة مطلوبة'}
                  </p>
                </div>
                {guild.botPresent ? (
                  <span className="text-emerald-500">
                    <CheckCircle2 size={16} />
                  </span>
                ) : (
                  <span className="text-primary">
                    <Plus size={16} />
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SecretInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded border border-border bg-background px-3 py-2 pl-10 text-sm"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 left-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label={show ? "إخفاء" : "إظهار"}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 6) return "••••••";
  return `${value.slice(0, 4)}...****`;
}

type BotProfile = {
  id: string;
  name: string;
  isActive: boolean;
  botInfo: { id: string; username: string; tag?: string; avatarUrl: string | null } | null;
  createdAt: string;
  updatedAt: string;
};

function BotCard({
  bot,
  onActivate,
  onDelete,
}: {
  bot: BotProfile;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const display = bot.botInfo?.tag ?? bot.botInfo?.username ?? bot.name;
  return (
    <div
      className={`relative rounded-xl border p-4 backdrop-blur bg-card/70 transition ${
        bot.isActive
          ? "border-emerald-500/60 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]"
          : "border-card-border hover:border-primary/50"
      }`}
    >
      {bot.isActive && (
        <span className="absolute -top-2 -right-2 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
          <CheckCircle2 size={12} /> نشط الآن
        </span>
      )}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted flex items-center justify-center text-primary font-bold">
          {bot.botInfo?.avatarUrl ? (
            <img src={bot.botInfo.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Bot size={22} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{display}</p>
          <p className="truncate text-xs text-muted-foreground">{bot.name}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        {bot.isActive ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
            <CheckCircle2 size={14} /> البوت الحالي
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onActivate(bot.id)}
            className="inline-flex items-center gap-1 rounded border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition"
          >
            <RefreshCw size={13} /> تحديد
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(bot.id)}
          className="inline-flex items-center gap-1 rounded border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-500/10 transition"
        >
          <Trash2 size={13} /> حذف
        </button>
      </div>
    </div>
  );
}

function AddBotModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [botToken, setBotToken] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  if (!open) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch("/api/discord/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, clientId, botToken, clientSecret }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setResult({ ok: true, message: data.message ?? "تم حفظ البوت." });
        setName("");
        setClientId("");
        setBotToken("");
        setClientSecret("");
        onSaved();
        setTimeout(onClose, 800);
      } else {
        setResult({ ok: false, message: data.message ?? "فشل حفظ البوت." });
      }
    } catch {
      setResult({ ok: false, message: "تعذر الاتصال بالخادم." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur">
      <div className="w-full max-w-md rounded-2xl border border-card-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <Plus size={18} className="text-primary" /> إضافة بوت جديد
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold">اسم الحساب</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: بوت الخوادم الرسمي"
              required
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">DISCORD_CLIENT_ID</label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="معرّف التطبيق"
              required
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <SecretInput
            label="DISCORD_BOT_TOKEN"
            value={botToken}
            onChange={setBotToken}
            placeholder="MTk4N... بوت توكن"
          />
          <SecretInput
            label="DISCORD_CLIENT_SECRET"
            value={clientSecret}
            onChange={setClientSecret}
            placeholder="سر التطبيق"
          />

          <button
            type="submit"
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded bg-[#ed1c24] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#ed1c24]/90 transition disabled:opacity-60"
          >
            {saving ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                جارٍ الفحص...
              </>
            ) : (
              <>
                <Zap size={15} /> ⚡ فحص وحفظ البوت
              </>
            )}
          </button>

          {result && (
            <div
              className={`flex items-start gap-2 border p-3 text-sm ${
                result.ok
                  ? "border-emerald-200 bg-emerald-50/65 dark:border-emerald-900 dark:bg-emerald-950/20"
                  : "border-red-200 bg-red-50/65 dark:border-red-900 dark:bg-red-950/20"
              }`}
            >
              {result.ok ? (
                <CheckCircle2 size={18} className="mt-0.5 text-emerald-500" />
              ) : (
                <AlertTriangle size={18} className="mt-0.5 text-red-500" />
              )}
              <span>{result.message}</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function SettingsPage({ status, statusError }: { status?: DiscordStatus; statusError: boolean }) {
  const [bots, setBots] = useState<BotProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function loadBots() {
    try {
      const res = await fetch("/api/discord/bots");
      if (res.ok) {
        setBots(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }

  // Load once on mount — data is persisted server-side (DB or JSON fallback),
  // so it survives page refreshes (no loss on F5).
  useEffect(() => {
    void loadBots();
  }, []);

  async function handleActivate(id: string) {
    setActionError(null);
    const res = await fetch(`/api/discord/bots/${id}/activate`, { method: "POST" });
    if (res.ok) {
      setBots((prev) => prev.map((b) => ({ ...b, isActive: b.id === id })));
    } else {
      setActionError("فشل تفعيل البوت.");
    }
  }

  async function handleDelete(id: string) {
    setActionError(null);
    const res = await fetch(`/api/discord/bots/${id}`, { method: "DELETE" });
    if (res.ok) {
      setBots((prev) => prev.filter((b) => b.id !== id));
    } else {
      setActionError("فشل حذف البوت.");
    }
  }

  const activeCount = bots.filter((b) => b.isActive).length;

  return (
    <div>
      <PageHeading
        eyebrow="الإعدادات / ٠١"
        title="إعدادات التطبيق"
        description="إدارة بوتات Discord المتعددة."
      />

      <div className="space-y-6">
        {/* --- حالة الاتصال --- */}
        <div
          className={`flex items-center gap-3 border p-4 text-sm ${
            status?.configured
              ? "border-emerald-200 bg-emerald-50/65 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300"
              : "border-amber-200 bg-amber-50/65 text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300"
          }`}
        >
          {status?.configured ? (
            <CheckCircle2 size={20} className="text-emerald-500" />
          ) : (
            <AlertTriangle size={20} className="text-amber-500" />
          )}
          <div>
            <p className="font-semibold">
              {status?.configured ? "متصل" : "غير مُعد"}
              {status?.botUser ? `: ${status.botUser}` : ""}
            </p>
            <p className="text-xs opacity-80 mt-0.5">
              {status?.message ?? "أضف بوت Discord لتفعيل الاتصال."}
            </p>
          </div>
        </div>

        {/* --- البوتات المحفوظة --- */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Bot size={18} className="text-primary" /> البوتات المحفوظة
              {activeCount > 0 && (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-500">
                  {activeCount} نشط
                </span>
              )}
            </h2>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded bg-[#ed1c24] px-4 py-2 text-xs font-bold text-white hover:bg-[#ed1c24]/90 transition"
            >
              <Plus size={14} /> إضافة بوت
            </button>
          </div>

          {actionError && (
            <div className="mb-3 flex items-center gap-2 border border-red-200 bg-red-50/65 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/20">
              <AlertTriangle size={16} /> {actionError}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
          ) : bots.length === 0 ? (
            <div className="rounded-xl border border-dashed border-card-border p-8 text-center">
              <Bot size={28} className="mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                لا توجد بوتات محفوظة. اضغط «إضافة بوت» لربط بوت Discord.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {bots.map((b) => (
                <BotCard key={b.id} bot={b} onActivate={handleActivate} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </section>

        {/* --- OAuth ربط الحساب --- */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <Key size={18} className="text-primary" /> ربط حساب Discord (OAuth)
          </h2>
          <a
            href="/api/auth/discord/login"
            className="inline-flex items-center gap-2 bg-[#ed1c24] px-4 py-2 text-xs font-bold text-white hover:bg-[#ed1c24]/90 transition"
          >
            <Link2 size={14} /> ربط حساب Discord
          </a>
        </section>

        {/* --- الوضع --- */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <Zap size={18} className="text-primary" /> الوضع
          </h2>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-semibold">الوضع الداكن</span>
            <button
              type="button"
              onClick={() => {
                const isDark = document.documentElement.classList.contains('dark');
                document.documentElement.classList.toggle('dark', !isDark);
                localStorage.setItem('discord-theme', !isDark ? 'dark' : 'light');
              }}
              className="flex items-center gap-2 border border-border bg-card px-4 py-2 text-xs font-semibold hover:border-primary"
            >
              {document.documentElement.classList.contains('dark') ? (
                <>
                  <Sun size={14} /> {' '}الوضع الفاتح
                </>
              ) : (
                <>
                  <Moon size={14} /> {' '}الوضع الداكن
                </>
              )}
            </button>
          </div>
        </section>
      </div>

      <AddBotModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={loadBots} />
    </div>
  );
}

// ─── Router ───

function Router() {
  const [, navigate] = useLocation();
  const statusQuery = useGetDiscordStatus({ query: { queryKey: getGetDiscordStatusQueryKey() } });
  const guildQuery = useListGuilds({ query: { queryKey: getListGuildsQueryKey() } });
  const { selectedId, setSelectedId, selectedGuild } = useGuildSelection(guildQuery.data);

  return (
    <AppShell
      selectedGuild={selectedGuild}
      onSelectGuild={() => navigate('/servers')}
      status={statusQuery.data}
    >
      <Switch>
        <Route path="/">
          <Dashboard
            status={statusQuery.data}
            statusError={statusQuery.isError}
            selectedGuild={selectedGuild}
            guilds={guildQuery.data}
            onSelectGuild={() => navigate('/servers')}
          />
        </Route>

        <Route path="/servers">
          <Servers
            guilds={guildQuery.data}
            isLoading={guildQuery.isLoading}
            isError={guildQuery.isError}
            refetch={() => guildQuery.refetch()}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </Route>

        {/* Server context routes */}
        <Route path="/server/:guildId">
          {(params) => (
            <AppShell
              selectedGuild={selectedGuild}
              onSelectGuild={() => navigate('/servers')}
              status={statusQuery.data}
              guildId={params.guildId}
              onBack={() => navigate('/servers')}
            >
              <ServerDashboard guildId={params.guildId} onBack={() => navigate('/servers')} />
            </AppShell>
          )}
        </Route>

        <Route path="/server/:guildId/welcome">
          {(params) => (
            <AppShell
              selectedGuild={selectedGuild}
              onSelectGuild={() => navigate('/servers')}
              status={statusQuery.data}
              guildId={params.guildId}
              onBack={() => navigate(`/server/${params.guildId}`)}
            >
              <WelcomePage
                selectedGuild={selectedGuild}
                selectedId={params.guildId}
                onBack={() => navigate(`/server/${params.guildId}`)}
              />
            </AppShell>
          )}
        </Route>

        <Route path="/server/:guildId/activity">
          {(params) => (
            <AppShell
              selectedGuild={selectedGuild}
              onSelectGuild={() => navigate('/servers')}
              status={statusQuery.data}
              guildId={params.guildId}
              onBack={() => navigate(`/server/${params.guildId}`)}
            >
              <ActivityPage
                selectedId={params.guildId}
                selectedGuild={selectedGuild}
                onBack={() => navigate(`/server/${params.guildId}`)}
              />
            </AppShell>
          )}
        </Route>

        <Route path="/server/:guildId/settings">
          {(params) => (
            <AppShell
              selectedGuild={selectedGuild}
              onSelectGuild={() => navigate('/servers')}
              status={statusQuery.data}
              guildId={params.guildId}
              onBack={() => navigate(`/server/${params.guildId}`)}
            >
              <ServerSettingsPage
                guildId={params.guildId}
                onBack={() => navigate(`/server/${params.guildId}`)}
              />
            </AppShell>
          )}
        </Route>

        {/* Public settings (account, not server-specific) */}
        <Route path="/settings">
          <SettingsPage status={statusQuery.data} statusError={statusQuery.isError} />
        </Route>

        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

// ─── Welcome card live preview (shared by editor + server settings) ───
function Preview({
  draft,
  guild,
}: {
  draft: WelcomeSettingsInput | WelcomeSettings;
  guild: Guild;
}) {
  const accent = draft.accentColor || "#E50914";
  return (
    <aside className="space-y-4">
      <div className="border border-card-border bg-card p-5">
        <p className="mb-4 flex items-center gap-2 text-xs font-bold tracking-[.13em] text-primary">
          <Eye size={14} />
          معاينة البطاقة الحية
        </p>
        <div
          className="relative overflow-hidden rounded-sm border border-white/10 p-6"
          style={{ background: "linear-gradient(135deg, #1a1a1a, #0a0a0a)" }}
        >
          <div
            className="absolute inset-y-0 right-0 w-1.5"
            style={{ backgroundColor: accent }}
          />
          <div className="flex items-center gap-4">
            {guild.iconUrl ? (
              <img
                src={guild.iconUrl}
                alt=""
                className="h-14 w-14 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 font-display font-bold">
                {initials(guild.name)}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{guild.name}</p>
              <p className="text-xs text-muted-foreground">
                {guild.memberCount.toLocaleString("ar-SA")} عضو
              </p>
            </div>
          </div>
          <div className="mt-5 rounded-sm border border-white/10 bg-black/40 p-4">
            <p className="text-sm font-semibold" style={{ color: accent }}>
              {draft.headline || "أهلًا بك في السيرفر"}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {(draft.body || "نورتنا {member}، نتمنى لك وقتًا ممتعًا.").replace(
                "{member}",
                "@member",
              )}
            </p>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            النمط: {draft.style === "banner" ? "شريط عريض" : "Embed"} ·{" "}
            {draft.enabled ? "مُفعّل" : "متوقف"}
          </p>
        </div>
      </div>
    </aside>
  );
}

export default App;
