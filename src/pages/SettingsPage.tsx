import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { Settings, ThemeColors, Tournament } from '../lib/types';
import { resetTournament, useStore } from '../store/useStore';
import { confirmDialog, sha256, toast, useUi } from '../store/ui';
import { buildTheme, DEFAULT_BRAND, pickBrandColors, themeToCssVars, type PaletteColor } from '../lib/colors';
import { processLogo } from '../lib/imageColors';
import { downloadJson, exportTournament } from '../lib/excel';
import { sampleTournament } from '../lib/sample';
import { withLog } from '../lib/tournament';
import { roundName } from '../lib/knockout';
import { hasBuildConfig, rawSyncConfig, saveSyncConfig } from '../sync/firebaseSync';
import { restartSync, useSyncStatus } from '../sync/useSync';
import { adminJoinLink } from '../components/SharePanel';
import { Logo } from '../components/Logo';
import { Field, HoleRow, Marble, MarbleLoader, SectionTitle, TeamMarble, Toggle } from '../components/ui';

function useSettings() {
  const s = useStore((x) => x.t.settings);
  const apply = useStore((x) => x.apply);
  const set = (patch: Partial<Settings>, label = 'تعديل الإعدادات') =>
    apply((t) => ({ ...t, settings: { ...t.settings, ...patch } }), label);
  return [s, set] as const;
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="number"
        className="input"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!Number.isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
      />
    </Field>
  );
}

const COLOR_LABELS: [keyof ThemeColors, string][] = [
  ['primary', 'الأساسي'],
  ['accent', 'المميز'],
  ['bg', 'الخلفية'],
  ['surface', 'البطاقات'],
  ['text', 'النص'],
];

