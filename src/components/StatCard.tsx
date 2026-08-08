import type { ReactNode } from 'react';
import { clsx } from '../lib/utils';
import type { LucideIcon } from 'lucide-react';

type Variant = 'indigo' | 'green' | 'amber' | 'teal' | 'rose';

const variants: Record<Variant, { bg: string; text: string; light: string; ring: string }> = {
  indigo: { bg: 'from-indigo-600 to-indigo-700', text: 'text-indigo-600', light: 'bg-indigo-50', ring: 'ring-indigo-100' },
  green:  { bg: 'from-emerald-600 to-emerald-700', text: 'text-emerald-600', light: 'bg-emerald-50', ring: 'ring-emerald-100' },
  amber:  { bg: 'from-amber-500 to-orange-600', text: 'text-amber-600', light: 'bg-amber-50', ring: 'ring-amber-100' },
  teal:   { bg: 'from-teal-600 to-cyan-700', text: 'text-teal-600', light: 'bg-teal-50', ring: 'ring-teal-100' },
  rose:   { bg: 'from-rose-500 to-pink-600', text: 'text-rose-600', light: 'bg-rose-50', ring: 'ring-rose-100' },
};

export default function StatCard(props: {
  label: string;
  value: string;
  icon: LucideIcon;
  variant?: Variant;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  const v = variants[props.variant || 'indigo'];
  const Icon = props.icon;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 overflow-hidden relative group hover:shadow-lg transition-shadow">
      <div className={clsx('absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-10', v.light)} />
      <div className="flex items-start justify-between relative">
        <div>
          <div className="text-xs font-medium text-slate-500">{props.label}</div>
          <div className="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-900">{props.value}</div>
          {props.hint && <div className="mt-1.5 text-xs text-slate-500">{props.hint}</div>}
          {props.action && <div className="mt-3">{props.action}</div>}
        </div>
        <div className={clsx(
          'w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-white ring-8',
          v.bg, v.ring,
        )}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}
