import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BarChart, Bar, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { supabase } from './supabase';
import { Plane, MessageSquare, Users, UserX, Calendar, CheckSquare, Car, X } from 'lucide-react';
import {
  fmtShortDate, fmtFullDate, todayStr, firstDayOfCurrentMonth, shiftLabel,
  ChartTooltip, DateRangePicker, tableStyles,
} from './DashboardUtils';
import VerProva, { ProvaAberta } from './VerProva';

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

// ─── A célula de horário que abre a prova ────────────────────────────────────
// Mesma aparência de sempre quando não há prova. Com prova, ganha sublinhado
// pontilhado e a mão do cursor: é o único aviso de que ali tem mais coisa.
const CelulaProva: React.FC<{
  inicio: string | null;
  fim: string | null;
  provaId: string | null;
  onAbrir: () => void;
}> = ({ inicio, fim, provaId, onAbrir }) => (
  <td style={{ ...tableStyles.td, fontSize: 12, padding: '8px 10px', textAlign: 'center' }}>
    {!inicio ? (
      <span style={{ color: '#94A3B8' }}>—</span>
    ) : provaId ? (
      <button
        onClick={onAbrir}
        title="Ver a prova: foto e lista de presença"
        style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          color: '#10B981', fontWeight: 600, fontSize: 12,
          textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3,
        }}
      >
        {inicio}–{fim || '?'}
      </button>
    ) : (
      <span style={{ color: '#10B981', fontWeight: 600 }}>{inicio}–{fim || '?'}</span>
    )}
  </td>
);

// ─── O OBS do turno, aberto pelo km (16/09/2026) ───────────────────────────
// Pedido dele: "em alguns registros eles colocam observações e é importante
// que eu consiga clicar e ver, pra entender o motivo de a SPIN andar mais num
// turno que em outro". O OBS é o campo livre da seção 10 do relatório, o mesmo
// que sai no fim da mensagem do WhatsApp. Aqui ele aparece como o líder
// escreveu, com as quebras de linha (pre-wrap): é o texto dele, não é dado.
type ObsAberta = { data: string; turno: string; lider: string; ini: number; fim: number; rodados: number; obs: string };

