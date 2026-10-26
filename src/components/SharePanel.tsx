import { QRCodeSVG } from 'qrcode.react';
import type { Tournament } from '../lib/types';
import { encodeConfig, getSyncConfig, hasBuildConfig } from '../sync/firebaseSync';
import { toast } from '../store/ui';

export function baseUrl(t: Tournament): string {
  const custom = t.settings.publicBaseUrl.trim();
  if (custom) return custom.replace(/#.*$/, '').replace(/\/?$/, '/');
  return window.location.origin + window.location.pathname;
}

export function publicLink(t: Tournament, path: 'live' | 'show' = 'live'): string {
  const config = getSyncConfig();
  const params = new URLSearchParams();
  if (config) {
    params.set('t', t.id);
    if (!hasBuildConfig()) params.set('fb', encodeConfig(config));
  }
  const q = params.toString();
  return `${baseUrl(t)}#/${path}${q ? `?${q}` : ''}`;
}

export function adminJoinLink(t: Tournament): string | null {
  const config = getSyncConfig();
  if (!config) return null;
  const params = new URLSearchParams({ join: t.id });
  if (!hasBuildConfig()) params.set('fb', encodeConfig(config));
  return `${baseUrl(t)}#/?${params}`;
}

export function SharePanel({ t, compact = false }: { t: Tournament; compact?: boolean }) {
  const link = publicLink(t);
  const synced = !!getSyncConfig();
  const isLocalhost = /localhost|127\.0\.0\.1/.test(baseUrl(t));
  return (
    <div className={`flex ${compact ? 'flex-col items-center text-center' : 'flex-col items-center gap-4 sm:flex-row sm:items-start'} gap-3`}>
      <div className="rounded-2xl bg-white p-3 shadow-lg">
        <QRCodeSVG value={link} size={compact ? 150 : 170} level="M" fgColor="#0b0f2e" />
      </div>
      <div className="min-w-0 flex-1 space-y-2 text-sm">
        <p className="font-bold">امسح الرمز لمتابعة النتائج على الهاتف</p>
        <div className="flex gap-2">
          <input className="input py-1 text-xs" dir="ltr" readOnly value={link} onFocus={(e) => e.target.select()} />
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              void navigator.clipboard?.writeText(link);
              toast('تم نسخ الرابط');
            }}
          >
            نسخ
          </button>
        </div>
        {!synced && (
          <p className="rounded-lg bg-accent/15 p-2 text-xs">
            المزامنة غير مفعّلة: الرابط يعرض بيانات المتصفح نفسه فقط. لتحديث هواتف الحضور مباشرة فعّل المزامنة من الإعدادات.
          </p>
        )}
        {isLocalhost && (
          <p className="rounded-lg bg-loss/15 p-2 text-xs">
            العنوان الحالي (localhost) لا يعمل على الهواتف. استخدم عنوان الشبكة (يظهر عند تشغيل npm run dev) أو عنوان الموقع بعد النشر، أو اضبطه في الإعدادات.
          </p>
        )}
      </div>
    </div>
  );
}
