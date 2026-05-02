import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';
import { supabase } from './supabase';
import { Plane, MessageSquare, Users, UserX, Calendar, CheckSquare } from 'lucide-react';
import {
  fmtShortDate, fmtFullDate, todayStr, firstDayOfCurrentMonth, shiftLabel,
  ChartTooltip, KpiCard, SectionCard, DateRangePicker, tableStyles,
} from './DashboardUtils';

// ─── Main Component ───────────────────────────────────────────────────────────
const CoordDashboard: React.FC = () => {
  const [startDate, setStartDate] = useState(firstDayOfCurrentMonth());
  const [endDate, setEndDate] = useState(todayStr());
  const [showPicker, setShowPicker] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const pickerRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('relatorios_consolidados')
        .select(`
          data, turno, lider, voos,
          transporte_tripulacao,
          briefing_inicio, briefing_fim,
          debriefing_inicio, debriefing_fim,
          teve_falta, detalhe_falta
        `)
        .gte('data', startDate)
        .lte('data', endDate)
        .order('data', { ascending: true });
      setReports(data || []);
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

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const totalFlights = useMemo(() =>
    reports.reduce((s, r) => s + (r.voos || []).length, 0), [reports]);

  const briefings = useMemo(() =>
    reports.filter(r => r.briefing_inicio).length, [reports]);

  const debriefings = useMemo(() =>
    reports.filter(r => r.debriefing_inicio).length, [reports]);

  const totalTransport = useMemo(() =>
    reports.reduce((s, r) => s + (r.transporte_tripulacao || []).length, 0), [reports]);

  const faltas = useMemo(() =>
    reports.filter(r => r.teve_falta), [reports]);

  // ── Flights per day ───────────────────────────────────────────────────────
  const flightsByDay = useMemo(() => {
    const map = new Map<string, number>();
    reports.forEach(r => {
      map.set(r.data, (map.get(r.data) || 0) + (r.voos || []).length);
    });
    if (!startDate || !endDate) return [];
    const days: string[] = [];
    const cur = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    while (cur <= end) {
      const d = cur.toLocaleDateString('en-CA');
      days.push(d);
      cur.setDate(cur.getDate() + 1);
    }
    return days.map(d => ({ date: fmtShortDate(d), voos: map.get(d) || 0 }));
  }, [reports, startDate, endDate]);

  // ── Transport by airline ──────────────────────────────────────────────────
  const transportByAirline = useMemo(() => {
    const map = new Map<string, number>();
    reports.forEach(r => {
      (r.transporte_tripulacao || []).forEach((t: any) => {
        const name = t.cia || 'Outros';
        map.set(name, (map.get(name) || 0) + 1);
      });
    });
    return Array.from(map.entries())
      .map(([cia, total]) => ({ cia, total }))
      .sort((a, b) => b.total - a.total);
  }, [reports]);

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
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1E293B', margin: 0 }}>Dashboard Coordenação</h2>
          <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>Voos · Briefings · Transportes · Faltas</p>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 20, marginBottom: 24 }}>
            <KpiCard
              title="Total de Voos"
              value={String(totalFlights)}
              sub={`em ${reports.length} turno(s)`}
              icon={<Plane size={20} />}
              iconColor="#1E293B"
            />
            <KpiCard
              title="Briefings"
              value={String(briefings)}
              sub="realizados no período"
              icon={<MessageSquare size={20} />}
              iconColor="#10B981"
            />
            <KpiCard
              title="Debriefings"
              value={String(debriefings)}
              sub="realizados no período"
              icon={<CheckSquare size={20} />}
              iconColor="#10B981"
            />
            <KpiCard
              title="Transportes / Migração"
              value={String(totalTransport)}
              sub={`${transportByAirline.length} companhia(s)`}
              icon={<Users size={20} />}
              iconColor="#1E293B"
            />
            <KpiCard
              title="Faltas"
              value={String(faltas.length)}
              sub="ocorrências no período"
              icon={<UserX size={20} />}
              iconColor={faltas.length > 0 ? '#EF4444' : '#10B981'}
            />
          </div>

          {/* ── Charts Row ─────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
            {/* Voos por dia */}
            <SectionCard title="Voos por Dia">
              {flightsByDay.every(d => d.voos === 0) ? (
                <p style={{ color: '#94A3B8', textAlign: 'center', padding: '40px 0', fontSize: 14 }}>Nenhum voo registrado no período</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={flightsByDay} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="voos" name="Voos" radius={[4, 4, 0, 0]}>
                      {flightsByDay.map((entry, i) => (
                        <Cell key={i} fill={entry.voos === Math.max(...flightsByDay.map(d => d.voos)) ? '#EF4444' : '#1E293B'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>

            {/* Transportes por companhia */}
            <SectionCard title="Transportes / Migração por Companhia">
              {transportByAirline.length === 0 ? (
                <p style={{ color: '#94A3B8', textAlign: 'center', padding: '40px 0', fontSize: 14 }}>Nenhum transporte registrado no período</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={transportByAirline} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                    <YAxis dataKey="cia" type="category" tick={{ fontSize: 11, fill: '#64748B' }} width={100} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="total" name="Transportes" radius={[0, 4, 4, 0]}>
                      {transportByAirline.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? '#EF4444' : '#1E293B'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>
          </div>

          {/* ── Briefing / Debriefing Detail ──────────────────────────────── */}
          <SectionCard
            title="Briefings e Debriefings Realizados"
            subtitle="Turnos com briefing ou debriefing registrado"
            style={{ marginBottom: 24 }}
          >
            {reports.filter(r => r.briefing_inicio || r.debriefing_inicio).length === 0 ? (
              <p style={{ color: '#94A3B8', fontSize: 14, padding: '20px 0' }}>Nenhum briefing ou debriefing no período.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr>
                    {['Data', 'Turno', 'Líder', 'Briefing', 'Debriefing'].map((h, i) => (
                      <th key={h} style={{ ...tableStyles.th, textAlign: i >= 3 ? 'center' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reports
                    .filter(r => r.briefing_inicio || r.debriefing_inicio)
                    .map((r, i) => (
                      <tr
                        key={i}
                        style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC', transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#F8FAFC')}
                      >
                        <td style={{ ...tableStyles.td }}>{fmtFullDate(r.data)}</td>
                        <td style={{ ...tableStyles.td }}>{shiftLabel(r.turno)}</td>
                        <td style={{ ...tableStyles.td }}>{r.lider || '-'}</td>
                        <td style={{ ...tableStyles.td, textAlign: 'center' }}>
                          {r.briefing_inicio
                            ? <span style={{ color: '#10B981', fontWeight: 600 }}>{r.briefing_inicio} – {r.briefing_fim || '?'}</span>
                            : <span style={{ color: '#94A3B8' }}>—</span>}
                        </td>
                        <td style={{ ...tableStyles.td, textAlign: 'center' }}>
                          {r.debriefing_inicio
                            ? <span style={{ color: '#10B981', fontWeight: 600 }}>{r.debriefing_inicio} – {r.debriefing_fim || '?'}</span>
                            : <span style={{ color: '#94A3B8' }}>—</span>}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </SectionCard>

          {/* ── Faltas Table ────────────────────────────────────────────────── */}
          <SectionCard
            title="Registro de Faltas"
            subtitle="Ausências registradas pelos líderes de turno no período"
          >
            {faltas.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 0' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }} />
                <p style={{ color: '#64748B', fontSize: 14, margin: 0 }}>Nenhuma falta registrada no período. </p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr>
                    {['Data', 'Turno', 'Quem Faltou', 'Registrado por'].map((h, i) => (
                      <th key={h} style={{ ...tableStyles.th, textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {faltas.map((r, i) => (
                    <tr
                      key={i}
                      style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
                      onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#F8FAFC')}
                    >
                      <td style={{ ...tableStyles.td }}>{fmtFullDate(r.data)}</td>
                      <td style={{ ...tableStyles.td }}>{shiftLabel(r.turno)}</td>
                      <td style={{ ...tableStyles.td }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
                          {r.detalhe_falta || <span style={{ color: '#94A3B8' }}>Não informado</span>}
                        </span>
                      </td>
                      <td style={{ ...tableStyles.td }}>{r.lider || '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} style={{ ...tableStyles.tfootTd, borderRadius: '0 0 8px 8px' }}>
                      Total: {faltas.length} falta(s) no período
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
};

export default CoordDashboard;