const VerObs: React.FC<{ item: ObsAberta; onFechar: () => void }> = ({ item, onFechar }) => {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  return (
    <div
      onClick={onFechar}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14, padding: 24, maxWidth: 520, width: '92%',
          maxHeight: '80vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1E293B' }}>
            Km do SPIN · {item.rodados.toLocaleString('pt-BR')} km
          </span>
          <button
            onClick={onFechar}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', padding: 4 }}
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        <p style={{ margin: '0 0 18px', fontSize: 11, color: '#94A3B8', flexShrink: 0 }}>
          {fmtFullDate(item.data)} · {shiftLabel(item.turno)} · {item.lider || 'sem líder'} · {item.ini.toLocaleString('pt-BR')} → {item.fim.toLocaleString('pt-BR')}
        </p>
        <p style={{ margin: '0 0 8px', fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>
          OBS do líder
        </p>
        <div
          className="rolagem-fina"
          style={{
            flex: 1, minHeight: 0, overflowY: 'auto', whiteSpace: 'pre-wrap',
            fontSize: 14, lineHeight: 1.55, color: '#1E293B',
            background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 14px',
          }}
        >
          {item.obs}
        </div>
      </div>
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const CoordDashboard: React.FC = () => {
  const [startDate, setStartDate] = useState(firstDayOfCurrentMonth());
  const [endDate, setEndDate] = useState(todayStr());
  const [showPicker, setShowPicker] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // A prova aberta na tela. Null é o estado normal: ela só abre por clique.
  const [prova, setProva] = useState<ProvaAberta | null>(null);
  // O OBS aberto pelo km. Null é o estado normal: só abre por clique.
  const [obsAberta, setObsAberta] = useState<ObsAberta | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    // 🔥 As colunas do Km do SPIN ficaram FORA desta lista de 10/09 a 16/09/2026.
    // O cálculo lá embaixo lia `r.km_spin_inicial`, que chegava sempre
    // undefined, e todo turno caía em "sem informar": o painel mostrava 0 km
    // com 13 relatórios preenchidos no banco. Ninguém viu porque até 11/09
    // nenhum líder tinha preenchido, e "nenhum turno com km" parecia verdade.
    // Coluna nova no relatório entra AQUI também, senão o painel não a vê.
    const { data } = await supabase
      .from('relatorios_consolidados')
      .select('data, turno, lider, voos, transporte_tripulacao, briefing_inicio, briefing_fim, debriefing_inicio, debriefing_fim, teve_falta, detalhe_falta, briefing_prova_id, briefing_foto, debriefing_prova_id, debriefing_foto, km_spin_inicial, km_spin_final, observacoes')
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
  // ─── Km do SPIN, pedido do coordenador em 10/09/2026 ───────────────────────
  // 🔴 16/09/2026: virou DESCRITIVO, UMA LINHA POR ENVIO, pedido dele ao ver a
  // primeira versão com dado real ("o acumulado não, eu quero o descritivo, por
  // envio"). A soma por tipo de turno, com média, que respondia "qual turno
  // mais usa", SAIU. Se um dia fizer falta, está no commit anterior a este.
  // A ordem é a do envio (data, depois turno), igual ao card de Briefings ao
  // lado, pra uma coluna se ler como continuação da outra.
  //
  // 🔑 O preenchimento é opcional (decisão dele), então "sem km informado" é um
  // número que a tela MOSTRA: sem ele, um turno que ninguém preencheu ficaria
  // indistinguível de um turno em que o carro não rodou.
  //
  // ⚠️ Relatório com final MENOR que o inicial é dígito trocado e não entra na
  // conta. O app novo não deixa gravar assim, mas o histórico pode ter, e uma
  // subtração negativa derrubaria o total do período calada.
  const kmSpin = useMemo(() => {
    const ordemTurno: Record<string, number> = { madrugada: 0, manha: 1, 'manhã': 1, tarde: 2, noite: 3 };
    const linhas: (Omit<ObsAberta, 'obs'> & { obs: string | null })[] = [];
    let semKm = 0, total = 0;
    reports.forEach(r => {
      const ini = r.km_spin_inicial, fim = r.km_spin_final;
      const valido = ini !== null && ini !== undefined
        && fim !== null && fim !== undefined && fim >= ini;
      if (!valido) { semKm++; return; }
      const rodados = fim - ini;
      // OBS só em branco vira null: o clique só existe onde há o que ler.
      const obs = typeof r.observacoes === 'string' && r.observacoes.trim() !== '' ? r.observacoes.trim() : null;
      linhas.push({ data: r.data, turno: String(r.turno || ''), lider: r.lider || '', ini, fim, rodados, obs });
      total += rodados;
    });
    linhas.sort((a, b) => a.data.localeCompare(b.data)
      || (ordemTurno[a.turno] ?? 9) - (ordemTurno[b.turno] ?? 9));
    return { linhas, semKm, total, comKm: linhas.length };
  }, [reports]);

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
        <Pill label="Total Voos" value={String(totalFlights)} icon={<Plane size={16} />} />
        <Pill label="Briefings" value={String(briefings)} icon={<MessageSquare size={16} />} />
        <Pill label="Debriefings" value={String(debriefings)} icon={<CheckSquare size={16} />} />
        <Pill label="Transportes" value={String(totalTransport)} icon={<Users size={16} />} />
        <Pill label="Faltas" value={String(faltas.length)} icon={<UserX size={16} />} accent={faltas.length > 0} />
        <Pill label="Km do SPIN" value={`${kmSpin.total.toLocaleString('pt-BR')} km`} icon={<Car size={16} />} />
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
                      <LabelList dataKey="voos" position="insideTop" style={{ fontSize: 12, fill: '#fff', fontWeight: 700 }} />
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
                      <LabelList dataKey="total" position="insideRight" style={{ fontSize: 12, fill: '#fff', fontWeight: 700 }} />
                      {transportByAirline.map((_, i) => <Cell key={i} fill={i === 0 ? '#EF4444' : '#1E293B'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* ── Row 2: Briefings + Faltas + Km do SPIN ──
              A terceira coluna entrou em 10/09/2026. Ela é mais estreita que as
              outras duas de propósito: são no máximo 4 linhas, uma por turno. */}
          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr 0.8fr', gap: 12 }}>

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
                        {/* 🔑 O HORÁRIO É O BOTÃO. Foi o pedido dele: "clico na
                            hora e abre a prova". Registro sem prova (todos os
                            anteriores a 14/09) continua sendo texto comum, sem
                            sublinhado e sem mão: prometer clique e abrir vazio
                            é pior que não prometer. */}
                        <CelulaProva
                          inicio={r.briefing_inicio} fim={r.briefing_fim}
                          provaId={r.briefing_prova_id}
                          onAbrir={() => setProva({
                            provaId: r.briefing_prova_id, foto: r.briefing_foto || null,
                            titulo: 'Briefing', horario: `${r.briefing_inicio}–${r.briefing_fim || '?'}`,
                            subtitulo: `${fmtFullDate(r.data)} · ${shiftLabel(r.turno)} · ${r.lider || 'sem líder'}`,
                          })}
                        />
                        <CelulaProva
                          inicio={r.debriefing_inicio} fim={r.debriefing_fim}
                          provaId={r.debriefing_prova_id}
                          onAbrir={() => setProva({
                            provaId: r.debriefing_prova_id, foto: r.debriefing_foto || null,
                            titulo: 'Debriefing', horario: `${r.debriefing_inicio}–${r.debriefing_fim || '?'}`,
                            subtitulo: `${fmtFullDate(r.data)} · ${shiftLabel(r.turno)} · ${r.lider || 'sem líder'}`,
                          })}
                        />
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

            <TableCard title="Km do SPIN por envio">
              {kmSpin.comKm === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 14px' }}>
                  <p style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center' }}>
                    Nenhum turno com km informado no período
                  </p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead style={{ position: 'sticky', top: 0 }}>
                    <tr>
                      {['Data', 'Turno', 'Líder', 'Km'].map((h, i) => (
                        <th key={h} style={{ ...tableStyles.th, textAlign: i === 3 ? 'right' : 'left', fontSize: 10, padding: '8px 10px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {kmSpin.linhas.map((l, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                        <td style={{ ...tableStyles.td, fontSize: 12, padding: '8px 10px' }}>{fmtFullDate(l.data)}</td>
                        <td style={{ ...tableStyles.td, fontSize: 12, padding: '8px 10px' }}>{shiftLabel(l.turno)}</td>
                        <td style={{ ...tableStyles.td, fontSize: 12, padding: '8px 10px' }}>{l.lider || '—'}</td>
                        {/* Rodados em cima, de → a embaixo, numa célula só: com
                            cinco colunas o card não cabia a 1440px e a última
                            vazava pra fora. Quatro colunas, como os vizinhos. */}
                        <td style={{ ...tableStyles.td, fontSize: 12, padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {/* 🔑 O KM É O BOTÃO, e só onde há OBS. Linha sem
                              observação fica texto comum, sem sublinhado e
                              sem mão: prometer clique e abrir vazio é pior
                              que não prometer. Mesma regra da prova ao lado. */}
                          {l.obs ? (
                            <button
                              onClick={() => setObsAberta({ ...l, obs: l.obs as string })}
                              title="Ver a observação do líder neste turno"
                              style={{
                                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                                color: '#2563EB', fontWeight: 700, fontSize: 12,
                                textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3,
                              }}
                            >
                              {l.rodados.toLocaleString('pt-BR')} km
                            </button>
                          ) : (
                            <div style={{ fontWeight: 700, color: '#2563EB' }}>{l.rodados.toLocaleString('pt-BR')} km</div>
                          )}
                          <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>
                            {l.ini.toLocaleString('pt-BR')} → {l.fim.toLocaleString('pt-BR')}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ ...tableStyles.tfootTd, fontSize: 11, padding: '10px' }}>
                        Total: {kmSpin.total.toLocaleString('pt-BR')} km em {kmSpin.comKm} envio(s)
                        {kmSpin.semKm > 0 && `, ${kmSpin.semKm} sem informar`}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </TableCard>
          </div>
        </>
      )}

      {prova && <VerProva prova={prova} onFechar={() => setProva(null)} />}
      {obsAberta && <VerObs item={obsAberta} onFechar={() => setObsAberta(null)} />}
    </div>
  );
};

export default CoordDashboard;
