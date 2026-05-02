import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';
import { supabase } from './supabase';
import { DollarSign, Clock, Plane, TrendingUp, Calendar } from 'lucide-react';
import {
  calcMinutes, hoursBilled, fmtBRL, fmtShortDate, fmtFullDate,
  todayStr, firstDayOfCurrentMonth,
  ChartTooltip, KpiCard, SectionCard, DateRangePicker, tableStyles,
} from './DashboardUtils';

// ─── Donut Chart ──────────────────────────────────────────────────────────────
const DonutChart: React.FC<{ value: number; total: number; label: string; color: string }> = ({ value, total, label, color }) => {
  const pct = total > 0 ? value / total : 0;
  const r = 70;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  return (
    <svg width={160} height={160} viewBox="0 0 160 160">
      <circle cx={80} cy={80} r={r} fill="none" stroke="#E2E8F0" strokeWidth={28} />
      <circle
        cx={80} cy={80} r={r} fill="none" stroke={color} strokeWidth={28}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x={80} y={74} textAnchor="middle" fill="#64748B" fontSize={11} fontFamily="Inter, sans-serif">Total</text>
      <text x={80} y={92} textAnchor="middle" fill="#1E293B" fontSize={18} fontWeight={700} fontFamily="Inter, sans-serif">{label}</text>
    </svg>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const GerenciaDashboard: React.FC = () => {
  const [startDate, setStartDate] = useState(firstDayOfCurrentMonth());
  const [endDate, setEndDate] = useState(todayStr());
  const [showPicker, setShowPicker] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [fleetHistory, setFleetHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const pickerRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const [{ data: reps }, { data: hist }] = await Promise.all([
        supabase
          .from('relatorios_consolidados')
          .select('data, turno, lider, locacoes, voos')
          .gte('data', startDate)
          .lte('data', endDate)
          .order('data', { ascending: true }),
        supabase
          .from('historico_status_equipamentos')
          .select('prefixo, status_novo, data')
          .gte('data', startDate)
          .lte('data', endDate)
          .order('data', { ascending: true }),
      ]);
      setReports(reps || []);
      setFleetHistory(hist || []);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── derived calculations ──────────────────────────────────────────────────
  const locacoes = useMemo(() =>
    reports.flatMap(r =>
      (r.locacoes || []).filter((l: any) => l.tipo === 'LOCAR' && l.inicio && l.fim)
    ), [reports]);

  const totalCost = useMemo(() =>
    locacoes.reduce((sum, l) => sum + hoursBilled(l.inicio, l.fim) * (l.valor_hora_brl || 0), 0),
    [locacoes]);

  const totalRentalUnits = useMemo(() =>
    locacoes.reduce((sum, l) => sum + hoursBilled(l.inicio, l.fim), 0),
    [locacoes]);

  const totalFlights = useMemo(() =>
    reports.reduce((sum, r) => sum + (r.voos || []).length, 0),
    [reports]);

  const avgCostPerUnit = totalRentalUnits > 0 ? totalCost / totalRentalUnits : 0;

  // Cost and hours by equipment
  const byEquip = useMemo(() => {
    const map = new Map<string, { cost: number; horas: number }>();
    locacoes.forEach(l => {
      const h = hoursBilled(l.inicio, l.fim);
      const cost = h * (l.valor_hora_brl || 0);
      const prev = map.get(l.equipamento) || { cost: 0, horas: 0 };
      map.set(l.equipamento, { cost: prev.cost + cost, horas: prev.horas + h });
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, cost: parseFloat(v.cost.toFixed(2)), horas: v.horas }))
      .sort((a, b) => b.cost - a.cost);
  }, [locacoes]);

  // Top 10 by hours
  const top10 = useMemo(() =>
    [...byEquip].sort((a, b) => b.horas - a.horas).slice(0, 10),
    [byEquip]);

  // Daily correlation data
  const dailyData = useMemo(() => {
    if (!startDate || !endDate) return [];
    const days: string[] = [];
    const cur = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    while (cur <= end) {
      days.push(cur.toLocaleDateString('en-CA'));
      cur.setDate(cur.getDate() + 1);
    }
    const flightMap = new Map<string, number>();
    const rentalMap = new Map<string, number>();
    const maintMap = new Map<string, number>();

    reports.forEach(r => {
      flightMap.set(r.data, (flightMap.get(r.data) || 0) + (r.voos || []).length);
      (r.locacoes || [])
        .filter((l: any) => l.tipo === 'LOCAR' && l.inicio && l.fim)
        .forEach((l: any) => {
          rentalMap.set(r.data, (rentalMap.get(r.data) || 0) + hoursBilled(l.inicio, l.fim));
        });
    });
    fleetHistory.forEach(h => {
      if (h.status_novo === 'MANUTENCAO') {
        maintMap.set(h.data, (maintMap.get(h.data) || 0) + 1);
      }
    });
    return days.map(d => ({
      date: fmtShortDate(d),
      'Voos': flightMap.get(d) || 0,
      'Locações (h)': rentalMap.get(d) || 0,
      'Env. Manutenção': maintMap.get(d) || 0,
    }));
  }, [reports, fleetHistory, startDate, endDate]);

  // Donut data: Diesel vs Gasolina style — cost by supplier
  const supplierMap = useMemo(() => {
    const map = new Map<string, number>();
    locacoes.forEach(l => {
      const h = hoursBilled(l.inicio, l.fim);
      map.set(l.empresa || 'Outros', (map.get(l.empresa || 'Outros') || 0) + h * (l.valor_hora_brl || 0));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [locacoes]);

  const topSupplierCost = supplierMap[0]?.[1] || 0;
  const topSupplierName = supplierMap[0]?.[0] || '-';

  const dateLabel = startDate === endDate
    ? fmtFullDate(startDate)
    : `${fmtShortDate(startDate)} → ${fmtShortDate(endDate)}`;

  return (
    <div style={{
      background: '#F1F5F9', minHeight: '100%', padding: 24,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      overflowY: 'auto',
    }}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1E293B', margin: 0 }}>Dashboard Gerência</h2>
          <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>Locações externas · Voos · Frota</p>
        </div>
        <div ref={pickerRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowPicker(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8,
              padding: '9px 16px', cursor: 'pointer', fontSize: 14,
              fontWeight: 500, color: '#1E293B', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            <Calendar size={15} color="#64748B" />
            {dateLabel}
          </button>
          {showPicker && (
            <div style={{ position: 'absolute', right: 0, top: 46, zIndex: 200 }}>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onRange={(s, e) => { setStartDate(s); setEndDate(e); setShowPicker(false); }}
              />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
          <p style={{ color: '#64748B', fontWeight: 600, fontSize: 16 }}>Carregando dados...</p>
        </div>
      ) : (
        <>
          {/* ── KPI Cards ──────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginBottom: 24 }}>
            <KpiCard
              title="Total Gasto em Locação"
              value={fmtBRL(totalCost)}
              sub={`${locacoes.length} registro(s) de locação`}
              icon={<DollarSign size={20} />}
              iconColor="#10B981"
            />
            <KpiCard
              title="Número de Locações"
              value={String(totalRentalUnits)}
              sub="horas cobradas no período"
              icon={<Clock size={20} />}
              iconColor="#1E293B"
            />
            <KpiCard
              title="Total de Voos"
              value={String(totalFlights)}
              sub={`em ${reports.length} turno(s) registrado(s)`}
              icon={<Plane size={20} />}
              iconColor="#1E293B"
            />
            <KpiCard
              title="Custo Médio por Hora"
              value={fmtBRL(avgCostPerUnit)}
              sub="valor médio por hora locada"
              icon={<TrendingUp size={20} />}
              iconColor="#EF4444"
            />
          </div>

          {/* ── Row 2: Donut + Custo por Equip + Top 10 ────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 1fr', gap: 24, marginBottom: 24 }}>

            {/* Donut: custo por fornecedor */}
            <SectionCard title="Custo por Fornecedor">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <DonutChart
                  value={topSupplierCost}
                  total={totalCost || 1}
                  label={fmtBRL(totalCost).replace('R$ ', 'R$ ')}
                  color="#1E293B"
                />
                <div style={{ width: '100%' }}>
                  {supplierMap.map(([name, cost], i) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: i === 0 ? '#1E293B' : '#EF4444', flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#1E293B' }}>{name}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>{fmtBRL(cost)}</span>
                    </div>
                  ))}
                  {supplierMap.length === 0 && (
                    <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Nenhuma locação</p>
                  )}
                </div>
              </div>
            </SectionCard>

            {/* Custo por Equipamento */}
            <SectionCard title="Custo por Equipamento (R$)">
              {byEquip.length === 0 ? (
                <p style={{ color: '#94A3B8', textAlign: 'center', padding: '40px 0', fontSize: 14 }}>Nenhuma locação no período</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={byEquip} margin={{ left: 8, right: 16, top: 8, bottom: 48 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748B' }} angle={-40} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="cost" name="R$ Custo" radius={[4, 4, 0, 0]}>
                      {byEquip.map((_, i) => <Cell key={i} fill={i === 0 ? '#EF4444' : '#1E293B'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>

            {/* Top 10 */}
            <SectionCard title="Top 10 Mais Locados (horas)">
              {top10.length === 0 ? (
                <p style={{ color: '#94A3B8', textAlign: 'center', padding: '40px 0', fontSize: 14 }}>Nenhuma locação no período</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={top10} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#64748B' }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#64748B' }} width={90} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="horas" name="Horas Cobradas" radius={[0, 4, 4, 0]}>
                      {top10.map((_, i) => <Cell key={i} fill={i === 0 ? '#EF4444' : '#1E293B'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>
          </div>

          {/* ── Correlation Chart ──────────────────────────────────────────── */}
          <SectionCard
            title="Análise: Voos × Locações × Manutenção"
            subtitle="Compare o volume de voos com as locações e equipamentos enviados para manutenção por dia"
            style={{ marginBottom: 24 }}
          >
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={dailyData} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 13, paddingTop: 12 }}
                  formatter={(value) => <span style={{ color: '#1E293B', fontWeight: 500 }}>{value}</span>}
                />
                <Bar yAxisId="left" dataKey="Voos" fill="#1E293B" radius={[4, 4, 0, 0]} opacity={0.9} />
                <Line yAxisId="left" type="monotone" dataKey="Locações (h)" stroke="#EF4444" strokeWidth={2}
                  dot={{ r: 4, fill: '#fff', stroke: '#EF4444', strokeWidth: 2 }} />
                <Line yAxisId="right" type="monotone" dataKey="Env. Manutenção" stroke="#F59E0B" strokeWidth={2}
                  strokeDasharray="5 3" dot={{ r: 3, fill: '#fff', stroke: '#F59E0B', strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </SectionCard>

          {/* ── Detail Table ───────────────────────────────────────────────── */}
          {byEquip.length > 0 && (
            <SectionCard title="Detalhamento de Locações por Equipamento">
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr>
                    {['Equipamento', 'Horas Cobradas', 'Valor Total'].map((h, i) => (
                      <th key={h} style={{ ...tableStyles.th, textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byEquip.map((row, i) => (
                    <tr
                      key={row.name}
                      style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
                      onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#F8FAFC')}
                    >
                      <td style={{ ...tableStyles.td }}>{row.name}</td>
                      <td style={{ ...tableStyles.td, textAlign: 'right' }}>{row.horas}h</td>
                      <td style={{ ...tableStyles.td, textAlign: 'right' }}>{fmtBRL(row.cost)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={{ ...tableStyles.tfootTd, borderRadius: '0 0 0 8px' }}>Total Geral</td>
                    <td style={{ ...tableStyles.tfootTd, textAlign: 'right' }}>{totalRentalUnits}h</td>
                    <td style={{ ...tableStyles.tfootTd, textAlign: 'right', borderRadius: '0 0 8px 0' }}>{fmtBRL(totalCost)}</td>
                  </tr>
                </tfoot>
              </table>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
};

export default GerenciaDashboard;
