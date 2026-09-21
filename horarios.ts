// ─── Horário que não fecha ──────────────────────────────────────────────────
// Criado em 11/09/2026, depois da locação de 08/09 que cobrava R$ 4.320: o
// líder digitou início 19:23 e fim 18:26, e o app contou 23h03 de uso, porque
// fim antes do início é lido como virada de meia-noite. Foi o 3º caso do ano,
// e nenhum apareceu em lugar nenhum até alguém estranhar o número no painel.
//
// Duas defesas, em dois lugares, e as duas usam A MESMA CONTA do painel
// (`calcMinutes`/`hoursBilled`), porque o que interessa é o número que vai
// ser cobrado, não a duração "de verdade":
//
// 1. NO APP DO LÍDER: par com fim menor ou igual ao início abre um aviso
//    pedindo confirmação, mostrando quanto o app vai contar. Ele pode seguir,
//    porque 23:50 → 01:10 existe e é real (3º turno).
//
// 2. NO PAINEL DA GERÊNCIA: lançamento com duração contada fora do normal é
//    apontado, com "Vi a notificação" pra não ficar preso na tela.
//
// 🔑 A régua do painel saiu do banco, não de chute. Medido em 11/09/2026 sobre
// 594 locações e 527 voos: locação tem mediana de 20 min e p99 de 2h25, e só
// as 2 suspeitas passam de 4h; voo tem p99 de 3h15 e nenhum passa de 6h.
// Virar a meia-noite sozinho NÃO é sinal: 4 das 5 locações que viram são reais
// (23:23 → 00:11). Por isso a régua é de DURAÇÃO, não de inversão.

import { calcMinutes, hoursBilled } from './DashboardUtils';

export const LIMITE_LOCACAO_MIN = 4 * 60;
export const LIMITE_VOO_MIN = 6 * 60;

