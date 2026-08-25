import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BarChart, Bar, ComposedChart, Line, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';
import { supabase } from './supabase';
import { DollarSign, Clock, Plane, Calendar, X, TrendingUp, Scale, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import {
  hoursBilled, calcMinutes, fmtBRL, fmtShortDate, fmtFullDate,
  todayStr, firstDayOfCurrentMonth, shiftLabel,
  ChartTooltip, DateRangePicker, tableStyles,
} from './DashboardUtils';

// Dias entre duas datas no formato YYYY-MM-DD
const diasEntre = (de: string, ate: string): number => {
  const a = new Date(de + 'T00:00:00').getTime();
  const b = new Date(ate + 'T00:00:00').getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
};

const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;

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
  onSelect?: (name: string) => void;
}> = ({ segments, total, label, onSelect }) => {
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
              onClick={() => onSelect?.(name)}
              style={{ cursor: 'pointer', transition: 'all 0.3s ease' }} />
          );
        })}
        <text x={90} y={84} textAnchor="middle" fill="#64748B" fontSize={12} fontFamily="Inter,sans-serif">Total</text>
        <text x={90} y={104} textAnchor="middle" fill="#1E293B" fontSize={16} fontWeight={700} fontFamily="Inter,sans-serif">{label}</text>
      </svg>
    </div>
  );
};

// ─── Rótulos que não somem ───────────────────────────────────────────────────
// Rótulo posicionado dentro da barra desaparece quando a barra é curta, que é
// justamente quando o número é difícil de estimar no olho. Estes medem a barra:
// se o texto não couber dentro, ele sai pra fora e troca de cor.
const RotuloVertical: React.FC<any> = ({ x, y, width, height, value, formatar }) => {
  if (value === 0 || value === null || value === undefined) return null;
  const texto = formatar ? formatar(value) : String(value);
  const cabeDentro = height >= 24;
  return (
    <text
      x={x + width / 2}
      y={cabeDentro ? y + 15 : y - 6}
      textAnchor="middle"
      fill={cabeDentro ? '#fff' : '#1E293B'}
      fontSize={11}
      fontWeight={700}
      style={{ pointerEvents: 'none' }}
    >
      {texto}
    </text>
  );
};

const RotuloHorizontal: React.FC<any> = ({ x, y, width, height, value, formatar }) => {
  if (value === 0 || value === null || value === undefined) return null;
  const texto = formatar ? formatar(value) : String(value);
  const cabeDentro = width >= texto.length * 7 + 16;
  return (
    <text
      x={cabeDentro ? x + width - 8 : x + width + 6}
      y={y + height / 2}
      dominantBaseline="central"
      textAnchor={cabeDentro ? 'end' : 'start'}
      fill={cabeDentro ? '#fff' : '#1E293B'}
      fontSize={11}
      fontWeight={700}
      style={{ pointerEvents: 'none' }}
    >
      {texto}
    </text>
  );
};

// ─── O nome que o gerente usa ────────────────────────────────────────────
// Na boca da operação PUSHBACK é rebocador, então a tela dele fala assim:
// PUSHBACK NARROW aparece como REBOCADOR NARROW, e o mesmo pro WIDE.
// 🔑 É troca de FACHADA e só neste painel. O banco continua gravando
// PUSHBACK, e o nome cru continua sendo a chave do preço (a tabela
// tabela_precos_alocacao casa por nome exato), do agrupamento e do filtro por
// equipamento. Traduzir no dado, e não na hora de desenhar, apagaria o preço
// e quebraria o clique que filtra o gráfico.
const nomeVisivel = (nome: any) => String(nome ?? '').replace(/PUSHBACK/gi, 'REBOCADOR');