function ThemePreview({ s }: { s: Settings }) {
  const ref = useRef<HTMLDivElement>(null);
  const [dark, setDark] = useState(s.dark);
  useEffect(() => {
    const vars = themeToCssVars(buildTheme(s.palette, dark, s.overrides));
    Object.entries(vars).forEach(([k, v]) => ref.current?.style.setProperty(k, v));
  }, [s, dark]);
  return (
    <div>
      <div className="mb-2 flex gap-2">
        <button className={`btn btn-sm ${dark ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setDark(true)}>
          داكن
        </button>
        <button className={`btn btn-sm ${!dark ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setDark(false)}>
          فاتح
        </button>
      </div>
      <div ref={ref} className="overflow-hidden rounded-2xl border border-ink/10" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <div className="flex items-center gap-2 border-b border-ink/10 p-3" style={{ background: 'var(--surface)' }}>
          <Logo src={s.logo} className="h-9 w-auto rounded" />
          <span className="font-display text-xl">{s.name}</span>
          <span className="btn btn-primary btn-sm ms-auto">عرض النتائج</span>
        </div>
        <div className="p-3">
          <div className="board space-y-2 p-3">
            {['الصقور', 'النمور'].map((n, i) => (
              <div key={n} className={`flex items-center gap-2 rounded-lg p-2 ${i === 0 ? 'bg-primary/20' : 'bg-ink/5'}`}>
                <span className="w-5 font-display text-xl" style={{ color: 'var(--accent-ink)' }}>
                  {i + 1}
                </span>
                <Marble color={i === 0 ? 'red' : 'blue'} size={22} />
                <span className="flex-1 font-bold">{n}</span>
                <span className="font-display text-xl">{3 - i}</span>
              </div>
            ))}
            <div className="flex gap-2">
              <span className="btn btn-primary btn-sm">زر أساسي</span>
              <span className="btn btn-accent btn-sm">زر مميز</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BrandingSection() {
  const [s, set] = useSettings();
  const [busy, setBusy] = useState(false);
  const [palette, setPalette] = useState<PaletteColor[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const onLogo = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const { dataUrl, palette } = await processLogo(file);
      setPalette(palette);
      const brand = palette.length ? pickBrandColors(palette) : s.palette;
      set({ logo: dataUrl, palette: brand, overrides: {} }, 'تغيير الشعار');
      toast('تم تحديث الشعار والألوان');
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <section className="board p-5">
      <SectionTitle rank="K" title="الشعار والألوان" sub="ارفع الشعار وسيتم استخراج ألوانه وبناء الثيم منها تلقائياً" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <Logo src={s.logo} className="h-24 w-auto max-w-[14rem] rounded-xl bg-black/10" />
            <div className="flex flex-col gap-2">
              <label className="btn btn-primary cursor-pointer">
                🖼️ رفع شعار (PNG / SVG)
                <input ref={fileRef} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
              </label>
              {s.logo && (
                <button className="btn btn-ghost btn-sm" onClick={() => set({ logo: null, palette: { ...DEFAULT_BRAND }, overrides: {} })}>
                  استعادة الشعار الافتراضي
                </button>
              )}
            </div>
          </div>
          {busy && <MarbleLoader label="جارٍ تحليل ألوان الشعار…" />}
          {palette.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-bold">الألوان المستخرجة (اضغط لاستخدامها):</p>
              <div className="flex flex-wrap gap-2">
                {palette.map((p) => (
                  <div key={p.hex} className="flex flex-col items-center gap-1 rounded-xl bg-ink/5 p-2 text-xs">
                    <span className="h-10 w-10 rounded-full border border-ink/20" style={{ background: p.hex }} />
                    <span dir="ltr">{p.hex}</span>
                    <span className="text-ink/60">{Math.round(p.share * 100)}%</span>
                    <div className="flex gap-1">
                      <button className="rounded bg-ink/10 px-1.5" onClick={() => set({ palette: { ...s.palette, primary: p.hex } })}>
                        أساسي
                      </button>
                      <button className="rounded bg-ink/10 px-1.5" onClick={() => set({ palette: { ...s.palette, accent: p.hex } })}>
                        مميز
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="mb-2 text-sm font-bold">تعديل يدوي للألوان</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {COLOR_LABELS.map(([key, label]) => {
                const auto = buildTheme(s.palette, s.dark, {})[key];
                const value = s.overrides[key] ?? (key === 'primary' || key === 'accent' ? s.palette[key] : auto);
                const overridden = !!s.overrides[key];
                return (
                  <label key={key} className="flex items-center gap-2 rounded-xl bg-ink/5 p-2 text-sm">
                    <input
                      type="color"
                      value={value}
                      onChange={(e) => set({ overrides: { ...s.overrides, [key]: e.target.value } })}
                      className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent"
                    />
                    <span className="flex-1">{label}</span>
                    {overridden && (
                      <button
                        type="button"
                        className="text-xs underline"
                        onClick={(e) => {
                          e.preventDefault();
                          const o = { ...s.overrides };
                          delete o[key];
                          set({ overrides: o });
                        }}
                      >
                        تلقائي
                      </button>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
          <Toggle checked={s.dark} onChange={(v) => set({ dark: v })} label="الوضع الداكن" hint="لوح خشبي داكن — مناسب للشاشات الكبيرة" />
        </div>
        <ThemePreview s={s} />
      </div>
    </section>
  );
}

function SecuritySection() {
  const [s, set] = useSettings();
  const setUnlocked = useUi((x) => x.setAdminUnlocked);
  const [pin, setPin] = useState('');
  return (
    <section className="board p-5">
      <SectionTitle rank="5" title="الصوت والحماية" />
      <Toggle checked={s.sound} onChange={(v) => set({ sound: v })} label="المؤثرات الصوتية" hint="صوت الكرات ونغمة الفوز" />
      <div className="mt-4 space-y-2">
        <p className="font-bold">رمز PIN للإدارة</p>
        <p className="text-xs text-ink/60">حماية بسيطة داخل المتصفح تمنع تعديل النتائج من غير المنظمين. صفحة العرض العام لا تحتاج رمزاً.</p>
        <div className="flex flex-wrap gap-2">
          <input
            className="input max-w-40 text-center tracking-widest"
            inputMode="numeric"
            type="password"
            placeholder={s.pinHash ? 'رمز جديد' : 'رمز من 4 أرقام'}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
          <button
            className="btn btn-primary"
            disabled={pin.length < 3}
            onClick={async () => {
              set({ pinHash: await sha256(pin) }, 'تعيين PIN');
              setUnlocked(true);
              setPin('');
              toast('تم حفظ رمز PIN');
            }}
          >
            حفظ الرمز
          </button>
          {s.pinHash && (
            <>
              <button className="btn btn-ghost" onClick={() => setUnlocked(false)}>
                🔒 قفل الآن
              </button>
              <button className="btn btn-ghost" onClick={() => set({ pinHash: null }, 'إزالة PIN')}>
                إزالة الرمز
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function SyncSection({ t }: { t: Tournament }) {
  const [s, set] = useSettings();
  const { status, error } = useSyncStatus();
  const [raw, setRaw] = useState(rawSyncConfig());
  const join = adminJoinLink(t);
  const build = hasBuildConfig();
  return (
    <section className="board p-5">
      <SectionTitle
        rank="A"
        title="المزامنة المباشرة (اختياري)"
        sub="أدخل النتائج من الهاتف وتتحدث شاشة العرض فوراً. التطبيق يعمل كاملاً بدونها."
      />
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          الحالة:
          <span className={`chip ${status === 'live' ? 'bg-win text-white' : status === 'error' ? 'bg-loss text-white' : 'bg-ink/10'}`}>
            {status === 'off' ? 'غير مفعّلة' : status === 'live' ? 'متصلة' : status === 'connecting' ? 'جارٍ الاتصال' : 'خطأ'}
          </span>
          {error && <span className="text-xs text-loss" dir="ltr">{error}</span>}
        </div>
        {build ? (
          <p className="text-sm">Firebase مربوط بالموقع. تتزامن النتائج تلقائياً عند تسجيل الدخول بحساب صاحب البطولة.</p>
        ) : (
          <>
            <Field
              label="إعدادات Firebase (Realtime Database)"
              hint="انسخ firebaseConfig من لوحة Firebase والصقه هنا (يجب أن يحتوي على databaseURL). يُحفظ في هذا المتصفح فقط."
            >
              <textarea
                className="input min-h-28 font-mono text-xs"
                dir="ltr"
                value={raw}
                placeholder='{"apiKey":"...","authDomain":"...","databaseURL":"https://....firebaseio.com","projectId":"..."}'
                onChange={(e) => setRaw(e.target.value)}
              />
            </Field>
            <div className="flex gap-2">
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (saveSyncConfig(raw)) {
                    restartSync();
                    toast(raw.trim() ? 'تم حفظ إعدادات المزامنة' : 'تم إيقاف المزامنة');
                  } else alert('الإعدادات غير صالحة — تأكد من وجود apiKey و databaseURL');
                }}
              >
                حفظ وتشغيل
              </button>
              {raw && (
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setRaw('');
                    saveSyncConfig('');
                    restartSync();
                  }}
                >
                  إيقاف
                </button>
              )}
            </div>
          </>
        )}
        <Field label="عنوان الموقع العام (اختياري)" hint="يُستخدم في رمز QR. اتركه فارغاً لاستخدام العنوان الحالي.">
          <input
            className="input"
            dir="ltr"
            placeholder="https://my-jakaro.netlify.app/"
            value={s.publicBaseUrl}
            onChange={(e) => set({ publicBaseUrl: e.target.value })}
          />
        </Field>
        {join && (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-ink/5 p-3 sm:flex-row">
            <div className="rounded-xl bg-white p-2">
              <QRCodeSVG value={join} size={120} />
            </div>
            <div className="text-sm">
              <p className="font-bold">رابط الإدارة لجهاز آخر</p>
              <p className="text-ink/65">امسحه من هاتف المنظم لإدخال النتائج على نفس البطولة. لا تشاركه مع الجمهور.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function DataSection({ t }: { t: Tournament }) {
  const replace = useStore((x) => x.replace);
  const apply = useStore((x) => x.apply);
  const fileRef = useRef<HTMLInputElement>(null);
  const importJson = async (file?: File) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as Tournament;
      if (!data?.teams || !data?.matches || !data?.settings) throw new Error('ملف غير صالح');
      const ok = await confirmDialog({
        title: 'استعادة النسخة الاحتياطية؟',
        message: `سيتم استبدال البيانات الحالية بـ «${data.settings.name}» (${data.teams.length} فريق).`,
        confirmText: 'استعادة',
        danger: true,
      });
      if (!ok) return;
      replace({ ...data, updatedAt: Date.now() }, { undoable: true });
      toast('تمت الاستعادة');
    } catch (e) {
      alert(`تعذّرت قراءة الملف: ${(e as Error).message}`);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const reset = async () => {
    const ok = await confirmDialog({
      title: 'بدء بطولة جديدة؟',
      message: 'سيتم حذف كل الفرق والمباريات والنتائج. (يمكنك التراجع مباشرة بعدها، ويُنصح بتنزيل نسخة احتياطية أولاً)\nسيتم الاحتفاظ بالإعدادات والشعار.',
      confirmText: 'بطولة جديدة',
      danger: true,
    });
    if (ok) {
      resetTournament(true);
      toast('بدأت بطولة جديدة');
    }
  };
  const loadSample = async (stage: 'groups' | 'knockout') => {
    const ok = await confirmDialog({
      title: 'تحميل بيانات تجريبية؟',
      message: 'سيتم استبدال البيانات الحالية ببطولة تجريبية من 12 فريقاً.',
      confirmText: 'تحميل',
    });
    if (ok) apply((x) => ({ ...sampleTournament(stage, x.settings), id: x.id }), 'بيانات تجريبية');
  };
  return (
    <section className="board p-5">
      <SectionTitle rank="7" title="البيانات والنسخ الاحتياطي" sub="تُحفظ البيانات تلقائياً في هذا المتصفح" />
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={() => downloadJson(t)}>
          ⬇ نسخة احتياطية (JSON)
        </button>
        <label className="btn btn-ghost cursor-pointer">
          ⬆ استعادة نسخة
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => importJson(e.target.files?.[0])} />
        </label>
        <button className="btn btn-ghost" onClick={() => exportTournament(t)}>
          📊 تصدير Excel
        </button>
      </div>
      <HoleRow className="my-5" />
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-ghost" onClick={() => loadSample('groups')}>
          🧪 بيانات تجريبية (المجموعات)
        </button>
        <button className="btn btn-ghost" onClick={() => loadSample('knockout')}>
          🧪 بيانات تجريبية (الإقصائيات)
        </button>
        <button className="btn btn-danger" onClick={reset}>
          ♻ بطولة جديدة
        </button>
      </div>
    </section>
  );
}

export default function SettingsPage() {
  const t = useStore((x) => x.t);
  const apply = useStore((x) => x.apply);
  const [s, set] = useSettings();
  const hasKo = t.matches.some((m) => m.stage === 'knockout');
  const groupSize = Math.min(...(['A', 'B'] as const).map((g) => t.teams.filter((x) => x.group === g).length));

  return (
    <div className="space-y-6">
      <SectionTitle rank="10" title="الإعدادات" />
      <section className="board p-5">
        <SectionTitle rank="A" title="البطولة" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="اسم البطولة">
            <input
              key={s.name}
              className="input"
              defaultValue={s.name}
              onBlur={(e) => {
                const name = e.target.value.trim();
                if (name && name !== s.name)
                  apply((x) => withLog({ ...x, settings: { ...x.settings, name } }, `اسم البطولة: ${name}`), 'تغيير الاسم');
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          </Field>
          <NumberField
            label="أقصى عدد كرات متبقية"
            value={s.maxMarbles}
            min={1}
            max={16}
            onChange={(v) => set({ maxMarbles: v })}
            hint="الافتراضي 8 (فريق من لاعبين × 4 كرات)"
          />
          <Field
            label="المتأهلون من كل مجموعة"
            hint={hasKo ? 'لتغييره احذف الشجرة أولاً (ألغِ اعتماد المجموعات)' : `أول دور: ${roundName(s.qualifiersPerGroup)}`}
          >
            <select
              className="input"
              value={s.qualifiersPerGroup}
              disabled={hasKo}
              onChange={(e) => set({ qualifiersPerGroup: Number(e.target.value) })}
            >
              {[1, 2, 4, 8].map((n) => (
                <option key={n} value={n} disabled={Number.isFinite(groupSize) && groupSize > 0 && n > groupSize}>
                  {n} ({roundName(n)})
                </option>
              ))}
            </select>
          </Field>
          <NumberField
            label="عدد الطاولات"
            value={s.tablesCount}
            min={0}
            max={50}
            onChange={(v) => set({ tablesCount: v })}
            hint="0 = بدون أرقام طاولات. يُطبق عند توليد الجدول أو «توزيع الطاولات»"
          />
          <NumberField
            label="مدة المباراة (دقائق)"
            value={s.matchTimeLimitMin}
            min={0}
            max={240}
            onChange={(v) => set({ matchTimeLimitMin: v })}
            hint="0 = مؤقت تصاعدي بلا حد"
          />
          <NumberField
            label="مدة كل شريحة في العرض (ثوانٍ)"
            value={s.rotationSeconds}
            min={4}
            max={120}
            onChange={(v) => set({ rotationSeconds: v })}
          />
        </div>
        <div className="mt-3">
          <Toggle
            checked={s.thirdPlaceMatch}
            onChange={(v) => set({ thirdPlaceMatch: v })}
            label="مباراة المركز الثالث"
            hint={hasKo ? 'يُطبق عند إعادة توليد الشجرة' : undefined}
          />
        </div>
      </section>
      <BrandingSection />
      <SecuritySection />
      <SyncSection t={t} />
      <DataSection t={t} />
      <div className="flex justify-center gap-1 py-4 opacity-60">
        {t.teams.slice(0, 12).map((x) => (
          <TeamMarble key={x.id} teams={t.teams} id={x.id} size={18} />
        ))}
      </div>
    </div>
  );
}
