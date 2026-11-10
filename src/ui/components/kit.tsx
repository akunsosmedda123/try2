import { X } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { FoodStatus, GlutenStatus, Member } from '../../types';

export function Card({ children, className = '', title, icon, action }: { children: ReactNode; className?: string; title?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-sage-dark">{icon}{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'soft' | 'ghost' | 'danger'; size?: 'sm' | 'md' };
export function Btn({ variant = 'primary', size = 'md', className = '', ...rest }: BtnProps) {
  return <button type="button" {...rest} className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${className}`} />;
}

const TONES = {
  ok: 'bg-sage-light text-sage-dark',
  warn: 'bg-amber-100 text-amber-800',
  bad: 'bg-terra-light text-terra-dark',
  info: 'bg-sky-100 text-sky-800',
  muted: 'bg-beige text-charcoal/70',
} as const;
export type Tone = keyof typeof TONES;
export function Badge({ tone = 'muted', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONES[tone]} ${className}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: FoodStatus }) {
  const tone: Tone = status === 'SAFE' ? 'ok' : status === 'NEEDS VERIFICATION' ? 'warn' : 'bad';
  return <Badge tone={tone}>{status}</Badge>;
}
export function GlutenBadge({ status }: { status: GlutenStatus }) {
  const map = { SAFE: ['ok', 'Gluten-free'], NEEDS_VERIFICATION: ['warn', 'Cek label GF'], NOT_SUITABLE: ['bad', 'Mengandung gluten'] } as const;
  return <Badge tone={map[status][0]}>{map[status][1]}</Badge>;
}

export function Progress({ value, max, tone = 'ok' }: { value: number; max: number; tone?: 'ok' | 'warn' | 'bad' }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const color = tone === 'ok' ? 'bg-sage' : tone === 'warn' ? 'bg-amber-500' : 'bg-terra';
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-beige" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-beige bg-cream/50 p-6 text-center">
      <p className="font-semibold text-charcoal/80">{title}</p>
      {hint && <p className="mt-1 text-sm text-charcoal/60">{hint}</p>}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-charcoal/40 sm:items-center" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-warm p-4 pb-8 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">{title}</h2>
          <button type="button" aria-label="Tutup" onClick={onClose} className="rounded-full p-2 hover:bg-beige"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-charcoal/55">{hint}</span>}
    </label>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="no-print flex gap-1 overflow-x-auto rounded-2xl bg-beige/60 p-1" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition ${value === t.id ? 'bg-white text-sage-dark shadow-soft' : 'text-charcoal/65'}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone }) {
  return (
    <div className="rounded-xl bg-cream p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-charcoal/55">{label}</div>
      <div className={`mt-0.5 text-lg font-bold ${tone === 'bad' ? 'text-terra-dark' : ''}`}>{value}</div>
      {sub && <div className="text-xs text-charcoal/60">{sub}</div>}
    </div>
  );
}

export const MEMBER_LABEL: Record<Member, string> = { ibu: 'Ibu', ayah: 'Ayah', anak: 'Anak' };

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-extrabold leading-tight">{title}</h1>
        {sub && <p className="text-sm text-charcoal/60">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
