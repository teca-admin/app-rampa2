import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BarChart, Bar, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { supabase } from './supabase';
import { Plane, MessageSquare, Users, UserX, Calendar, CheckSquare } from 'lucide-react';
import {
  fmtShortDate, fmtFullDate, todayStr, firstDayOfCurrentMonth, shiftLabel,
  ChartTooltip, DateRangePicker, tableStyles,
} from './DashboardUtils';

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

// ─── Table card ───────────────────────────────────────────────────────────────
const TableCard: React.FC<{ title: string; children: React.ReactNode; badge?: number }> = ({ title, children, badge }) => (
  <div style={{
    background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: '12px 14px',
    display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
  }}>
    <p style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', margin: '0 0 8px', flexShrink: 0 }}>
      {title}
      {badge !== undefined && badge > 0 && (
        <span style={{ marginLeft: 8, background: '#FEF2F2', color: '#EF4444', fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '1px 8px' }}>{badge}</span>
      )}
    </p>
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{children}</div>
  </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
const CoordDashboard: React.FC = () => {
  const [startDate, setStartDate] = useState(firstDayOfCurrentMonth());
  const [endDate, setEndDate] = useState(todayStr());
  const [showPicker, setShowPicker] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const pickerRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('relatorios_consolidados')
      .select('data, turno, lider, voos, transporte_tripulacao, briefing_inicio, briefing_fim, debriefing_inicio, debriefing_fim, teve_falta, detalhe_falta')
      .gte('data', startDate).lte('data', endDate).order('data');
    setReports(data || []);
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const totalFlights = useMemo(() => reports.reduce((s, r) => s + (r.voos || []).length, 0), [reports]);
  const briefings = useMemo(() => reports.filter(r => r.briefing_inicio).length, [reports]);
  const debriefings = useMemo(() => reports.filter(r => r.debriefing_inicio).length, [reports]);
  const totalTransport = useMemo(() => reports.reduce((s, r) => s + (r.transporte_tripulacao || []).length, 0), [reports]);
  const faltas = useMemo(() => reports.filter(r => r.teve_falta), [reports]);

  // ── Flights per day ───────────────────────────────────────────────────────
  const flightsByDay = useMemo(() => {
    const m = new Map<string, number>();
    reports.forEach(r => m.set(r.data, (m.get(r.data) || 0) + (r.voos || []).length));
    const days: string[] = [];
    const cur = new Date(startDate + 'T00:00:00'), end = new Date(endDate + 'T00:00:00');
    while (cur <= end) { days.push(cur.toLocaleDateString('en-CA')); cur.setDate(cur.getDate() + 1); }
    return days.map(d => ({ date: fmtShortDate(d), voos: m.get(d) || 0 }));
  }, [reports, startDate, endDate]);

  const maxFlights = useMemo(() => Math.max(...flightsByDay.map(d => d.voos), 0), [flightsByDay]);

  // ── Transport by airline ──────────────────────────────────────────────────
  const transportByAirline = useMemo(() => {
    const m = new Map<string, number>();
    reports.forEach(r => (r.transporte_tripulacao || []).forEach((t: any) => {
      const name = t.cia || 'Outros';
      m.set(name, (m.get(name) || 0) + 1);
    }));
    return Array.from(m.entries()).map(([cia, total]) => ({ cia, total })).sort((a, b) => b.total - a.total);
  }, [reports]);

  // ── Briefing/Debriefing records ───────────────────────────────────────────
  const briefDebriefRecords = useMemo(() =>
    reports.filter(r => r.briefing_inicio || r.debriefing_inicio), [reports]);

  const dateLabel = startDate === endDate ? fmtFullDate(startDate) : `${fmtShortDate(startDate)} → ${fmtShortDate(endDate)}`;

  return (
    <div style={{
      height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      padding: '14px 20px', gap: 12, background: '#F1F5F9',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ marginRight: 8 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1E293B', margin: 0, lineHeight: 1 }}>Dashboard Coordenação</h2>
          <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>Voos · Briefings · Transportes · Faltas</p>
        </div>
        <Pill label="Total Voos" value={String(totalFlights)} icon={<Plane size={16} />} />
        <Pill label="Briefings" value={String(briefings)} icon={<MessageSquare size={16} />} />
        <Pill label="Debriefings" value={String(debriefings)} icon={<CheckSquare size={16} />} />
        <Pill label="Transportes" value={String(totalTransport)} icon={<Users size={16} />} />
        <Pill label="Faltas" value={String(faltas.length)} icon={<UserX size={16} />} accent={faltas.length > 0} />
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
          {/* ── Row 1: Voos por Dia + Transportes ── */}
          <div style={{ flex: '0 0 42%', minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ChartCard title="Voos por Dia">
              {flightsByDay.every(d => d.voos === 0) ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ color: '#94A3B8', fontSize: 13 }}>Nenhum voo no período</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={flightsByDay} margin={{ left: 0, right: 8, top: 20, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748B' }} allowDecimals={false} width={28} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="voos" name="Voos" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="voos" position="top" style={{ fontSize: 10, fill: '#1E293B', fontWeight: 700 }} />
                      {flightsByDay.map((entry, i) => (
                        <Cell key={i} fill={entry.voos === maxFlights && maxFlights > 0 ? '#EF4444' : '#1E293B'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Transportes / Migração por Companhia">
              {transportByAirline.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ color: '#94A3B8', fontSize: 13 }}>Nenhum transporte no período</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={transportByAirline} layout="vertical" margin={{ left: 0, right: 44, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#64748B' }} allowDecimals={false} />
                    <YAxis dataKey="cia" type="category" tick={{ fontSize: 10, fill: '#64748B' }} width={90} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="total" name="Transportes" radius={[0, 4, 4, 0]}>
                      <LabelList dataKey="total" position="right" style={{ fontSize: 11, fill: '#1E293B', fontWeight: 700 }} />
                      {transportByAirline.map((_, i) => <Cell key={i} fill={i === 0 ? '#EF4444' : '#1E293B'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* ── Row 2: Briefings table + Faltas table ── */}
          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

            <TableCard title="Briefings e Debriefings" badge={briefDebriefRecords.length}>
              {briefDebriefRecords.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ color: '#94A3B8', fontSize: 13 }}>Nenhum registro no período</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead style={{ position: 'sticky', top: 0 }}>
                    <tr>
                      {['Data', 'Turno', 'Líder', 'Briefing', 'Debriefing'].map((h, i) => (
                        <th key={h} style={{ ...tableStyles.th, textAlign: i >= 3 ? 'center' : 'left', fontSize: 10, padding: '8px 10px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {briefDebriefRecords.map((r, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                        <td style={{ ...tableStyles.td, fontSize: 12, padding: '8px 10px' }}>{fmtFullDate(r.data)}</td>
                        <td style={{ ...tableStyles.td, fontSize: 12, padding: '8px 10px' }}>{shiftLabel(r.turno)}</td>
                        <td style={{ ...tableStyles.td, fontSize: 12, padding: '8px 10px' }}>{r.lider || '—'}</td>
                        <td style={{ ...tableStyles.td, fontSize: 12, padding: '8px 10px', textAlign: 'center' }}>
                          {r.briefing_inicio
                            ? <span style={{ color: '#10B981', fontWeight: 600 }}>{r.briefing_inicio}–{r.briefing_fim || '?'}</span>
                            : <span style={{ color: '#94A3B8' }}>—</span>}
                        </td>
                        <td style={{ ...tableStyles.td, fontSize: 12, padding: '8px 10px', textAlign: 'center' }}>
                          {r.debriefing_inicio
                            ? <span style={{ color: '#10B981', fontWeight: 600 }}>{r.debriefing_inicio}–{r.debriefing_fim || '?'}</span>
                            : <span style={{ color: '#94A3B8' }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </TableCard>

            <TableCard title="Registro de Faltas" badge={faltas.length}>
              {faltas.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
                  <p style={{ color: '#64748B', fontSize: 13, margin: 0 }}>Nenhuma falta no período</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead style={{ position: 'sticky', top: 0 }}>
                    <tr>
                      {['Data', 'Turno', 'Quem Faltou', 'Registrado por'].map(h => (
                        <th key={h} style={{ ...tableStyles.th, textAlign: 'left', fontSize: 10, padding: '8px 10px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {faltas.map((r, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FEF9F9' }}>
                        <td style={{ ...tableStyles.td, fontSize: 12, padding: '8px 10px' }}>{fmtFullDate(r.data)}</td>
                        <td style={{ ...tableStyles.td, fontSize: 12, padding: '8px 10px' }}>{shiftLabel(r.turno)}</td>
                        <td style={{ ...tableStyles.td, fontSize: 12, padding: '8px 10px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
                            {r.detalhe_falta || <span style={{ color: '#94A3B8' }}>Não informado</span>}
                          </span>
                        </td>
                        <td style={{ ...tableStyles.td, fontSize: 12, padding: '8px 10px' }}>{r.lider || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ ...tableStyles.tfootTd, fontSize: 12, padding: '10px 12px' }}>
                        Total: {faltas.length} falta(s) no período
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </TableCard>
          </div>
        </>
      )}
    </div>
  );
};

export default CoordDashboard;