// ─── Meio painel financeiro ──────────────────────────────────────────────────
// Receita e Custo leem igual de propósito: mesma barra por dia à esquerda e a
// mesma lista por equipamento à direita, mudando só a cor e o sinal. Assim o
// gerente compara os dois lados sem reaprender a tela no meio do caminho.
const PainelFinanceiro: React.FC<{
  titulo: string;
  subtitulo: string;
  cor: string;
  corFraca: string;
  total: number;
  serie: any[];
  chaveSerie: string;
  linhas: { nome: string; horas: number; valor: number; detalhe: string; alerta: boolean }[];
}> = ({ titulo, subtitulo, cor, corFraca, total, serie, chaveSerie, linhas }) => {
  // O total de horas sai da mesma lista que desenha as linhas, entao o rodape
  // nunca discorda do que esta escrito acima dele.
  const totalHoras = linhas.reduce((soma, l) => soma + l.horas, 0);
  return (
  // A tabela ficava larga demais: o nome do equipamento é curto e sobrava um
  // vão morto antes de Horas e Total. Encolhendo esta coluna, os números vêm
  // pra perto do nome e a largura que sobra vai pro card de Combustível.
  <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>

    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
      boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: '12px 14px',
      display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexShrink: 0, marginBottom: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: cor }}>{titulo}</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#1E293B' }}>{fmtBRL(total)}</span>
        <span style={{ fontSize: 11, color: '#94A3B8' }}>{subtitulo}</span>
      </div>
      <p style={{ margin: '0 0 6px', fontSize: 10, color: '#94A3B8', flexShrink: 0 }}>
        Quantidade por dia. Passe o mouse para ver o valor do dia.
      </p>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={serie} margin={{ left: 0, right: 12, top: 20, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748B' }} interval={0} />
            <YAxis tick={{ fontSize: 9, fill: '#64748B' }} allowDecimals={false} width={24} />
            <Tooltip
              cursor={{ fill: '#F8FAFC' }}
              content={({ active, payload, label }: any) => {
                if (!active || !payload || !payload.length) return null;
                const p = payload[0].payload;
                return (
                  <div style={{
                    background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8,
                    padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1E293B' }}>{label}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748B' }}>
                      {plural(p[chaveSerie], chaveSerie === 'Locações' ? 'locação' : 'alocação',
                        chaveSerie === 'Locações' ? 'locações' : 'alocações')}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: cor }}>
                      {fmtBRL(p._valor)}
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey={chaveSerie} fill={cor} radius={[4, 4, 0, 0]}>
              <LabelList dataKey={chaveSerie} content={<RotuloVertical />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>

    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
      boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: '12px 14px',
      display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
    }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', margin: '0 0 2px', flexShrink: 0 }}>
        {titulo} por Equipamento
      </p>
      <p style={{ margin: '0 0 8px', fontSize: 10, color: '#94A3B8', flexShrink: 0 }}>
        Hora cheia: 1 minuto usado já conta 1 hora
      </p>
      {linhas.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#94A3B8', fontSize: 13 }}>Nada no período</p>
        </div>
      ) : (
        <div className="rolagem-fina" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead style={{ position: 'sticky', top: 0 }}>
              <tr>
                {['Equipamento', 'Horas', 'Total'].map(h => (
                  <th
                    key={h}
                    style={{
                      ...tableStyles.th, fontSize: 10,
                      textAlign: h === 'Equipamento' ? 'left' : 'right',
                      // Sem largura fixa nas duas últimas, a primeira estica e
                      // empurra os números pro canto direito da tela.
                      // Total ficou mais largo e Horas ganhou respiro à direita:
                      // no rodapé os dois números são grandes e encostavam um no
                      // outro. A largura do card não muda, porque quem cede o
                      // espaço é a coluna Equipamento, que é 'auto'.
                      width: h === 'Equipamento' ? 'auto' : (h === 'Horas' ? 62 : 112),
                      paddingRight: h === 'Horas' ? 14 : undefined,
                      whiteSpace: 'nowrap',
                    }}
                  >{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={l.nome} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                  <td style={{ ...tableStyles.td, fontSize: 12, padding: '6px 8px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cor, flexShrink: 0 }} />
                      {nomeVisivel(l.nome)}
                    </span>
                    {l.detalhe && (
                      <span style={{
                        marginLeft: 5, fontSize: 10, fontWeight: 600,
                        color: l.alerta ? '#B45309' : '#94A3B8',
                        background: l.alerta ? '#FFFBEB' : 'transparent',
                        borderRadius: 20, padding: l.alerta ? '1px 6px' : 0,
                      }}>
                        {l.detalhe}
                      </span>
                    )}
                  </td>
                  <td style={{ ...tableStyles.td, fontSize: 12, padding: '6px 14px 6px 8px', color: '#475569', textAlign: 'right' }}>{l.horas}h</td>
                  <td style={{ ...tableStyles.td, fontSize: 12, padding: '6px 8px', fontWeight: 700, color: '#1E293B', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {fmtBRL(l.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ ...tableStyles.td, fontSize: 11, padding: '8px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', borderTop: '2px solid #E2E8F0' }}>
                  Total
                </td>
                <td style={{ ...tableStyles.td, fontSize: 13, padding: '8px 14px 8px 8px', fontWeight: 700, color: '#475569', textAlign: 'right', whiteSpace: 'nowrap', borderTop: '2px solid #E2E8F0' }}>
                  {totalHoras}h
                </td>
                <td style={{ ...tableStyles.td, fontSize: 13, padding: '8px', fontWeight: 700, color: cor, textAlign: 'right', whiteSpace: 'nowrap', borderTop: '2px solid #E2E8F0', background: corFraca }}>
                  {fmtBRL(total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
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
const ChartCard: React.FC<{ title: string; dica?: string; children: React.ReactNode }> = ({ title, dica, children }) => (
  <div style={{
    background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: '12px 14px',
    display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
  }}>
    <p style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', margin: '0 0 8px', flexShrink: 0 }}>
      {title}
      {dica && (
        <span style={{ fontSize: 11, fontWeight: 500, color: '#94A3B8', marginLeft: 8 }}>{dica}</span>
      )}
    </p>
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
  const [equipNames, setEquipNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [expandedMaint, setExpandedMaint] = useState<any | null>(null);
  // O painel da Gerência é o dele: fica sempre à mostra, sem guia. O único
  // desvio é Receita x Custos, que é assunto do gerente e não do dia a dia.
  const [painel, setPainel] = useState<'locacoes' | 'receita'>('locacoes');
  const [precosAlocacao, setPrecosAlocacao] = useState<Map<string, number>>(new Map());
  const [combustivel, setCombustivel] = useState<any[]>([]);
  const [formCombustivel, setFormCombustivel] = useState<null | { data: string; tipo: 'GASOLINA' | 'DIESEL'; litros: string }>(null);
  const [salvandoCombustivel, setSalvandoCombustivel] = useState(false);
  const [erroCombustivel, setErroCombustivel] = useState('');
  const [excluirCombustivel, setExcluirCombustivel] = useState<any | null>(null);
  const [abaManutencao, setAbaManutencao] = useState<'parados' | 'voltaram' | 'operacao'>('parados');
  const [diaDetalhe, setDiaDetalhe] = useState<string | null>(null);
  const [equipStatus, setEquipStatus] = useState<Map<string, string>>(new Map());
  const pickerRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: reps }, { data: hist, error: histError }, { data: equips }, { data: precos }, { data: comb }] = await Promise.all([
      supabase.from('relatorios_consolidados')
        .select('data, turno, lider, locacoes, voos')
        .gte('data', startDate).lte('data', endDate).order('data'),
      // Histórico SEM recorte de data de propósito: o retorno de um equipamento
      // costuma cair fora do período escolhido, e sem ele não dá pra saber quem
      // ainda está parado. O recorte é aplicado depois, na hora de exibir.
      supabase.from('historico_status_equipamentos')
        .select('prefixo, status_novo, data, turno, lider, motivo, registrado_em')
        .order('data'),
      supabase.from('equipamentos').select('prefixo, nome, status'),
      // Preço do que NÓS alugamos para terceiros. A tabela pode ainda não
      // existir no banco: nesse caso o painel mostra o que falta cadastrar
      // em vez de quebrar.
      supabase.from('tabela_precos_alocacao').select('equipamento, valor_hora'),
      // Abastecimento é digitado à mão aqui na Gerência, não vem do relatório
      // do líder. Segue o mesmo período escolhido no topo.
      supabase.from('registros_combustivel')
        .select('id, data, tipo, litros')
        .gte('data', startDate).lte('data', endDate)
        .order('data', { ascending: false }),
    ]);
    if (histError) console.error('[Manutenção] erro:', histError);
    setReports(reps || []);
    setFleetHistory(hist || []);
    if (equips) {
      const m = new Map<string, string>();
      const st = new Map<string, string>();
      equips.forEach((e: any) => { m.set(e.prefixo, e.nome); st.set(e.prefixo, e.status); });
      setEquipNames(m);
      setEquipStatus(st);
    }
    setCombustivel(comb || []);
    if (precos) {
      const pm = new Map<string, number>();
      precos.forEach((r: any) => pm.set(r.equipamento, Number(r.valor_hora) || 0));
      setPrecosAlocacao(pm);
    }
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

  // ── Locações base com data do relatório ───────────────────────────────────
  const locacoes = useMemo(() =>
    reports.flatMap(r =>
      (r.locacoes || [])
        .filter((l: any) => l.tipo === 'LOCAR' && l.inicio && l.fim)
        .map((l: any) => ({ ...l, _date: r.data }))
    ), [reports]);

  // ── Pills globais (nunca filtrados) ───────────────────────────────────────
  const totalCost = useMemo(() =>
    locacoes.reduce((s: number, l: any) => s + hoursBilled(l.inicio, l.fim) * (l.valor_hora_brl || 0), 0), [locacoes]);

  const totalUnits = useMemo(() =>
    locacoes.reduce((s: number, l: any) => s + hoursBilled(l.inicio, l.fim), 0), [locacoes]);

  const totalFlights = useMemo(() =>
    reports.reduce((s, r) => s + (r.voos || []).length, 0), [reports]);

  // ── Fontes filtradas separadamente ────────────────────────────────────────
  // Filtrado só por fornecedor → alimenta o card de equipamentos
  const supplierFilteredLocacoes = useMemo(() =>
    selectedSupplier ? locacoes.filter((l: any) => l.empresa === selectedSupplier) : locacoes,
    [locacoes, selectedSupplier]);

  // Filtrado só por equipamento → alimenta o card de fornecedores
  const equipmentFilteredLocacoes = useMemo(() =>
    selectedEquipment ? locacoes.filter((l: any) => l.equipamento === selectedEquipment) : locacoes,
    [locacoes, selectedEquipment]);

  // Filtrado pelos dois → alimenta o gráfico de análise diária
  const fullyFilteredLocacoes = useMemo(() =>
    selectedEquipment ? supplierFilteredLocacoes.filter((l: any) => l.equipamento === selectedEquipment) : supplierFilteredLocacoes,
    [supplierFilteredLocacoes, selectedEquipment]);

  // ── Custo por fornecedor (responde ao filtro de equipamento) ──────────────
  const supplierMapAll = useMemo(() => {
    const m = new Map<string, number>();
    equipmentFilteredLocacoes.forEach((l: any) => {
      const h = hoursBilled(l.inicio, l.fim);
      m.set(l.empresa || 'Outros', (m.get(l.empresa || 'Outros') || 0) + h * (l.valor_hora_brl || 0));
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [equipmentFilteredLocacoes]);

  // Se fornecedor selecionado: mostra só ele (os outros desaparecem)
  const supplierMap = useMemo(() =>
    selectedSupplier ? supplierMapAll.filter(([name]) => name === selectedSupplier) : supplierMapAll,
    [supplierMapAll, selectedSupplier]);

  const supplierTotal = useMemo(() =>
    supplierMap.reduce((s, [, v]) => s + v, 0), [supplierMap]);

  const supplierBadgeCost = useMemo(() =>
    supplierFilteredLocacoes.reduce((s: number, l: any) => s + hoursBilled(l.inicio, l.fim) * (l.valor_hora_brl || 0), 0),
    [supplierFilteredLocacoes]);

  // ── Custo por equipamento (responde ao filtro de fornecedor) ─────────────
  const byEquipAll = useMemo(() => {
    const m = new Map<string, { cost: number; horas: number }>();
    supplierFilteredLocacoes.forEach((l: any) => {
      const h = hoursBilled(l.inicio, l.fim);
      const c = h * (l.valor_hora_brl || 0);
      const p = m.get(l.equipamento) || { cost: 0, horas: 0 };
      m.set(l.equipamento, { cost: p.cost + c, horas: p.horas + h });
    });
    return Array.from(m.entries())
      .map(([name, v]) => ({ name, cost: +v.cost.toFixed(2), horas: v.horas }))
      .sort((a, b) => b.cost - a.cost);
  }, [supplierFilteredLocacoes]);

  // Se equipamento selecionado: mostra só ele (os outros desaparecem)
  const byEquip = useMemo(() =>
    selectedEquipment ? byEquipAll.filter(e => e.name === selectedEquipment) : byEquipAll,
    [byEquipAll, selectedEquipment]);

  const top10All = useMemo(() => [...byEquipAll].sort((a, b) => b.horas - a.horas).slice(0, 10), [byEquipAll]);

  const top10 = useMemo(() =>
    selectedEquipment ? top10All.filter(e => e.name === selectedEquipment) : top10All,
    [top10All, selectedEquipment]);

  const equipBadgeCost = useMemo(() =>
    equipmentFilteredLocacoes.reduce((s: number, l: any) => s + hoursBilled(l.inicio, l.fim) * (l.valor_hora_brl || 0), 0),
    [equipmentFilteredLocacoes]);

  // ── Análise diária (responde aos dois filtros) ────────────────────────────
  const dailyData = useMemo(() => {
    const days: string[] = [];
    const cur = new Date(startDate + 'T00:00:00'), end = new Date(endDate + 'T00:00:00');
    while (cur <= end) { days.push(cur.toLocaleDateString('en-CA')); cur.setDate(cur.getDate() + 1); }
    const fm = new Map<string, number>(), rm = new Map<string, number>();
    reports.forEach(r => {
      fm.set(r.data, (fm.get(r.data) || 0) + (r.voos || []).length);
    });
    fullyFilteredLocacoes.forEach((l: any) => {
      rm.set(l._date, (rm.get(l._date) || 0) + hoursBilled(l.inicio, l.fim));
    });
    return days.map(d => ({ date: fmtShortDate(d), _iso: d, 'Voos': fm.get(d) || 0, 'Locações (h)': rm.get(d) || 0 }));
  }, [reports, fullyFilteredLocacoes, startDate, endDate]);

  // ── Manutenção: ciclos de ida e volta, não eventos soltos ────────────────
  // O card antigo listava todo evento de baixa do período, então o mesmo
  // equipamento aparecia uma vez por vez que quebrou, e quem já tinha voltado
  // continuava na lista. Aqui cada baixa é casada com o retorno seguinte.
  const ciclosManutencao = useMemo(() => {
    const porEquip = new Map<string, any[]>();
    [...fleetHistory]
      .sort((a, b) => a.data === b.data
        ? String(a.registrado_em || '').localeCompare(String(b.registrado_em || ''))
        : String(a.data).localeCompare(String(b.data)))
      .forEach(h => {
        if (!porEquip.has(h.prefixo)) porEquip.set(h.prefixo, []);
        porEquip.get(h.prefixo)!.push(h);
      });

    const ciclos: any[] = [];
    porEquip.forEach((eventos, prefixo) => {
      let aberto: any = null;
      eventos.forEach(ev => {
        if (ev.status_novo === 'MANUTENCAO') {
          // Baixa em cima de baixa: o equipamento já está parado, vale a primeira
          if (!aberto) aberto = ev;
        } else if (ev.status_novo === 'OPERACIONAL' && aberto) {
          ciclos.push({ prefixo, entrada: aberto, retorno: ev });
          aberto = null;
        }
      });
      if (aberto) ciclos.push({ prefixo, entrada: aberto, retorno: null });
    });
    return ciclos;
  }, [fleetHistory]);

  // Ainda parados: estado de agora, não responde ao filtro de período
  const paradosAgora = useMemo(() =>
    ciclosManutencao
      .filter(c => !c.retorno)
      .map(c => ({ ...c, dias: diasEntre(c.entrada.data, todayStr()) }))
      .sort((a, b) => b.dias - a.dias),
    [ciclosManutencao]);

  // Voltaram: aí sim dentro do período escolhido
  const voltaramNoPeriodo = useMemo(() =>
    ciclosManutencao
      .filter(c => c.retorno && c.retorno.data >= startDate && c.retorno.data <= endDate)
      .map(c => ({ ...c, dias: diasEntre(c.entrada.data, c.retorno.data) }))
      .sort((a, b) => String(b.retorno.data).localeCompare(String(a.retorno.data))),
    [ciclosManutencao, startDate, endDate]);

  // Em operação agora: o que a frota tem de pé neste instante. Não é registro,
  // é equipamento, e por isso vem da coluna `status` do cadastro da frota, não
  // do histórico. Quem está em "Parados agora" é retirado na mão: se o cadastro
  // e o histórico discordarem, o equipamento não pode aparecer nas duas abas.
  const emOperacaoAgora = useMemo(() => {
    const parados = new Set(paradosAgora.map((c: any) => c.prefixo));
    return [...equipStatus.entries()]
      .filter(([prefixo, status]) => String(status).toUpperCase() === 'OPERACIONAL' && !parados.has(prefixo))
      .map(([prefixo]) => ({ prefixo, nome: equipNames.get(prefixo) || prefixo }))
      // Ordena pelo nome que aparece na tela, senao REBOCADOR ficaria ordenado
      // pela letra P, que ninguem enxerga.
      .sort((a, b) => nomeVisivel(a.nome).localeCompare(nomeVisivel(b.nome)) || a.prefixo.localeCompare(b.prefixo));
  }, [equipStatus, equipNames, paradosAgora]);

  const listaManutencao = abaManutencao === 'parados' ? paradosAgora : voltaramNoPeriodo;



  // ── Detalhe de um dia: o que aconteceu naquela barra ─────────────────────
  // Um dia pode ter mais de um relatório, um por turno, então tudo é juntado
  // guardando de qual turno e de qual líder veio cada linha.
  const detalheDoDia = useMemo(() => {
    if (!diaDetalhe) return null;
    const doDia = reports.filter(r => r.data === diaDetalhe);
    const voos = doDia.flatMap((r: any) =>
      (r.voos || []).map((v: any) => ({ ...v, _turno: r.turno, _lider: r.lider })));
    const equipamentos = doDia.flatMap((r: any) =>
      (r.locacoes || []).map((l: any) => ({ ...l, _turno: r.turno, _lider: r.lider })));
    return { data: diaDetalhe, turnos: doDia.length, voos, equipamentos };
  }, [diaDetalhe, reports]);

  // ── Alocações internas (tipo ALOCAR): equipamento nosso emprestado ───────
  const alocacoes = useMemo(() =>
    reports.flatMap(r =>
      (r.locacoes || [])
        .filter((l: any) => l.tipo === 'ALOCAR' && l.inicio && l.fim)
        .map((l: any) => ({
          ...l,
          _date: r.data,
          _turno: r.turno,
          _lider: r.lider,
          // Alocação dura minutos, não horas cheias: arredondar pra cima como
          // se faz na locação cobrada dobraria o número e mentiria o painel.
          _minutos: calcMinutes(l.inicio, l.fim),
        }))
    ), [reports]);

  // ── Receita x Custos ─────────────────────────────────────────────────────
  // Receita = alocação, equipamento nosso alugado para terceiro.
  // Custo   = locação, equipamento de terceiro que nós alugamos.
  // Nos dois lados a cobrança é por HORA CHEIA: 1 minuto usado já é 1 hora,
  // 1h01 são 2 horas. É por isso que aqui se usa hoursBilled e não a duração
  // real, que é o número que aparece no painel de Alocações.
  const receitaPorEquip = useMemo(() => {
    const m = new Map<string, { vezes: number; horas: number }>();
    alocacoes.forEach((a: any) => {
      const nome = equipNames.get(a.equipamento) || a.equipamento;
      const atual = m.get(nome) || { vezes: 0, horas: 0 };
      m.set(nome, { vezes: atual.vezes + 1, horas: atual.horas + hoursBilled(a.inicio, a.fim) });
    });
    return [...m.entries()]
      .map(([nome, v]) => {
        const preco = precosAlocacao.get(nome);
        return {
          nome,
          vezes: v.vezes,
          horas: v.horas,
          precoHora: preco ?? null,
          valor: (preco ?? 0) * v.horas,
        };
      })
      .sort((a, b) => b.valor - a.valor || b.horas - a.horas);
  }, [alocacoes, equipNames, precosAlocacao]);

  const receitaTotal = useMemo(() =>
    receitaPorEquip.reduce((s, e) => s + e.valor, 0), [receitaPorEquip]);

  const equipSemPreco = useMemo(() =>
    receitaPorEquip.filter(e => e.precoHora === null), [receitaPorEquip]);

  const custoPorEquip = useMemo(() => {
    const m = new Map<string, { vezes: number; horas: number; valor: number; empresa: string }>();
    locacoes.forEach((l: any) => {
      const chave = l.equipamento || 'Sem equipamento';
      const atual = m.get(chave) || { vezes: 0, horas: 0, valor: 0, empresa: l.empresa || '' };
      const h = hoursBilled(l.inicio, l.fim);
      m.set(chave, {
        vezes: atual.vezes + 1,
        horas: atual.horas + h,
        valor: atual.valor + h * (l.valor_hora_brl || 0),
        empresa: atual.empresa || l.empresa || '',
      });
    });
    return [...m.entries()]
      .map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => b.valor - a.valor);
  }, [locacoes]);

  // Uma série por dia com quantidade e dinheiro juntos, para o gráfico mostrar
  // o número (que foi o pedido) e o tooltip mostrar quanto aquilo deu.
  const serieDiaria = useCallback((registros: any[], valorDe: (r: any) => number, rotulo: string) => {
    const days: string[] = [];
    const cur = new Date(startDate + 'T00:00:00'), end = new Date(endDate + 'T00:00:00');
    while (cur <= end) { days.push(cur.toLocaleDateString('en-CA')); cur.setDate(cur.getDate() + 1); }
    const qtd = new Map<string, number>(), din = new Map<string, number>();
    registros.forEach((r: any) => {
      qtd.set(r._date, (qtd.get(r._date) || 0) + 1);
      din.set(r._date, (din.get(r._date) || 0) + valorDe(r));
    });
    return days.map(d => ({
      date: fmtShortDate(d),
      _iso: d,
      [rotulo]: qtd.get(d) || 0,
      _valor: din.get(d) || 0,
    }));
  }, [startDate, endDate]);

  const receitaPorDia = useMemo(() =>
    serieDiaria(alocacoes, (a: any) => {
      const preco = precosAlocacao.get(equipNames.get(a.equipamento) || a.equipamento) ?? 0;
      return preco * hoursBilled(a.inicio, a.fim);
    }, 'Alocações'),
    [alocacoes, precosAlocacao, equipNames, serieDiaria]);

  const custoPorDia = useMemo(() =>
    serieDiaria(locacoes, (l: any) => hoursBilled(l.inicio, l.fim) * (l.valor_hora_brl || 0), 'Locações'),
    [locacoes, serieDiaria]);


  const litrosPorTipo = useMemo(() => {
    const m = new Map<string, number>();
    combustivel.forEach((c: any) => m.set(c.tipo, (m.get(c.tipo) || 0) + Number(c.litros)));
    return m;
  }, [combustivel]);

  const litrosTotal = useMemo(() =>
    combustivel.reduce((t: number, c: any) => t + Number(c.litros), 0), [combustivel]);

  const abrirFormCombustivel = () => {
    setErroCombustivel('');
    setFormCombustivel({ data: todayStr(), tipo: 'DIESEL', litros: '' });
  };

  const salvarCombustivel = async () => {
    if (!formCombustivel) return;
    const litros = parseFloat(String(formCombustivel.litros).replace(',', '.'));
    if (!formCombustivel.data) { setErroCombustivel('Escolha a data do abastecimento.'); return; }
    if (!litros || litros <= 0) { setErroCombustivel('Informe quantos litros foram abastecidos.'); return; }

    setSalvandoCombustivel(true);
    const { error } = await supabase.from('registros_combustivel').insert([{
      data: formCombustivel.data,
      tipo: formCombustivel.tipo,
      litros,
    }]);
    setSalvandoCombustivel(false);

    if (error) { setErroCombustivel(error.message); return; }
    setFormCombustivel(null);
    fetchData();
  };

  const confirmarExclusaoCombustivel = async () => {
    if (!excluirCombustivel) return;
    await supabase.from('registros_combustivel').delete().eq('id', excluirCombustivel.id);
    setExcluirCombustivel(null);
    fetchData();
  };

  const dateLabel = startDate === endDate
    ? fmtFullDate(startDate)
    : `${fmtShortDate(startDate)} → ${fmtShortDate(endDate)}`;

  const handleSupplierClick = (name: string) => {
    setSelectedSupplier(prev => prev === name ? null : name);
    setSelectedEquipment(null);
  };

  const handleEquipmentClick = (data: any) => {
    setSelectedEquipment(prev => prev === data.name ? null : data.name);
    setSelectedSupplier(null);
  };

  return (
    <div style={{
      height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      padding: '14px 20px', gap: 12, background: '#F1F5F9',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>

      {/* A barra nativa do Windows é grossa e cinza, e rouba largura útil das
          tabelas. Esta fica por cima do conteúdo, some quando não precisa e
          só escurece quando o mouse encosta. */}
      <style>{`
        .rolagem-fina { scrollbar-width: thin; scrollbar-color: #CBD5E1 transparent; }
        .rolagem-fina::-webkit-scrollbar { width: 6px; height: 6px; }
        .rolagem-fina::-webkit-scrollbar-track { background: transparent; }
        .rolagem-fina::-webkit-scrollbar-thumb {
          background: #E2E8F0;
          border-radius: 999px;
        }
        .rolagem-fina:hover::-webkit-scrollbar-thumb { background: #CBD5E1; }
        .rolagem-fina::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
        .rolagem-fina::-webkit-scrollbar-corner { background: transparent; }
      `}</style>

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
                <span style={{ fontSize: 16, fontWeight: 700, color: '#1E293B' }}>
                  {nomeVisivel(equipNames.get(expandedMaint.prefixo) || expandedMaint.prefixo)}
                  <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 400, marginLeft: 6 }}>({expandedMaint.prefixo})</span>
                </span>
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
            <div style={{ marginBottom: 18 }}>
              <p style={{ margin: '0 0 3px', fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Situação</p>
              {expandedMaint._retorno ? (
                <p style={{ margin: 0, fontSize: 14, color: '#10B981', fontWeight: 600 }}>
                  Voltou em {fmtFullDate(expandedMaint._retorno.data)}, depois de {plural(expandedMaint._dias, 'dia parado', 'dias parado')}
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: 14, color: '#EF4444', fontWeight: 600 }}>
                  Ainda parado, {plural(expandedMaint._dias, 'dia', 'dias')} até hoje
                </p>
              )}
            </div>
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Defeito Registrado</p>
              <p style={{ margin: 0, fontSize: 14, color: '#475569', lineHeight: 1.7 }}>{expandedMaint.motivo || 'Sem descrição registrada.'}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Detalhe do dia ── */}
      {detalheDoDia && (
        <div
          onClick={() => setDiaDetalhe(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 14, padding: 24, maxWidth: 680, width: '92%',
              maxHeight: '86vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#1E293B' }}>
                {fmtFullDate(detalheDoDia.data)}
              </span>
              <button
                onClick={() => setDiaDetalhe(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ margin: '0 0 18px', fontSize: 11, color: '#94A3B8', flexShrink: 0 }}>
              {plural(detalheDoDia.turnos, 'turno entregue', 'turnos entregues')} ·{' '}
              {plural(detalheDoDia.voos.length, 'voo', 'voos')} ·{' '}
              {plural(detalheDoDia.equipamentos.length, 'equipamento', 'equipamentos')}
            </p>

            <div className="rolagem-fina" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'grid', gap: 20 }}>

              {/* Voos do dia */}
              <div>
                <p style={{ margin: '0 0 8px', fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Voos Atendidos
                </p>
                {detalheDoDia.voos.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: '#94A3B8' }}>Nenhum voo registrado neste dia.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                    <thead>
                      <tr>
                        {['Companhia', 'Voo', 'Início', 'Fim', 'Turno'].map(h => (
                          <th key={h} style={{ ...tableStyles.th, textAlign: 'left', fontSize: 10 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detalheDoDia.voos.map((v: any, i: number) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                          <td style={{ ...tableStyles.td, fontSize: 12, padding: '6px 8px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <Plane size={12} color="#1E293B" />
                              {v.companhia}
                            </span>
                          </td>
                          <td style={{ ...tableStyles.td, fontSize: 12, padding: '6px 8px', color: '#475569' }}>{v.numero || 'S/N'}</td>
                          <td style={{ ...tableStyles.td, fontSize: 12, padding: '6px 8px', color: '#475569' }}>{v.inicio || '--:--'}</td>
                          <td style={{ ...tableStyles.td, fontSize: 12, padding: '6px 8px', color: '#475569' }}>{v.fim || '--:--'}</td>
                          <td style={{ ...tableStyles.td, fontSize: 11, padding: '6px 8px', color: '#94A3B8', whiteSpace: 'nowrap' }}>
                            {shiftLabel(v._turno)} · {v._lider}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Equipamentos do dia */}
              <div>
                <p style={{ margin: '0 0 8px', fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Equipamentos
                </p>
                {detalheDoDia.equipamentos.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: '#94A3B8' }}>Nenhuma locação ou alocação neste dia.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                    <thead>
                      <tr>
                        {['Tipo', 'Equipamento', 'Horário', 'Origem', 'Turno'].map(h => (
                          <th key={h} style={{ ...tableStyles.th, textAlign: 'left', fontSize: 10 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detalheDoDia.equipamentos.map((l: any, i: number) => {
                        const externa = l.tipo === 'LOCAR';
                        return (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                            <td style={{ ...tableStyles.td, fontSize: 11, padding: '6px 8px', whiteSpace: 'nowrap' }}>
                              <span style={{
                                background: externa ? '#FFF7ED' : '#EFF6FF',
                                color: externa ? '#EA580C' : '#3B82F6',
                                fontWeight: 700, borderRadius: 20, padding: '1px 8px',
                              }}>
                                {externa ? 'Locado' : 'Nosso'}
                              </span>
                            </td>
                            <td style={{ ...tableStyles.td, fontSize: 12, padding: '6px 8px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {nomeVisivel(externa ? l.equipamento : (equipNames.get(l.equipamento) || l.equipamento))}
                              {!externa && (
                                <span style={{ color: '#94A3B8', fontWeight: 500, marginLeft: 5, fontSize: 10 }}>{l.equipamento}</span>
                              )}
                            </td>
                            <td style={{ ...tableStyles.td, fontSize: 12, padding: '6px 8px', color: '#475569', whiteSpace: 'nowrap' }}>
                              {l.inicio} às {l.fim}
                            </td>
                            <td style={{ ...tableStyles.td, fontSize: 12, padding: '6px 8px', color: '#475569', whiteSpace: 'nowrap' }}>
                              {externa
                                ? `${l.empresa || 'Fornecedor'}${l.valor_hora_brl ? ' · ' + fmtBRL(hoursBilled(l.inicio, l.fim) * l.valor_hora_brl) : ''}`
                                : 'Frota WFS'}
                            </td>
                            <td style={{ ...tableStyles.td, fontSize: 11, padding: '6px 8px', color: '#94A3B8', whiteSpace: 'nowrap' }}>
                              {shiftLabel(l._turno)} · {l._lider}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Registrar abastecimento ── */}
      {formCombustivel && (
        <div
          onClick={() => !salvandoCombustivel && setFormCombustivel(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 14, padding: 24, maxWidth: 380, width: '90%',
              boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#1E293B' }}>Registrar abastecimento</span>
              <button
                onClick={() => setFormCombustivel(null)}
                disabled={salvandoCombustivel}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Data
                </label>
                <input
                  type="date"
                  value={formCombustivel.data}
                  onChange={e => setFormCombustivel({ ...formCombustivel, data: e.target.value })}
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 14,
                    border: '1px solid #E2E8F0', borderRadius: 8, color: '#1E293B',
                    fontFamily: 'inherit', outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Tipo de combustível
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['DIESEL', 'GASOLINA'] as const).map(t => {
                    const ativo = formCombustivel.tipo === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setFormCombustivel({ ...formCombustivel, tipo: t })}
                        style={{
                          flex: 1, padding: '10px 0', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                          background: ativo ? '#1E293B' : '#fff',
                          color: ativo ? '#fff' : '#64748B',
                          border: `1px solid ${ativo ? '#1E293B' : '#E2E8F0'}`,
                          borderRadius: 8, transition: 'all 0.15s ease', fontFamily: 'inherit',
                        }}
                      >
                        {t === 'DIESEL' ? 'Diesel' : 'Gasolina'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Quantidade de litros
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  value={formCombustivel.litros}
                  onChange={e => setFormCombustivel({ ...formCombustivel, litros: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') salvarCombustivel(); }}
                  autoFocus
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 14,
                    border: '1px solid #E2E8F0', borderRadius: 8, color: '#1E293B',
                    fontFamily: 'inherit', outline: 'none',
                  }}
                />
              </div>

              {erroCombustivel && (
                <p style={{ margin: 0, fontSize: 12, color: '#EF4444', fontWeight: 600 }}>{erroCombustivel}</p>
              )}

              <button
                onClick={salvarCombustivel}
                disabled={salvandoCombustivel}
                style={{
                  width: '100%', padding: '12px 0', background: '#1E293B', color: '#fff',
                  border: 'none', borderRadius: 8, cursor: salvandoCombustivel ? 'default' : 'pointer',
                  fontSize: 14, fontWeight: 700, fontFamily: 'inherit', opacity: salvandoCombustivel ? 0.5 : 1,
                }}
              >
                {salvandoCombustivel ? 'Salvando...' : 'Salvar registro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmar exclusão do abastecimento ── */}
      {excluirCombustivel && (
        <div
          onClick={() => setExcluirCombustivel(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 14, padding: 24, maxWidth: 360, width: '90%',
              boxShadow: '0 24px 64px rgba(0,0,0,0.25)', textAlign: 'center',
            }}
          >
            <AlertTriangle size={30} color="#EF4444" style={{ marginBottom: 10 }} />
            <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#1E293B' }}>
              Excluir este abastecimento?
            </p>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>
              Você vai apagar o registro de{' '}
              <strong>{Number(excluirCombustivel.litros).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L
              de {excluirCombustivel.tipo === 'DIESEL' ? 'diesel' : 'gasolina'}</strong>{' '}
              do dia {fmtFullDate(excluirCombustivel.data)}. Isso não tem volta.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setExcluirCombustivel(null)}
                style={{
                  flex: 1, padding: '11px 0', background: '#fff', color: '#64748B',
                  border: '1px solid #E2E8F0', borderRadius: 8, cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                }}
              >
                Manter
              </button>
              <button
                onClick={confirmarExclusaoCombustivel}
                style={{
                  flex: 1, padding: '11px 0', background: '#EF4444', color: '#fff',
                  border: 'none', borderRadius: 8, cursor: 'pointer',
                  fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                }}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
        {painel === 'locacoes' ? (
          <>
            <Pill label="Total Locação" value={fmtBRL(totalCost)} icon={<DollarSign size={16} />} />
            <Pill label="Horas Cobradas" value={`${totalUnits}h`} icon={<Clock size={16} />} />
            <Pill label="Total Voos" value={String(totalFlights)} icon={<Plane size={16} />} />
          </>
        ) : (
          <>
            {/* Sem o "Resultado" de propósito: subtrair uma coisa da outra dá um
                número negativo que parece prejuízo da operação, e não é isso que
                ele diz. É custo de equipamento contra receita de aluguel de
                equipamento, e o que a rampa fatura não passa por este sistema. */}
            <Pill label="Alocação" value={fmtBRL(receitaTotal)} icon={<TrendingUp size={16} />} />
            <Pill label="Locação" value={fmtBRL(totalCost)} icon={<DollarSign size={16} />} />
          </>
        )}

        {/* Um botão só: o painel padrão do gerente continua sendo o padrão, e
            Receita x Custos é o desvio. */}
        <button
          onClick={() => setPainel(p => p === 'receita' ? 'locacoes' : 'receita')}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: painel === 'receita' ? '#1E293B' : '#fff',
            color: painel === 'receita' ? '#fff' : '#1E293B',
            border: `1px solid ${painel === 'receita' ? '#1E293B' : '#E2E8F0'}`,
            borderRadius: 10, padding: '9px 14px', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, flexShrink: 0, transition: 'all 0.15s ease',
          }}
        >
          <Scale size={14} />
          {painel === 'receita' ? 'Voltar ao painel' : 'Alocação x Locação'}
        </button>

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
      ) : painel === 'receita' ? (
        <>
          {/* ── Receita em cima, Custo embaixo, mesma leitura nos dois lados ── */}
          {equipSemPreco.length > 0 && (
            <div style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
              background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10,
              padding: '8px 14px', fontSize: 12, color: '#92400E',
            }}>
              <AlertTriangle size={15} />
              <span>
                <strong>{plural(equipSemPreco.length, 'equipamento alocado está', 'equipamentos alocados estão')} sem preço cadastrado</strong>
                {' '}({equipSemPreco.map(e => nomeVisivel(e.nome)).join(', ')}), então a receita mostrada está incompleta.
              </span>
            </div>
          )}

          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12 }}>
            <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <PainelFinanceiro
              titulo="Alocação"
              subtitulo="Equipamento nosso alugado para terceiro"
              cor="#10B981"
              corFraca="#ECFDF5"
              total={receitaTotal}
              serie={receitaPorDia}
              chaveSerie="Alocações"
              linhas={receitaPorEquip.map(e => ({
                nome: e.nome,
                horas: e.horas,
                valor: e.valor,
                detalhe: e.precoHora === null ? 'sem preço' : `${fmtBRL(e.precoHora)}/h`,
                alerta: e.precoHora === null,
              }))}
            />

            <PainelFinanceiro
              titulo="Locação"
              subtitulo="Equipamento de terceiro que nós alugamos"
              cor="#EF4444"
              corFraca="#FEF2F2"
              total={totalCost}
              serie={custoPorDia}
              chaveSerie="Locações"
              linhas={custoPorEquip.map(e => ({
                nome: e.nome,
                horas: e.horas,
                valor: e.valor,
                detalhe: e.empresa || '',
                alerta: false,
              }))}
            />
            </div>

            {/* ── Combustível: único dado desta tela digitado à mão ── */}
            <div style={{
              background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: '12px 14px',
              display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>Combustível</span>
                <button
                  onClick={abrirFormCombustivel}
                  title="Registrar abastecimento"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, background: '#1E293B', color: '#fff',
                    border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
                    fontSize: 11, fontWeight: 700,
                  }}
                >
                  <Plus size={13} />
                  Registrar
                </button>
              </div>
              <p style={{ margin: '2px 0 10px', fontSize: 10, color: '#94A3B8', flexShrink: 0 }}>
                Abastecimentos de {fmtShortDate(startDate)} a {fmtShortDate(endDate)}
              </p>

              <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginBottom: 10 }}>
                {(['DIESEL', 'GASOLINA'] as const).map(t => (
                  <div key={t} style={{
                    flex: 1, background: '#F8FAFC', border: '1px solid #E2E8F0',
                    borderRadius: 8, padding: '7px 9px',
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1E293B' }}>
                      {(litrosPorTipo.get(t) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', marginLeft: 2 }}>L</span>
                    </div>
                  </div>
                ))}
              </div>

              {combustivel.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                  <p style={{ color: '#94A3B8', fontSize: 12, lineHeight: 1.6 }}>
                    Nenhum abastecimento<br />registrado no período
                  </p>
                </div>
              ) : (
                <div className="rolagem-fina" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                  {combustivel.map((c: any) => (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                        padding: '6px 0', borderBottom: '1px solid #F1F5F9',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>
                          {Number(c.litros).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L
                        </div>
                        <div style={{ fontSize: 10, color: '#94A3B8' }}>
                          {fmtShortDate(c.data)} · {c.tipo === 'DIESEL' ? 'Diesel' : 'Gasolina'}
                        </div>
                      </div>
                      <button
                        onClick={() => setExcluirCombustivel(c)}
                        title="Excluir registro"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1',
                          display: 'flex', padding: 4, borderRadius: 6, flexShrink: 0,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#CBD5E1')}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <div style={{ paddingTop: 8, marginTop: 2, borderTop: '2px solid #E2E8F0', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Total</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>
                      {litrosTotal.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
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
                  total={supplierTotal}
                  label={fmtBRL(supplierTotal)}
                  onSelect={handleSupplierClick}
                />
                <div className="rolagem-fina" style={{ width: '100%', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                  {supplierMap.map(([name, cost], i) => (
                    <div
                      key={name}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '5px 6px', borderTop: i === 0 ? 'none' : '1px solid #F1F5F9', borderRadius: 6,
                        background: selectedSupplier === name ? '#F8FAFC' : 'transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: SUPPLIER_COLORS[name] ?? '#94A3B8', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: '#1E293B', fontWeight: selectedSupplier === name ? 700 : 500 }}>{name}</span>
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
                    {/* O eixo traduz na hora de desenhar; `name` no dado segue cru,
                        porque é ele que o clique usa pra filtrar o painel. */}
                    <XAxis dataKey="name" tickFormatter={nomeVisivel} tick={{ fontSize: 9, fill: '#64748B' }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 9, fill: '#64748B' }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} width={36} />
                    <Tooltip content={(props: any) => <ChartTooltip {...props} label={nomeVisivel(props.label)} />} />
                    <Bar dataKey="cost" name="R$ Custo" radius={[4, 4, 0, 0]} onClick={handleEquipmentClick} style={{ cursor: 'pointer' }}>
                      <LabelList dataKey="cost" content={<RotuloVertical formatar={(v: number) => fmtBRL(v)} />} />
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
                    <YAxis dataKey="name" type="category" tickFormatter={nomeVisivel} tick={{ fontSize: 9, fill: '#64748B' }} width={80} />
                    <Tooltip content={(props: any) => <ChartTooltip {...props} label={nomeVisivel(props.label)} />} />
                    <Bar dataKey="horas" name="Horas" radius={[0, 4, 4, 0]} onClick={handleEquipmentClick} style={{ cursor: 'pointer' }}>
                      <LabelList dataKey="horas" content={<RotuloHorizontal formatar={(v: number) => `${v}h`} />} />
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
            <ChartCard title="Análise: Voos × Locações" dica="clique na barra para ver o dia">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={dailyData}
                  margin={{ left: 0, right: 16, top: 22, bottom: 8 }}
                  onClick={(e: any) => {
                    // Clique em qualquer ponto da coluna, e nao so na barra: dia
                    // sem voo nao desenha barra nenhuma e ficaria sem como abrir.
                    const iso = e?.activePayload?.[0]?.payload?._iso;
                    if (iso) setDiaDetalhe(iso);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} />
                  <YAxis yAxisId="l" tick={{ fontSize: 10, fill: '#64748B' }} allowDecimals={false} width={28} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: '#64748B' }} allowDecimals={false} width={28} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} formatter={v => <span style={{ color: '#1E293B', fontWeight: 500 }}>{v}</span>} />
                  <Bar
                    yAxisId="l" dataKey="Voos" fill="#1E293B" radius={[4, 4, 0, 0]} opacity={0.9}
                    onClick={(d: any) => setDiaDetalhe(d?._iso ?? d?.payload?._iso ?? null)}
                    style={{ cursor: 'pointer' }}
                  >
                    <LabelList dataKey="Voos" content={<RotuloVertical />} />
                  </Bar>
                  <Line yAxisId="r" type="monotone" dataKey="Locações (h)" stroke="#EF4444" strokeWidth={2}
                    dot={{ r: 3, fill: '#fff', stroke: '#EF4444', strokeWidth: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Manutenção da frota: estado real, um registro por ciclo */}
            <div style={{
              background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: '12px 14px',
              display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexShrink: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', margin: 0, marginRight: 4 }}>
                  Manutenção da Frota
                </p>
                {([
                  ['parados', 'Parados agora', paradosAgora.length, '#EF4444'],
                  ['voltaram', 'Voltaram', voltaramNoPeriodo.length, '#10B981'],
                  ['operacao', 'Em operação agora', emOperacaoAgora.length, '#3B82F6'],
                ] as [string, string, number, string][]).map(([chave, rotulo, total, cor]) => {
                  const ativa = abaManutencao === chave;
                  return (
                    <button
                      key={chave}
                      onClick={() => setAbaManutencao(chave as 'parados' | 'voltaram' | 'operacao')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: ativa ? cor : '#F8FAFC',
                        color: ativa ? '#fff' : '#64748B',
                        border: '1px solid ' + (ativa ? cor : '#E2E8F0'),
                        borderRadius: 20, padding: '3px 10px', cursor: 'pointer',
                        fontSize: 11, fontWeight: 600, transition: 'all 0.15s ease',
                      }}
                    >
                      {rotulo}
                      <span style={{
                        background: ativa ? 'rgba(255,255,255,0.25)' : '#E2E8F0',
                        color: ativa ? '#fff' : '#475569',
                        borderRadius: 20, padding: '0 6px', fontSize: 10, fontWeight: 700,
                      }}>{total}</span>
                    </button>
                  );
                })}
              </div>

              <p style={{ margin: '0 0 8px', fontSize: 10, color: '#94A3B8', flexShrink: 0 }}>
                {abaManutencao === 'parados'
                  ? 'Estado de hoje, não muda com o período escolhido'
                  : abaManutencao === 'operacao'
                    ? 'Equipamentos operantes neste momento, direto do cadastro da frota'
                    : 'Voltaram para a operação entre ' + fmtShortDate(startDate) + ' e ' + fmtShortDate(endDate)}
              </p>

              {abaManutencao === 'operacao' ? (
                emOperacaoAgora.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ color: '#94A3B8', fontSize: 13 }}>Nenhum equipamento operante</p>
                  </div>
                ) : (
                  <div className="rolagem-fina" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                    {/* Sem tabela de propósito: aqui não há data nem defeito pra mostrar,
                        é só a lista do que está de pé, então cabe mais nome por linha. */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(178px, 1fr))', gap: 6 }}>
                      {emOperacaoAgora.map(e => (
                        <div key={e.prefixo} style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          background: '#F8FAFC', border: '1px solid #E2E8F0',
                          borderRadius: 8, padding: '5px 9px', minWidth: 0,
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6', flexShrink: 0 }} />
                          <span style={{
                            fontSize: 12, fontWeight: 600, color: '#1E293B',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>{nomeVisivel(e.nome)}</span>
                          {/* O prefixo é o que separa dois LOADER com o mesmo nome */}
                          <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500, marginLeft: 'auto', flexShrink: 0 }}>
                            {e.prefixo}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ) : listaManutencao.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ color: '#94A3B8', fontSize: 13 }}>
                    {abaManutencao === 'parados' ? 'Frota inteira operacional' : 'Nenhum retorno no período'}
                  </p>
                </div>
              ) : (
                <div className="rolagem-fina" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                    <thead style={{ position: 'sticky', top: 0 }}>
                      <tr>
                        {(abaManutencao === 'parados'
                          ? ['Equipamento', 'Desde', 'Parado há', 'Defeito']
                          : ['Equipamento', 'Baixa', 'Retorno', 'Ficou']
                        ).map(h => (
                          <th key={h} style={{ ...tableStyles.th, textAlign: 'left', fontSize: 10 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {listaManutencao.map((c: any, i: number) => (
                        <tr
                          key={c.prefixo + '-' + c.entrada.data + '-' + i}
                          onClick={() => setExpandedMaint({ ...c.entrada, _retorno: c.retorno, _dias: c.dias })}
                          style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#EFF6FF')}
                          onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#F8FAFC')}
                        >
                          {/* O prefixo é o que diferencia dois LOADER: sem ele a lista
                              parecia repetir o mesmo equipamento várias vezes. */}
                          <td style={{ ...tableStyles.td, fontSize: 12, padding: '6px 8px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <span style={{
                                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                                background: abaManutencao === 'parados' ? '#EF4444' : '#10B981',
                              }} />
                              <span>
                                {nomeVisivel(equipNames.get(c.prefixo) || c.prefixo)}
                                <span style={{ color: '#94A3B8', fontWeight: 500, marginLeft: 5, fontSize: 10 }}>
                                  {c.prefixo}
                                </span>
                              </span>
                            </span>
                          </td>
                          <td style={{ ...tableStyles.td, fontSize: 11, padding: '6px 8px', color: '#475569', whiteSpace: 'nowrap' }}>
                            {fmtShortDate(c.entrada.data)}
                          </td>
                          {abaManutencao === 'parados' ? (
                            <>
                              <td style={{ ...tableStyles.td, fontSize: 11, padding: '6px 8px', whiteSpace: 'nowrap' }}>
                                <span style={{
                                  background: c.dias >= 30 ? '#FEF2F2' : '#F1F5F9',
                                  color: c.dias >= 30 ? '#EF4444' : '#475569',
                                  fontWeight: 700, borderRadius: 20, padding: '1px 8px',
                                }}>
                                  {plural(c.dias, 'dia', 'dias')}
                                </span>
                              </td>
                              <td style={{ ...tableStyles.td, fontSize: 11, padding: '6px 8px', color: '#64748B', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {c.entrada.motivo || 'Sem descrição'}
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={{ ...tableStyles.td, fontSize: 11, padding: '6px 8px', color: '#10B981', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {fmtShortDate(c.retorno.data)}
                              </td>
                              <td style={{ ...tableStyles.td, fontSize: 11, padding: '6px 8px', color: '#475569', whiteSpace: 'nowrap' }}>
                                {plural(c.dias, 'dia', 'dias')}
                              </td>
                            </>
                          )}
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
