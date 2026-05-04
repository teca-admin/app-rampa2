import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BarChart, Bar, ComposedChart, Line, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';
import { supabase } from './supabase';
import { DollarSign, Clock, Plane, Calendar } from 'lucide-react';
import {
  hoursBilled, fmtBRL, fmtShortDate, fmtFullDate,
  todayStr, firstDayOfCurrentMonth,
  ChartTooltip, DateRangePicker, tableStyles,
} from './DashboardUtils';

// ─── Cores por fornecedor ─────────────────────────────────────────────────────
const SUPPLIER_COLORS: Record<string, string> = {
  'Dnata':    '#1E293B',
  'Pro Air':  '#EF4444',
  'AeroSky':  '#CBD5E1',
  'Gol':      '#FF6F1F',
};

// ─── Donut SVG ────────────────────────────────────────────────────────────────
const DonutChart: React.FC<{ segments: [string, number][]; total: number; label: string }> = ({ segments, total, label }) => {
  const r = 72; const circ = 2 * Math.PI * r;
  let cumulative = 0;
  return (
    <div style={{ width: 180, height: 180, flexShrink: 0, margin: '0 auto' }}>
      <svg width={180} height={180} viewBox="0 0 180 180">
        <circle cx={90} cy={90} r={r} fill="none" stroke="#E2E8F0" strokeWidth={26} />
        {segments.map(([name, value]) => {
          const segLen = circ * (value / (total || 1));
          const offset = circ * 0.25 - cumulative;
          cumulative += segLen;
          return (
            <circle key={name} cx={90} cy={90} r={r} fill="none"
              stroke={SUPPLIER_COLORS[name] ?? '#94A3B8'}
              strokeWidth={26}
              strokeDasharray={`${segLen} ${circ - segLen}`}
              strokeDashoffset={offset}
              strokeLinecap="butt" />
          );
        })}
        <text x={90} y={84} textAnchor="middle" fill="#64748B" fontSize={12} fontFamily="Inter,sans-serif">Total</text>
        <text x={90} y={104} textAnchor="middle" fill="#1E293B" fontSize={16} fontWeight={700} fontFamily="Inter,sans-serif">{label}</text>
      </svg>
    </div>
  );
};

// ─── Compact KPI pill ─────────────────────────────────────────────────────────
const Pill: React.FC<{ label: string; value: string; icon: React.ReactNode; accent?: boolean }> =
  ({ label, value, icon, accent }) => (
    <div style={{
      background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10,
      padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
    }}>
      <span style={{ color: accent ? '#EF4444' : '#64748B', display: 'flex' }}>{icon}</span>
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1 }}>{label}</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#1E293B', lineHeight: 1.2 }}>{value}</div>
      </div>
    </div>
  );

// ─── Chart card that fills its flex cell ─────────────────────────────────────
const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{
    background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: '12px 14px',
    display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
  }}>
    <p style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', margin: '0 0 8px', flexShrink: 0 }}>{title}</p>
    <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
  </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
