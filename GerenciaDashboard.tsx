import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BarChart, Bar, ComposedChart, Line, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';
import { supabase } from './supabase';
import { DollarSign, Clock, Plane, Calendar, X } from 'lucide-react';
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
const DonutChart: React.FC<{
  segments: [string, number][];
  total: number;
  label: string;
  selectedName?: string | null;
  onSelect?: (name: string) => void;
}> = ({ segments, total, label, selectedName, onSelect }) => {
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
              strokeLinecap="butt"
              opacity={selectedName && name !== selectedName ? 0.2 : 1}
              onClick={() => onSelect?.(name)}
              style={{ cursor: 'pointer', transition: 'opacity 0.25s ease' }} />
          );
        })}
        <text x={90} y={84} textAnchor="middle" fill="#64748B" fontSize={12} fontFamily="Inter,sans-serif">
          {selectedName ?? 'Total'}
        </text>
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

// ─── Chart card ──────────────────────────────────────────────────────────────
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
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [expandedMaint, setExpandedMaint] = useState<any | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: reps }, { data: hist, error: histError }] = await Promise.all([
      supabase.from('relatorios_consolidados')
        .select('data, locacoes, voos')
        .gte('data', startDate).lte('data', endDate).order('data'),
      supabase.from('historico_status_equipamentos')
        .select('prefixo, status_novo, data, turno, lider, motivo')
        .gte('data', startDate).lte('data', endDate).order('data'),
    ]);
    if (histError) console.error('[Manutenção] erro ao buscar histórico:', histError);
    setReports(reps || []);
    setFleetHistory(hist || []);
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── Locações com data do relatório anexada ────────────────────────────────
  const locacoes = useMemo(() =>
    reports.flatMap(r =>
      (r.locacoes || [])
        .filter((l: any) => l.tipo === 'LOCAR' && l.inicio && l.fim)
        .map((l: any) => ({ ...l, _date: r.data }))
    ), [reports]);

  // ── Totais globais (pills, donut) — não filtrados por fornecedor ──────────
  const totalCost = useMemo(() =>
    locacoes.reduce((s, l) => s + hoursBilled(l.inicio, l.fim) * (l.valor_hora_brl || 0), 0), [locacoes]);

  const totalUnits = useMemo(() =>
    locacoes.reduce((s, l) => s + hoursBilled(l.inicio, l.fim), 0), [locacoes]);

  const totalFlights = useMemo(() =>
    reports.reduce((s, r) => s + (r.voos || []).length, 0), [reports]);

  const supplierMap = useMemo(() => {
    const m = new Map<string, number>();
    locacoes.forEach(l => {
      const h = hoursBilled(l.inicio, l.fim);
      m.set(l.empresa || 'Outros', (m.get(l.empresa || 'Outros') || 0) + h * (l.valor_hora_brl || 0));
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [locacoes]);

  // ── Locações filtradas pelo fornecedor selecionado ────────────────────────
  const filteredLocacoes = useMemo(() =>
    selectedSupplier ? locacoes.filter(l => l.empresa === selectedSupplier) : locacoes,
    [locacoes, selectedSupplier]);

  const filteredCost = useMemo(() =>
    filteredLocacoes.reduce((s, l) => s + hoursBilled(l.inicio, l.fim) * (l.valor_hora_brl || 0), 0),
    [filteredLocacoes]);

  // ── Cards que respondem ao filtro ─────────────────────────────────────────
  const byEquip = useMemo(() => {
    const m = new Map<string, { cost: number; horas: number }>();
    filteredLocacoes.forEach(l => {
      const h = hoursBilled(l.inicio, l.fim);
      const c = h * (l.valor_hora_brl || 0);
      const p = m.get(l.equipamento) || { cost: 0, horas: 0 };
      m.set(l.equipamento, { cost: p.cost + c, horas: p.horas + h });
    });
    return Array.from(m.entries())
      .map(([name, v]) => ({ name, cost: +v.cost.toFixed(2), horas: v.horas }))
      .sort((a, b) => b.cost - a.cost);
  }, [filteredLocacoes]);

  const top10 = useMemo(() => [...byEquip].sort((a, b) => b.horas - a.horas).slice(0, 10), [byEquip]);

  // filtro adicional por equipamento (aplicado sobre o filtro de fornecedor)
  const dailyFilteredLocacoes = useMemo(() =>
    selectedEquipment ? filteredLocacoes.filter(l => l.equipamento === selectedEquipment) : filteredLocacoes,
    [filteredLocacoes, selectedEquipment]);

  const dailyData = useMemo(() => {
    const days: string[] = [];
    const cur = new Date(startDate + 'T00:00:00'), end = new Date(endDate + 'T00:00:00');
    while (cur <= end) { days.push(cur.toLocaleDateString('en-CA')); cur.setDate(cur.getDate() + 1); }
    const fm = new Map<string, number>(), rm = new Map<string, number>();
    reports.forEach(r => {
      fm.set(r.data, (fm.get(r.data) || 0) + (r.voos || []).length);
    });
    dailyFilteredLocacoes.forEach(l => {
      rm.set(l._date, (rm.get(l._date) || 0) + hoursBilled(l.inicio, l.fim));
    });
    return days.map(d => ({ date: fmtShortDate(d), 'Voos': fm.get(d) || 0, 'Locações (h)': rm.get(d) || 0 }));
  }, [reports, dailyFilteredLocacoes, startDate, endDate]);

  const maintRecords = useMemo(() =>
    fleetHistory.filter(h => h.status_novo === 'MANUTENCAO'), [fleetHistory]);

  const dateLabel = startDate === endDate
    ? fmtFullDate(startDate)
    : `${fmtShortDate(startDate)} → ${fmtShortDate(endDate)}`;

  const handleSupplierClick = (name: string) => {
    setSelectedSupplier(prev => prev === name ? null : name);
    setSelectedEquipment(null);
  };

  const handleEquipmentClick = (data: any) => {
    setSelectedEquipment(prev => prev === data.name ? null : data.name);
  };

  return (
    <div style={{
      height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      padding: '14px 20px', gap: 12, background: '#F1F5F9',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>

      {/* ── Modal de manutenção ── */}
      {expandedMaint && (
        <div
          onClick={() => setExpandedMaint(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 14, padding: 24, maxWidth: 480, width: '90%',
              boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontSize: 16, fontWeight: 700, color: '#1E293B' }}>{expandedMaint.prefixo}</span>
              </div>
              <button
                onClick={() => setExpandedMaint(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Líder</p>
                <p style={{ margin: 0, fontSize: 14, color: '#1E293B', fontWeight: 500 }}>{expandedMaint.lider || '—'}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Data / Turno</p>
                <p style={{ margin: 0, fontSize: 14, color: '#1E293B', fontWeight: 500 }}>{fmtFullDate(expandedMaint.data)} · {expandedMaint.turno}</p>
              </div>
            </div>
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Defeito Registrado</p>
              <p style={{ margin: 0, fontSize: 14, color: '#475569', lineHeight: 1.7 }}>{expandedMaint.motivo || 'Sem descrição registrada.'}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
        <Pill label="Total Locação" value={fmtBRL(totalCost)} icon={<DollarSign size={16} />} />
        <Pill label="Horas Cobradas" value={`${totalUnits}h`} icon={<Clock size={16} />} />
        <Pill label="Total Voos" value={String(totalFlights)} icon={<Plane size={16} />} />
        {selectedSupplier && (
          <button
            onClick={() => { setSelectedSupplier(null); setSelectedEquipment(null); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: SUPPLIER_COLORS[selectedSupplier] ?? '#1E293B',
              color: '#fff', border: 'none', borderRadius: 20, padding: '5px 12px',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {selectedSupplier} · {fmtBRL(filteredCost)} <X size={12} style={{ marginLeft: 2 }} />
          </button>
        )}
        {selectedEquipment && (
          <button
            onClick={() => setSelectedEquipment(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#EF4444', color: '#fff', border: 'none', borderRadius: 20,
              padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {selectedEquipment} <X size={12} style={{ marginLeft: 2 }} />
          </button>
        )}
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
                <DonutChart
                  segments={supplierMap}
                  total={totalCost}
                  label={fmtBRL(selectedSupplier ? (supplierMap.find(([n]) => n === selectedSupplier)?.[1] ?? 0) : totalCost)}
                  selectedName={selectedSupplier}
                  onSelect={handleSupplierClick}
                />
                <div style={{ width: '100%', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                  {supplierMap.map(([name, cost], i) => {
                    const isSelected = selectedSupplier === name;
                    const isDimmed = selectedSupplier !== null && !isSelected;
                    return (
                      <div
                        key={name}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '5px 6px', borderTop: i === 0 ? 'none' : '1px solid #F1F5F9',
                          borderRadius: 6,
                          background: isSelected ? '#F8FAFC' : 'transparent',
                          opacity: isDimmed ? 0.4 : 1,
                          transition: 'opacity 0.2s ease, background 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: SUPPLIER_COLORS[name] ?? '#94A3B8', flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: '#1E293B', fontWeight: isSelected ? 700 : 500 }}>{name}</span>
                        </div>
                        <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>{fmtBRL(cost)}</span>
                      </div>
                    );
                  })}
                  {supplierMap.length === 0 && <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>Nenhuma locação</p>}
                </div>
              </div>
            </div>

            {/* Custo por Equipamento */}
            <ChartCard title={`Custo por Equipamento (R$)${selectedSupplier ? ` · ${selectedSupplier}` : ''}`}>
              {byEquip.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ color: '#94A3B8', fontSize: 13 }}>Nenhuma locação</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byEquip} margin={{ left: 0, right: 8, top: 28, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748B' }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 9, fill: '#64748B' }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} width={36} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="cost" name="R$ Custo" radius={[4, 4, 0, 0]} onClick={handleEquipmentClick} style={{ cursor: 'pointer' }}>
                      <LabelList
                        dataKey="cost"
                        position="insideTop"
                        formatter={(v: number) => fmtBRL(v)}
                        style={{ fontSize: 12, fill: '#fff', fontWeight: 700 }}
                      />
                      {byEquip.map((entry, i) => (
                        <Cell key={i} fill={selectedEquipment === entry.name ? '#EF4444' : (i === 0 && !selectedEquipment ? '#EF4444' : '#1E293B')} opacity={selectedEquipment && selectedEquipment !== entry.name ? 0.35 : 1} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Top 10 */}
            <ChartCard title={`Top 10 Mais Locados (horas)${selectedSupplier ? ` · ${selectedSupplier}` : ''}`}>
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
                    <Bar dataKey="horas" name="Horas" radius={[0, 4, 4, 0]} onClick={handleEquipmentClick} style={{ cursor: 'pointer' }}>
                      <LabelList dataKey="horas" position="insideRight" formatter={(v: number) => `${v}h`} style={{ fontSize: 12, fill: '#fff', fontWeight: 700 }} />
                      {top10.map((entry, i) => (
                        <Cell key={i} fill={selectedEquipment === entry.name ? '#EF4444' : (i === 0 && !selectedEquipment ? '#EF4444' : '#1E293B')} opacity={selectedEquipment && selectedEquipment !== entry.name ? 0.35 : 1} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* ── Row 2: Voos × Locações + Manutenção table ── */}
          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12 }}>

            {/* Voos × Locações */}
            <ChartCard title={`Análise: Voos × Locações${selectedSupplier ? ` · ${selectedSupplier}` : ''}`}>
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
                        {['Equip.', 'Líder', 'Data / Turno', 'Defeito'].map(h => (
                          <th key={h} style={{ ...tableStyles.th, textAlign: 'left', fontSize: 10 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {maintRecords.map((r, i) => (
                        <tr
                          key={i}
                          onClick={() => setExpandedMaint(r)}
                          style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#EFF6FF')}
                          onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#F8FAFC')}
                        >
                          <td style={{ ...tableStyles.td, fontSize: 12, padding: '6px 8px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
                              {r.prefixo}
                            </span>
                          </td>
                          <td style={{ ...tableStyles.td, fontSize: 11, padding: '6px 8px', color: '#475569', whiteSpace: 'nowrap', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.lider || '—'}
                          </td>
                          <td style={{ ...tableStyles.td, fontSize: 11, padding: '6px 8px', color: '#475569', whiteSpace: 'nowrap' }}>
                            {fmtShortDate(r.data)} · {r.turno}
                          </td>
                          <td style={{ ...tableStyles.td, fontSize: 11, padding: '6px 8px', color: '#64748B', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.motivo || '—'}
                          </td>
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