// "23h03", "0h48". Sempre com os minutos, porque "1h" e "1h59" são o mesmo
// número cobrado e durações diferentes.
export const fmtDuracao = (min: number): string =>
  `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;

// Fim IGUAL ao início também entra: `calcMinutes` devolve 1440 pra ele, ou
// seja, 24 horas cobradas por um lançamento de zero minutos.
export const horarioInvertido = (inicio: string, fim: string): boolean =>
  !!inicio && !!fim && fim <= inicio;

// ─── 1. O formulário do líder ───────────────────────────────────────────────

export interface ParInvertido {
  // Identifica o PAR e os VALORES: se o líder mexer em qualquer um dos dois
  // horários a chave muda, e o aviso volta a valer. Confirmar 19:23 → 18:26
  // não confirma 19:23 → 18:00.
  chave: string;
  onde: string;      // "Locação 2 (LOADER MDL)", "Voo 1 (Sideral)", "Briefing"
  inicio: string;
  fim: string;
  minutos: number;   // o que o app vai contar
}

interface CamposComHorario {
  formRentals: { equipamento?: string; empresa?: string; inicio: string; fim: string }[];
  formFlights: { companhia?: string; manual_name?: string; pouso: string; reboque: string }[];
  formBriefing: { ativo: boolean; inicio: string; fim: string };
  formDebriefing: { ativo: boolean; inicio: string; fim: string };
}

export const paresInvertidosDoFormulario = (f: CamposComHorario): ParInvertido[] => {
  const lista: ParInvertido[] = [];
  const poe = (id: string, onde: string, inicio: string, fim: string) => {
    if (!horarioInvertido(inicio, fim)) return;
    lista.push({ chave: `${id}|${inicio}|${fim}`, onde, inicio, fim, minutos: calcMinutes(inicio, fim) });
  };
  f.formRentals.forEach((l, i) => {
    const nome = [l.empresa, l.equipamento].filter(Boolean).join(' ');
    poe(`loc-${i}`, `Locação ${i + 1}${nome ? ` (${nome})` : ''}`, l.inicio, l.fim);
  });
  f.formFlights.forEach((v, i) => {
    const cia = v.companhia === 'OUTROS' ? (v.manual_name || 'OUTROS') : v.companhia;
    poe(`voo-${i}`, `Voo ${i + 1}${cia ? ` (${cia})` : ''}`, v.pouso, v.reboque);
  });
  if (f.formBriefing.ativo) poe('briefing', 'Briefing', f.formBriefing.inicio, f.formBriefing.fim);
  if (f.formDebriefing.ativo) poe('debriefing', 'Debriefing', f.formDebriefing.inicio, f.formDebriefing.fim);
  return lista;
};

// ─── 2. O painel da Gerência ────────────────────────────────────────────────

export interface Incoerencia {
  // Id do relatório + tipo + posição na lista + os horários. Se o lançamento
  // for corrigido no banco, a chave muda, e o "visto" antigo deixa de casar
  // com ele, o que está certo: lançamento corrigido não é mais suspeito.
  chave: string;
  relatorioId: string;
  data: string;
  turno: string;
  lider: string;
  tipo: 'locacao' | 'voo';
  nome: string;            // equipamento (cru, sem tradução) ou companhia
  origem: string | null;   // fornecedor da locação, ou null
  inicio: string;
  fim: string;
  minutos: number;
  horasCobradas: number;
  valor: number | null;    // R$ que o painel está somando por causa disto
  motivo: string;
}

interface RelatorioComLancamentos {
  id: string;
  data: string;
  turno: string;
  lider: string;
  locacoes?: any[] | null;
  voos?: any[] | null;
}

// As chaves ficam em função pra o detalhe do dia e a lista de avisos falarem
// do mesmo lançamento sem cada um montar a própria string.
export const chaveLocacao = (relatorioId: string, i: number, l: any): string =>
  `loc|${relatorioId}|${i}|${l.equipamento}|${l.inicio}|${l.fim}`;
export const chaveVoo = (relatorioId: string, i: number, v: any): string =>
  `voo|${relatorioId}|${i}|${v.companhia}|${v.inicio}|${v.fim}`;

export const incoerenciasDosRelatorios = (reports: RelatorioComLancamentos[]): Incoerencia[] => {
  const lista: Incoerencia[] = [];
  reports.forEach(r => {
    (r.locacoes || []).forEach((l: any, i: number) => {
      if (!l.inicio || !l.fim) return;
      const minutos = calcMinutes(l.inicio, l.fim);
      if (minutos <= LIMITE_LOCACAO_MIN) return;
      const horas = hoursBilled(l.inicio, l.fim);
      const externa = l.tipo === 'LOCAR';
      lista.push({
        chave: chaveLocacao(r.id, i, l),
        relatorioId: r.id, data: r.data, turno: r.turno, lider: r.lider,
        tipo: 'locacao', nome: l.equipamento, origem: externa ? (l.empresa || 'Fornecedor') : null,
        inicio: l.inicio, fim: l.fim, minutos, horasCobradas: horas,
        valor: externa && l.valor_hora_brl ? horas * l.valor_hora_brl : null,
        motivo: horarioInvertido(l.inicio, l.fim)
          ? `O fim é antes do início, então conta ${fmtDuracao(minutos)} de uso. Locação normal dura até 2h.`
          : `${fmtDuracao(minutos)} de uso. Locação normal dura até 2h.`,
      });
    });
    (r.voos || []).forEach((v: any, i: number) => {
      if (!v.inicio || !v.fim) return;
      const minutos = calcMinutes(v.inicio, v.fim);
      if (minutos <= LIMITE_VOO_MIN) return;
      lista.push({
        chave: chaveVoo(r.id, i, v),
        relatorioId: r.id, data: r.data, turno: r.turno, lider: r.lider,
        tipo: 'voo', nome: v.companhia, origem: null,
        inicio: v.inicio, fim: v.fim, minutos, horasCobradas: hoursBilled(v.inicio, v.fim),
        valor: null,
        motivo: horarioInvertido(v.inicio, v.fim)
          ? `O fim é antes do início, então conta ${fmtDuracao(minutos)} de atendimento. Voo normal leva até 3h.`
          : `${fmtDuracao(minutos)} de atendimento. Voo normal leva até 3h.`,
      });
    });
  });
  return lista;
};
