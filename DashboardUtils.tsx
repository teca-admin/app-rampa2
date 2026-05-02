import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────
export const calcMinutes = (ini: string, fim: string): number => {
  const toM = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const d = toM(fim) - toM(ini);
  return d <= 0 ? d + 1440 : d;
};

export const hoursBilled = (ini: string, fim: string): number =>
  Math.ceil(calcMinutes(ini, fim) / 60);

export const fmtBRL = (v: number): string =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const fmtShortDate = (d: string): string => {
  const [, m, day] = d.split('-');
  return `${day}/${m}`;
};

export const fmtFullDate = (d: string): string => {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

export const todayStr = (): string => new Date().toLocaleDateString('en-CA');

export const firstDayOfCurrentMonth = (): string => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`;
};

export const shiftLabel = (s: string): string =>
  ({ manha: 'Manhã', tarde: 'Tarde', noite: 'Noite', madrugada: 'Madrugada', 'manhã': 'Manhã' } as any)[s] ?? s;

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
export const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8,
      padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      fontFamily: "'Inter', sans-serif",
    }}>
      <p style={{ fontWeight: 600, color: '#1E293B', marginBottom: 6, fontSize: 13, marginTop: 0 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ fontSize: 12, color: '#64748B', margin: '2px 0' }}>
          <span style={{ color: p.color, fontWeight: 600 }}>{p.name}</span>: <b style={{ color: '#1E293B' }}>{p.value}</b>
        </p>
      ))}
    </div>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
interface KpiCardProps {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  iconColor?: string;
}
export const KpiCard: React.FC<KpiCardProps> = ({ title, value, sub, icon, iconColor = '#1E293B' }) => (
  <div style={{
    background: '#FFFFFF', borderRadius: 12, padding: 24,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #E2E8F0',
    display: 'flex', flexDirection: 'column', gap: 8,
    fontFamily: "'Inter', -apple-system, sans-serif",
    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
  }}
    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#64748B', lineHeight: '24px' }}>{title}</span>
      <span style={{ color: iconColor, opacity: 0.8 }}>{icon}</span>
    </div>
    <span style={{ fontSize: 28, fontWeight: 700, color: '#1E293B', lineHeight: 1.1 }}>{value}</span>
    {sub && <span style={{ fontSize: 12, color: '#94A3B8', lineHeight: '16px' }}>{sub}</span>}
  </div>
);

// ─── Date Range Picker ────────────────────────────────────────────────────────
interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onRange: (start: string, end: string) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ startDate, endDate, onRange }) => {
  const [viewMonth, setViewMonth] = useState(() => {
    const d = startDate ? new Date(startDate + 'T00:00:00') : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selecting, setSelecting] = useState(false);
  const [tempStart, setTempStart] = useState('');
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const { year, month } = viewMonth;

  const prevMonth = () => {
    const d = new Date(year, month - 1);
    setViewMonth({ year: d.getFullYear(), month: d.getMonth() });
  };
  const nextMonth = () => {
    const d = new Date(year, month + 1);
    setViewMonth({ year: d.getFullYear(), month: d.getMonth() });
  };

  const totalDays = new Date(year, month + 1, 0).getDate();
  const startOffset = new Date(year, month, 1).getDay();
  const days: (string | null)[] = Array(startOffset).fill(null);
  for (let d = 1; d <= totalDays; d++) {
    days.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }

  const td = todayStr();

  const handleDayClick = (day: string) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      onRange(day, day);
      setSelecting(false);
      setTempStart('');
      return;
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      if (!selecting) {
        setTempStart(day);
        setSelecting(true);
      } else {
        const s = tempStart <= day ? tempStart : day;
        const e = tempStart <= day ? day : tempStart;
        onRange(s, e);
        setSelecting(false);
        setTempStart('');
      }
    }, 230);
  };

  const isStart = (d: string) => d === (selecting ? tempStart : startDate);
  const isEnd = (d: string) => !selecting && d === endDate;
  const inRange = (d: string) => !selecting && startDate && endDate && d > startDate && d < endDate;
  const isToday = (d: string) => d === td;

  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
      padding: 16, minWidth: 288, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={prevMonth} style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: 6, cursor: 'pointer', padding: '4px 6px', color: '#64748B', display: 'flex', alignItems: 'center' }}>
          <ChevronLeft size={14} />
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#1E293B' }}>{MONTHS[month]} {year}</span>
        <button onClick={nextMonth} style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: 6, cursor: 'pointer', padding: '4px 6px', color: '#64748B', display: 'flex', alignItems: 'center' }}>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Week days header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {['D','S','T','Q','Q','S','S'].map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#94A3B8', padding: '2px 0' }}>{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {days.map((d, i) => {
          if (!d) return <div key={`empty-${i}`} />;
          const sel = isStart(d) || isEnd(d);
          return (
            <button
              key={d}
              onClick={() => handleDayClick(d)}
              style={{
                padding: '7px 2px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: sel ? 700 : 400,
                background: sel ? '#1E293B' : inRange(d) ? '#E2E8F0' : 'transparent',
                color: sel ? '#fff' : isToday(d) ? '#EF4444' : '#1E293B',
                transition: 'all 0.1s',
              }}
            >
              {parseInt(d.split('-')[2])}
            </button>
          );
        })}
      </div>

      {/* Status hint */}
      <div style={{ marginTop: 10, borderTop: '1px solid #F1F5F9', paddingTop: 8, textAlign: 'center', fontSize: 11, color: '#64748B' }}>
        {selecting
          ? '⬅ Agora clique no dia final'
          : startDate && endDate
            ? startDate === endDate
              ? `Dia ${fmtFullDate(startDate)}`
              : `${fmtShortDate(startDate)} → ${fmtShortDate(endDate)}`
            : 'Clique para selecionar o início'}
      </div>
    </div>
  );
};

// ─── Section Card ─────────────────────────────────────────────────────────────
export const SectionCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; style?: React.CSSProperties }> =
  ({ title, subtitle, children, style }) => (
    <div style={{
      background: '#FFFFFF', borderRadius: 12, padding: 24,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #E2E8F0',
      fontFamily: "'Inter', -apple-system, sans-serif",
      ...style,
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1E293B', lineHeight: '24px', margin: 0 }}>{title}</h3>
      {subtitle && <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 16px' }}>{subtitle}</p>}
      {!subtitle && <div style={{ marginBottom: 16 }} />}
      {children}
    </div>
  );

// ─── Table styles ─────────────────────────────────────────────────────────────
export const tableStyles = {
  th: {
    padding: '12px 16px', fontSize: 12, fontWeight: 600 as const,
    color: '#64748B', textTransform: 'uppercase' as const,
    letterSpacing: '0.5px', background: '#F8FAFC',
    borderBottom: '1px solid #E2E8F0', lineHeight: '16px',
  },
  td: {
    padding: '14px 16px', fontSize: 14, fontWeight: 500 as const,
    color: '#1E293B', borderBottom: '1px solid #F1F5F9', lineHeight: '20px',
  },
  tfootTd: {
    padding: 16, fontSize: 14, fontWeight: 700 as const,
    color: '#FFFFFF', background: '#1E293B',
  },
};