const GerenciaDashboard: React.FC = () => {
  const [startDate, setStartDate] = useState(firstDayOfCurrentMonth());
  const [endDate, setEndDate] = useState(todayStr());
  const [showPicker, setShowPicker] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [fleetHistory, setFleetHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const pickerRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: reps }, { data: hist }] = await Promise.all([
      supabase.from('relatorios_consolidados')
        .select('data, locacoes, voos')
        .gte('data', startDate).lte('data', endDate).order('data'),
      supabase.from('historico_status_equipamentos')
        .select('prefixo, status_novo, data, turno, motivo')
        .gte('data', startDate).lte('data', endDate).order('data'),
    ]);
    setReports(reps || []);
    setFleetHistory(hist || []);
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── calculations ─────────────────────────────────────────────────────────
  const locacoes = useMemo(() =>
    reports.flatMap(r => (r.locacoes || []).filter((l: any) => l.tipo === 'LOCAR' && l.inicio && l.fim)),
    [reports]);

  const totalCost = useMemo(() =>
    locacoes.reduce((s, l) => s + hoursBilled(l.inicio, l.fim) * (l.valor_hora_brl || 0), 0), [locacoes]);

  const totalUnits = useMemo(() =>
    locacoes.reduce((s, l) => s + hoursBilled(l.inicio, l.fim), 0), [locacoes]);

  const totalFlights = useMemo(() =>
    reports.reduce((s, r) => s + (r.voos || []).length, 0), [reports]);

  const byEquip = useMemo(() => {
    const m = new Map<string, { cost: number; horas: number }>();
    locacoes.forEach(l => {
      const h = hoursBilled(l.inicio, l.fim);
      const c = h * (l.valor_hora_brl || 0);
      const p = m.get(l.equipamento) || { cost: 0, horas: 0 };
      m.set(l.equipamento, { cost: p.cost + c, horas: p.horas + h });
    });
    return Array.from(m.entries()).map(([name, v]) => ({ name, cost: +v.cost.toFixed(2), horas: v.horas })).sort((a, b) => b.cost - a.cost);
  }, [locacoes]);

  const top10 = useMemo(() => [...byEquip].sort((a, b) => b.horas - a.horas).slice(0, 10), [byEquip]);

  const supplierMap = useMemo(() => {
    const m = new Map<string, number>();
    locacoes.forEach(l => {
      const h = hoursBilled(l.inicio, l.fim);
      m.set(l.empresa || 'Outros', (m.get(l.empresa || 'Outros') || 0) + h * (l.valor_hora_brl || 0));
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [locacoes]);

  const dailyData = useMemo(() => {
    const days: string[] = [];
    const cur = new Date(startDate + 'T00:00:00'), end = new Date(endDate + 'T00:00:00');
    while (cur <= end) { days.push(cur.toLocaleDateString('en-CA')); cur.setDate(cur.getDate() + 1); }
    const fm = new Map<string, number>(), rm = new Map<string, number>();
    reports.forEach(r => {
      fm.set(r.data, (fm.get(r.data) || 0) + (r.voos || []).length);
      (r.locacoes || []).filter((l: any) => l.tipo === 'LOCAR' && l.inicio && l.fim).forEach((l: any) => {
        rm.set(r.data, (rm.get(r.data) || 0) + hoursBilled(l.inicio, l.fim));
      });
    });
    return days.map(d => ({ date: fmtShortDate(d), 'Voos': fm.get(d) || 0, 'Locações (h)': rm.get(d) || 0 }));
  }, [reports, startDate, endDate]);

  const maintRecords = useMemo(() =>
    fleetHistory.filter(h => h.status_novo === 'MANUTENCAO'), [fleetHistory]);

  const dateLabel = startDate === endDate ? fmtFullDate(startDate) : `${fmtShortDate(startDate)} → ${fmtShortDate(endDate)}`;

  return (
    <div style={{
      height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      padding: '14px 20px', gap: 12, background: '#F1F5F9',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
        <Pill label="Total Locação" value={fmtBRL(totalCost)} icon={<DollarSign size={16} />} />
        <Pill label="Horas Cobradas" value={`${totalUnits}h`} icon={<Clock size={16} />} />
        <Pill label="Total Voos" value={String(totalFlights)} icon={<Plane size={16} />} />
        <div ref={pickerRef} style={{ position: 'relative', marginLeft: 'auto' }}>
          <button onClick={() => setShowPicker(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 6, background: '#fff',
            border: '1px solid #E2E8F0', borderRadius: 8, padding: '7px 14px',
            cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#1E293B',
          }}>
            <Calendar size={14} color="#64748B" />{dateLabel}
          </button>
          {showPicker && (
            <div style={{ position: 'absolute', right: 0, top: 40, zIndex: 200 }}>
              <DateRangePicker startDate={startDate} endDate={endDate}
                onRange={(s, e) => { setStartDate(s); setEndDate(e); setShowPicker(false); }} />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#94A3B8', fontWeight: 600 }}>Carregando...</p>
        </div>
      ) : (
        <>
          {/* ── Row 1: Donut + Custo por Equip + Top 10 ── */}
          <div style={{ flex: '0 0 42%', minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr', gap: 12 }}>

            {/* Donut + legend */}
            <div style={{
              background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: '12px 14px',
              display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
            }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', margin: '0 0 6px', flexShrink: 0 }}>Custo por Fornecedor</p>
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden' }}>
                <DonutChart segments={supplierMap} total={totalCost} label={fmtBRL(totalCost)} />
                <div style={{ width: '100%', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                  {supplierMap.map(([name, cost], i) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0', borderTop: i === 0 ? 'none' : '1px solid #F1F5F9' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: SUPPLIER_COLORS[name] ?? '#94A3B8', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: '#1E293B', fontWeight: 500 }}>{name}</span>
                      </div>
                      <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>{fmtBRL(cost)}</span>
                    </div>
                  ))}
                  {supplierMap.length === 0 && <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>Nenhuma locação</p>}
                </div>
              </div>
            </div>

            {/* Custo por Equipamento */}
            <ChartCard title="Custo por Equipamento (R$)">
              {byEquip.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ color: '#94A3B8', fontSize: 13 }}>Nenhuma locação</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byEquip} margin={{ left: 0, right: 8, top: 20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748B' }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 9, fill: '#64748B' }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} width={36} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="cost" name="R$ Custo" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="cost" position="insideTop" formatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)} style={{ fontSize: 12, fill: '#fff', fontWeight: 700 }} />
                      {byEquip.map((_, i) => <Cell key={i} fill={i === 0 ? '#EF4444' : '#1E293B'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Top 10 */}
            <ChartCard title="Top 10 Mais Locados (horas)">
              {top10.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ color: '#94A3B8', fontSize: 13 }}>Nenhuma locação</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top10} layout="vertical" margin={{ left: 0, right: 40, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9, fill: '#64748B' }} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: '#64748B' }} width={80} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="horas" name="Horas" radius={[0, 4, 4, 0]}>
                      <LabelList dataKey="horas" position="insideRight" formatter={(v: number) => `${v}h`} style={{ fontSize: 12, fill: '#fff', fontWeight: 700 }} />
                      {top10.map((_, i) => <Cell key={i} fill={i === 0 ? '#EF4444' : '#1E293B'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* ── Row 2: Voos × Locações + Manutenção table ── */}
          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12 }}>

            {/* Voos × Locações */}
            <ChartCard title="Análise: Voos × Locações">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyData} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} />
                  <YAxis yAxisId="l" tick={{ fontSize: 10, fill: '#64748B' }} allowDecimals={false} width={28} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: '#64748B' }} allowDecimals={false} width={28} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} formatter={v => <span style={{ color: '#1E293B', fontWeight: 500 }}>{v}</span>} />
                  <Bar yAxisId="l" dataKey="Voos" fill="#1E293B" radius={[4, 4, 0, 0]} opacity={0.9}>
                    <LabelList dataKey="Voos" position="insideTop" style={{ fontSize: 12, fill: '#fff', fontWeight: 700 }} />
                  </Bar>
                  <Line yAxisId="r" type="monotone" dataKey="Locações (h)" stroke="#EF4444" strokeWidth={2}
                    dot={{ r: 3, fill: '#fff', stroke: '#EF4444', strokeWidth: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Equipamentos em Manutenção */}
            <div style={{
              background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: '12px 14px',
              display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
            }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', margin: '0 0 8px', flexShrink: 0 }}>
                Equipamentos em Manutenção
                {maintRecords.length > 0 && (
                  <span style={{ marginLeft: 8, background: '#FEF2F2', color: '#EF4444', fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '1px 8px' }}>
                    {maintRecords.length}
                  </span>
                )}
              </p>
              {maintRecords.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ color: '#94A3B8', fontSize: 13 }}>Nenhum envio no período</p>
                </div>
              ) : (
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                    <thead style={{ position: 'sticky', top: 0 }}>
                      <tr>
                        {['Equipamento', 'Data', 'Motivo'].map(h => (
                          <th key={h} style={{ ...tableStyles.th, textAlign: 'left', fontSize: 10 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {maintRecords.map((r, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                          <td style={{ ...tableStyles.td, fontSize: 12, padding: '8px 12px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
                              {r.prefixo}
                            </span>
                          </td>
                          <td style={{ ...tableStyles.td, fontSize: 12, padding: '8px 12px' }}>{fmtFullDate(r.data)}</td>
                          <td style={{ ...tableStyles.td, fontSize: 12, padding: '8px 12px', color: '#64748B' }}>{r.motivo || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default GerenciaDashboard;
