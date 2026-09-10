import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { AlertTriangle, RefreshCw, Clock, TrendingUp, Scale, Users, CalendarRange, X } from 'lucide-react';
import { tableStyles } from './DashboardUtils';

// ─── Espelho da planilha de Horas Extras ────────────────────────────────────
// 🔴 ESTA TELA É SÓ LEITURA. Ela NUNCA escreve na planilha, e isso é de
// propósito: quem preenche é o RH e os gestores, pelo formulário. Consertar
// aqui esconderia o erro e ele voltaria no mês seguinte, do mesmo jeito.
//
// 🔴 EM 10/09/2026 A LISTA DE PENDÊNCIAS SAIU DA TELA, por decisão dele: o
// painel passou a ser acompanhado pelo diretor e o espaço foi pro ranking.
// ⚠️ O DESCARTE CONTINUA ACONTECENDO (`ERROS_QUE_DESCARTAM`), então os números
// daqui seguem menores que os da planilha e a tela não diz mais isso. Quem
// quiser saber quanto ficou de fora precisa olhar a planilha. Se um dia isso
// incomodar, o caminho de volta está no commit anterior a esta mudança: era um
// aviso no topo, um card à direita e um modal com a linha e o nome.
//
// A planilha precisa seguir aberta para "qualquer pessoa com o link". Se
// fechar, o navegador não lê e a tela mostra o aviso de falha, em vez de
// número velho passando por atual.
const PLANILHA_ID = '1dKmS3pmXqK-D4Xatbs-GksDvSbd5ABPTe3oQPkZJ0LU';
const GID_HORAS = '571647903';        // aba "Controle de horas extras"

// A aba "Controle de compensa" (gid 1777507589) chegou a ser lida daqui, pra
// pegar a BASE de cada contrato. Saiu depois de medida: das 2.042 linhas de
// 2026, o mapa dela e a sigla do próprio nome do contrato davam o MESMO
// resultado nas 2.009, discordando em zero. Era 2 MB baixados por
// carregamento pra não mudar um número. Com a coluna BASE agora existindo na
// aba principal, não há motivo nenhum pra voltar atrás.

const urlCsv = (gid: string) =>
  `https://docs.google.com/spreadsheets/d/${PLANILHA_ID}/export?format=csv&gid=${gid}`;
const URL_PLANILHA =
  `https://docs.google.com/spreadsheets/d/${PLANILHA_ID}/edit?gid=${GID_HORAS}#gid=${GID_HORAS}`;

// ⚠️ NÃO trocar por `gviz/tq`. Testado: aquele endpoint respeita filtro salvo
// na aba e devolveu 287 de 4.922 registros da aba de compensa, sem avisar. O
// `export?format=csv` traz a aba inteira.

// ─── As colunas são achadas PELO NOME, nunca pela posição ───────────────────
// 🔴 Isto já custou caro uma vez: a pergunta BASE foi criada no formulário e o
// Google enfiou a coluna nova na M, empurrando Periodo, Status, DIA, Mês e ANO
// uma casa pra direita. Com leitura por posição, uma coluna nova no meio faz a
// tela ler contrato onde tem situação — sem erro, sem aviso, só número errado.
// Agora ele pode criar, mover e reordenar coluna à vontade.
//
// Cada campo lista as grafias aceitas, já sem acento e sem pontuação.
const COLUNAS: { chave: string; aceita: string[]; obrigatoria: boolean }[] = [
  { chave: 'data', aceita: ['DATA'], obrigatoria: true },
  { chave: 'matricula', aceita: ['MATRICULA'], obrigatoria: false },
  { chave: 'nome', aceita: ['NOME COMPLETO FUNCIONARIO', 'NOME COMPLETO', 'FUNCIONARIO'], obrigatoria: true },
  { chave: 'inicio', aceita: ['HORA INICIO', 'INICIO'], obrigatoria: true },
  { chave: 'fim', aceita: ['HORA FINAL', 'FINAL', 'FIM'], obrigatoria: true },
  { chave: 'total', aceita: ['TOTAL'], obrigatoria: true },
  { chave: 'gestor', aceita: ['NOME DO GESTOR SOLICITANTE', 'GESTOR SOLICITANTE', 'GESTOR'], obrigatoria: false },
  { chave: 'contrato', aceita: ['CONTRATO'], obrigatoria: true },
  { chave: 'situacao', aceita: ['SITUACAO'], obrigatoria: true },
  { chave: 'motivo', aceita: ['MOTIVO'], obrigatoria: false },
  // Nasceu em 25/08/2026. Enquanto estiver em branco, a base sai do nome do
  // contrato; conforme for preenchida, ela manda.
  { chave: 'base', aceita: ['BASE'], obrigatoria: false },
];

// 🔑 As bases que o gerente acompanha. Quem não está aqui fica fora da tela
// inteira. Hoje só MAO, BVB e TFF aparecem na planilha, mas a lista fica
// completa de propósito: quando uma base nova começar a lançar, ela entra
// sozinha, sem mexer no código.
const BASES = ['MAO', 'BVB', 'TFF', 'TBT', 'BEL', 'PMW', 'FOR', 'REC', 'SSA', 'NAT', 'JPA', 'THE', 'SLZ', 'PHB'];

const ANO_ATUAL = new Date().getFullYear();
const hojeISO = () => new Date().toLocaleDateString('en-CA');

// ─── CSV ────────────────────────────────────────────────────────────────────
// Escrito à mão em vez de trazer uma biblioteca: a planilha não tem quebra de
// linha dentro de campo (conferido nos 11.417 registros), mas tem vírgula e
// aspas no meio da justificativa, e isso o parser precisa entender.
const lerCSV = (txt: string): string[][] => {
  const linhas: string[][] = [];
  let campo = '', linha: string[] = [], dentroDeAspas = false;
  const t = txt.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (dentroDeAspas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; } else dentroDeAspas = false;
      } else campo += c;
    } else if (c === '"') dentroDeAspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
};

// ─── Normalização ───────────────────────────────────────────────────────────
// 🔑 Sem isso o gráfico mostra a mesma coisa várias vezes. A coluna Contrato
// tem 123 grafias que são 96 ideias, e a aba de compensa tem NOVE jeitos de
// escrever "BVB Segurança Canal de Inspeção", com letra trocada em cada um.
const chaveDe = (s: any) =>
  String(s ?? '')
    .normalize('NFD')
    // Faixa dos acentos soltos que o NFD separa da letra. Escrita como código
    // e não como caractere: acento colado no fonte some numa troca de
    // encoding, e a normalização pararia calada.
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

// Hora no formato H:MM:SS vira número decimal. A planilha guarda o Total já
// calculado, e ele confere com (fim - início) nos 11.342 registros que têm
// horário, viradas de meia-noite incluídas: dá pra confiar na coluna.
const horasDe = (v: string): number => {
  const p = String(v ?? '').trim().split(':');
  if (p.length < 2) return 0;
  const h = Number(p[0]), m = Number(p[1]), s = p.length > 2 ? Number(p[2]) : 0;
  if (!isFinite(h) || !isFinite(m) || !isFinite(s)) return 0;
  return h + m / 60 + s / 3600;
};

// Com separador de milhar: "2331h09" obriga a contar dígito com o dedo, e
// "2.331h09" se lê de uma vez.
const fmtH = (h: number): string => {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60), mm = total % 60;
  const horas = hh.toLocaleString('pt-BR');
  return mm ? `${horas}h${String(mm).padStart(2, '0')}` : `${horas}h`;
};

const fmtNum = (n: number): string => n.toLocaleString('pt-BR');

// DD/MM/AAAA vira AAAA-MM-DD. Devolve null quando a data não existe ou cai
// fora da janela em que a planilha vive. É assim que os registros com o ano
// digitado errado (0023, 0024, 0225) param de contaminar o gráfico: sem mês
// válido não há ponto onde eles caibam, e eles saem da conta.
const dataDe = (v: string): string | null => {
  const m = String(v ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{1,4})$/);
  if (!m) return null;
  const dia = +m[1], mes = +m[2], ano = +m[3];
  if (ano < 2023 || ano > ANO_ATUAL + 1) return null;
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(ano, mes - 1, dia);
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
};

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// 🔴 TODA A GUIA OLHA O MESMO PERÍODO: do 1º de janeiro do ano corrente até
// hoje, somado. Não existe filtro de mês nem número de "mês atual" em lugar
// nenhum desta tela, e sem dizer isso em algum lugar ninguém consegue saber
// olhando: 2.737h pode ser do mês ou do ano, e os dois são plausíveis.
// 🔑 O período é escrito UMA vez, na pílula da esquerda, e as outras pílulas
// deixaram de repetir "em 2026" por causa disso. Se um dia entrar filtro de
// período, é este texto que passa a mudar, e ele já está sozinho.
const MESES_LONGOS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const periodoCurto = (): string => {
  const m = new Date().getMonth();
  return m === 0 ? `jan de ${ANO_ATUAL}` : `jan a ${MESES[m]} de ${ANO_ATUAL}`;
};
const periodoLongo = (): string => {
  const m = new Date().getMonth();
  return m === 0
    ? `Acumulado de janeiro de ${ANO_ATUAL}`
    : `Acumulado de janeiro a ${MESES_LONGOS[m]} de ${ANO_ATUAL}`;
};

export interface Registro {
  linha: number;          // linha real na planilha: é o que faz o erro ser corrigível
  dataTxt: string;
  data: string | null;
  nome: string; nomeChave: string;
  matricula: string;
  inicio: string; fim: string;
  horas: number;
  gestor: string;
  contrato: string; contratoChave: string;
  base: string;
  baseVeioDaColuna: boolean;   // true = da coluna BASE, false = deduzida do contrato
  situacao: 'Hora Extra' | 'Compensa' | '';
  motivo: string;
  problemas: string[];
  copiaExtra: boolean;    // é a 2ª, 3ª... vez que o mesmo lançamento aparece
  descartado: boolean;    // fica FORA dos números, mas continua na lista de erro
}

// 🔴 Os erros que TIRAM o registro da conta. São os que estragam o número:
// sem data não há mês, sem situação não dá pra dizer se paga ou compensa, mais
// de 12h quase sempre é hora invertida, e data no futuro ainda não aconteceu.
//
// 🔑 Falta de gestor, de matrícula ou de contrato NÃO descarta: ali a hora
// trabalhada é real e o que falta é cadastro. Descartar essas jogaria fora
// horas verdadeiras e faria o total mentir pra menos, que é tão errado quanto
// mentir pra mais.
const ERROS_QUE_DESCARTAM = ['data', 'futuro', 'semSituacao', 'semHorario', 'longa'];

// 🔑 Os problemas que o `lerPlanilha` ainda carimba em `r.problemas`, mesmo sem
// tela pra mostrar: data (data inválida), futuro, semSituacao, semHorario,
// longa (mais de 12h), duplicado, semBase, semContrato, semMatricula e
// semGestor. Os cinco primeiros da lista `ERROS_QUE_DESCARTAM` acima continuam
// tirando o registro da conta, então o carimbo NÃO é enfeite: apagar isso muda
// o número da tela.

// Cabeçalho vira chave: sem acento, sem pontuação, sem espaço sobrando.
// "Nome do Gestor solicitante:" e "NOME DO GESTOR SOLICITANTE" viram a mesma
// coisa, que é o ponto.
const chaveCabecalho = (s: string) =>
  chaveDe(s).replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

export const mapearColunas = (cabecalho: string[]): Record<string, number> => {
  const limpos = cabecalho.map(chaveCabecalho);
  const mapa: Record<string, number> = {};
  const faltando: string[] = [];

  COLUNAS.forEach(c => {
    // Nome exato primeiro; só depois aceita "contém", pra "TOTAL" não casar
    // com "TOTAL DE HORAS EXTRAS" antes de casar com "TOTAL".
    let i = limpos.findIndex(h => c.aceita.includes(h));
    if (i === -1) i = limpos.findIndex(h => c.aceita.some(a => h.includes(a)));
    if (i >= 0) mapa[c.chave] = i;
    else if (c.obrigatoria) faltando.push(c.aceita[0]);
  });

  // 🔑 Coluna obrigatória faltando derruba a leitura de propósito. Seguir sem
  // ela significaria mostrar número inventado, e número inventado num painel de
  // gerência é pior que tela com erro escrito.
  if (faltando.length) {
    throw new Error(
      `não achei ${faltando.length === 1 ? 'a coluna' : 'as colunas'} `
      + `${faltando.join(', ')} na planilha. Se ela foi renomeada, me avise o nome novo.`
    );
  }
  return mapa;
};

// ─── De que base é este contrato? ───────────────────────────────────────────
// 🔑 A aba de horas extras NÃO tem coluna de base: quem tem é a aba de
// compensa. Então o mapa Contrato → BASE é aprendido de lá, que é o que as
// pessoas preencheram à mão, e não uma tabela que eu inventei. Quando o
// contrato não existe naquele mapa, sobra a sigla no começo do nome
// ("GSE MAO", "BVB SEGURANÇA..."), que resolve o resto.
const baseDoContrato = (contratoChave: string): string => {
  // Sigla solta no nome do contrato: "GSE MAO", "BVB SEGURANÇA...".
  // 🔑 Compara PALAVRA INTEIRA, senão "FORTALEZA" viraria base FOR e "NATAL"
  // viraria NAT. Feito quebrando em palavras e não com \b numa regex montada
  // por template: ali a barra dupla é fácil de perder numa edição, e a regex
  // passaria a casar com o caractere backspace, sem erro nenhum e sem casar
  // com nada. Aconteceu comigo escrevendo este arquivo.
  const palavras = contratoChave.split(/[^A-Z0-9]+/).filter(Boolean);
  for (const b of BASES) {
    if (palavras.includes(b)) return b;
  }
  return '';
};

// ─── Leitura e checagem ─────────────────────────────────────────────────────
export const lerPlanilha = (csvHoras: string): Registro[] => {
  const linhas = lerCSV(csvHoras);
  if (!linhas.length) throw new Error('a planilha veio vazia');
  const COL = mapearColunas(linhas[0]);
  const hoje = hojeISO();
  const brutos: Registro[] = [];
  const campo = (l: string[], chave: string) =>
    COL[chave] === undefined ? '' : (l[COL[chave]] || '').trim();

  linhas.slice(1).forEach((l, i) => {
    const nome = campo(l, 'nome');
    if (!nome) return;                       // linha vazia da planilha, não é registro
    const contrato = campo(l, 'contrato');
    const contratoChave = chaveDe(contrato);
    const situacaoChave = chaveDe(campo(l, 'situacao'));

    // 🔑 A coluna BASE manda quando está preenchida. Enquanto estiver em
    // branco — e em 25/08/2026 ela estava em branco nas 11.419 linhas — a base
    // sai da sigla no nome do contrato. Assim a tela funciona hoje e vai
    // ficando mais exata sozinha, conforme o preenchimento avança, sem
    // precisar de nenhuma outra mudança de código.
    const baseDaColuna = chaveDe(campo(l, 'base'));
    const base = BASES.includes(baseDaColuna) ? baseDaColuna : baseDoContrato(contratoChave);

    brutos.push({
      linha: i + 2,                          // +1 do cabeçalho, +1 porque planilha conta do 1
      dataTxt: campo(l, 'data'),
      data: dataDe(campo(l, 'data')),
      nome, nomeChave: chaveDe(nome),
      matricula: campo(l, 'matricula'),
      inicio: campo(l, 'inicio'),
      fim: campo(l, 'fim'),
      horas: horasDe(campo(l, 'total')),
      gestor: campo(l, 'gestor'),
      contrato, contratoChave,
      base,
      baseVeioDaColuna: BASES.includes(baseDaColuna),
      situacao: situacaoChave.startsWith('COMPENSA') ? 'Compensa'
        : situacaoChave.startsWith('HORA EXTRA') ? 'Hora Extra' : '',
      motivo: campo(l, 'motivo'),
      problemas: [],
      copiaExtra: false,
      descartado: false,
    });
  });

  // Repetido só dá pra enxergar olhando o conjunto, então é uma segunda passada.
  const contagem = new Map<string, number>();
  const chaveRepeticao = (r: Registro) => `${r.nomeChave}|${r.dataTxt}|${r.inicio}|${r.fim}`;
  brutos.forEach(r => {
    const k = chaveRepeticao(r);
    contagem.set(k, (contagem.get(k) || 0) + 1);
  });

  // 🔑 Repetido: TODAS as cópias entram na lista de pendências, porque quem vai
  // corrigir precisa ver o conjunto pra escolher qual fica. Mas só a PRIMEIRA
  // conta nos números — descartar todas jogaria fora horas que aconteceram de
  // verdade uma vez.
  const jaVisto = new Set<string>();

  brutos.forEach(r => {
    const p: string[] = [];
    if (!r.data) p.push('data');
    else if (r.data > hoje) p.push('futuro');
    if (!r.situacao) p.push('semSituacao');
    if (!r.inicio || !r.fim) p.push('semHorario');
    if (r.horas > 12) p.push('longa');
    if (!r.base) p.push('semBase');
    if (!r.contrato) p.push('semContrato');
    if (!r.matricula) p.push('semMatricula');
    if (!r.gestor) p.push('semGestor');

    const k = chaveRepeticao(r);
    if ((contagem.get(k) || 0) > 1) {
      p.push('duplicado');
      if (jaVisto.has(k)) r.copiaExtra = true;
      jaVisto.add(k);
    }

    r.problemas = p;
    r.descartado = r.copiaExtra || ERROS_QUE_DESCARTAM.some(e => p.includes(e));
  });

  return brutos;
};

// O nome que aparece na tela é a grafia MAIS USADA do grupo, não a primeira
// que apareceu: agrupar por chave normalizada e escrever "MAO RAMPA" em caixa
// alta seria fiel ao código e estranho pra quem lê.
const grafiaMaisUsada = (
  regs: Registro[],
  chave: (r: Registro) => string,
  texto: (r: Registro) => string,
) => {
  const porChave = new Map<string, Map<string, number>>();
  regs.forEach(r => {
    const k = chave(r); if (!k) return;
    if (!porChave.has(k)) porChave.set(k, new Map());
    const m = porChave.get(k)!, t = texto(r).trim();
    m.set(t, (m.get(t) || 0) + 1);
  });
  const saida = new Map<string, string>();
  porChave.forEach((m, k) => saida.set(k, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]));
  return saida;
};

// 🔑 As três cores contam a conta inteira: GERADAS é o total que a operação
// produziu, e ele se parte em COMPENSADAS (vai pro banco de horas, não custa
// dinheiro) e A PAGAR (vira folha).
const COR_GERADAS = '#1E293B', COR_COMPENSADAS = '#10B981', COR_PAGAR = '#EF4444';

// 🔴 `cresce` e `alturaMinima` não são enfeite. Sem eles o card se ajusta ao
// conteúdo, e um gráfico com `ResponsiveContainer height="100%"` dentro de uma
// caixa sem altura desenha ZERO pixel: o gráfico some da tela sem erro nenhum,
// sem aviso e sem quebrar o build. Foi o que aconteceu aqui.
const Cartao: React.FC<{
  titulo: string; dica?: string; children: React.ReactNode; acao?: React.ReactNode;
  cresce?: number; alturaMinima?: number;
}> = ({ titulo, dica, children, acao, cresce, alturaMinima }) => (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0',
      boxShadow: '0 1px 3px rgba(0,0,0,0.07)', padding: '12px 14px',
      display: 'flex', flexDirection: 'column', minHeight: alturaMinima ?? 0,
      overflow: 'hidden', flex: cresce ? `${cresce} 1 0` : undefined,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', margin: 0 }}>{titulo}</p>
        {acao}
      </div>
      {dica && <p style={{ margin: '2px 0 8px', fontSize: 10, color: '#94A3B8', flexShrink: 0 }}>{dica}</p>}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  );

// `discreta` é pra pílula que carrega TEXTO e não número: o período no mesmo
// corpo de 17px competiria com as horas, e quem bate o olho leria a data como
// se fosse um dos indicadores.
const Pilula: React.FC<{
  label: string; valor: string; sub?: string; icone: React.ReactNode;
  cor?: string; discreta?: boolean;
}> =
  ({ label, valor, sub, icone, cor, discreta }) => (
    <div style={{
      background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10,
      padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
    }}>
      <span style={{ color: cor || '#64748B', display: 'flex' }}>{icone}</span>
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1 }}>{label}</div>
        <div style={{ fontSize: discreta ? 13 : 17, fontWeight: 700, color: cor || '#1E293B', lineHeight: discreta ? 1.55 : 1.2 }}>
          {valor}
          {sub && <span style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', marginLeft: 5 }}>{sub}</span>}
        </div>
      </div>
    </div>
  );

const seletor: React.CSSProperties = {
  background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8,
  padding: '7px 10px', fontSize: 12, fontWeight: 600, color: '#1E293B',
  fontFamily: 'inherit', cursor: 'pointer',
};

const HorasExtras: React.FC = () => {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [lidoEm, setLidoEm] = useState('');
  const [base, setBase] = useState<string>('');
  const [contrato, setContrato] = useState<string>('');
  // null = o ano acumulado. Número = o mês clicado no gráfico (0 = janeiro).
  const [mesEscolhido, setMesEscolhido] = useState<number | null>(null);

  const buscar = useCallback(async () => {
    setCarregando(true); setErro('');
    try {
      // cache-bust: a planilha muda o dia todo, e sem isso o navegador serve a
      // versão de ontem sem avisar ninguém.
      const rh = await fetch(`${urlCsv(GID_HORAS)}&_=${Date.now()}`);
      if (!rh.ok) throw new Error(`a planilha respondeu ${rh.status}`);
      const txt = await rh.text();
      if (txt.trim().startsWith('<')) throw new Error('a planilha não está aberta para quem tem o link');
      const regs = lerPlanilha(txt);
      if (!regs.length) throw new Error('a planilha foi lida, mas veio sem registro nenhum');
      setRegistros(regs);
      setLidoEm(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch (e: any) {
      setErro(e?.message || 'não consegui ler a planilha');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { buscar(); }, [buscar]);

  const nomesContrato = useMemo(() =>
    grafiaMaisUsada(registros, r => r.contratoChave, r => r.contrato), [registros]);
  const nomesPessoa = useMemo(() =>
    grafiaMaisUsada(registros, r => r.nomeChave, r => r.nome), [registros]);

  // 🔑 O universo da tela: ano corrente e só as bases que o gerente acompanha.
  // Tudo que fica fora daqui não aparece em número nenhum.
  const doAno = useMemo(() =>
    registros.filter(r =>
      !r.descartado
      && r.data && r.data.slice(0, 4) === String(ANO_ATUAL)
      && BASES.includes(r.base)),
    [registros]);

  // 🔑 AS 14 BASES APARECEM SEMPRE, mesmo zeradas. Mostrar só as que têm
  // lançamento escondia a informação mais útil da tela: hoje **doze bases não
  // lançaram nada em {ANO_ATUAL}**, e isso é um fato sobre a operação, não uma
  // lista vazia pra esconder. Base zerada fica apagada e não é clicável.
  const contagemBase = useMemo(() => {
    const m = new Map<string, number>();
    doAno.forEach(r => m.set(r.base, (m.get(r.base) || 0) + 1));
    return BASES.map(b => ({ base: b, qtd: m.get(b) || 0 }));
  }, [doAno]);

  const basesSemLancamento = useMemo(() =>
    contagemBase.filter(b => b.qtd === 0).map(b => b.base), [contagemBase]);

  // Quanto do ano já tem a coluna BASE preenchida de verdade. Enquanto for
  // menos que tudo, o resto está sendo deduzido do nome do contrato, e o
  // gerente merece saber disso ao olhar o filtro de base.
  const preenchimentoBase = useMemo(() => {
    const doAnoTodo = registros.filter(r => r.data && r.data.slice(0, 4) === String(ANO_ATUAL));
    const daColuna = doAnoTodo.filter(r => r.baseVeioDaColuna).length;
    return { total: doAnoTodo.length, daColuna };
  }, [registros]);

  // O filtro de contrato mostra só os contratos da base escolhida: foi o
  // pedido, e evita a lista de dezenas de nomes que ninguém varre com o olho.
  const contratosDaBase = useMemo(() => {
    const m = new Map<string, number>();
    doAno.filter(r => !base || r.base === base)
      .forEach(r => { if (r.contratoChave) m.set(r.contratoChave, (m.get(r.contratoChave) || 0) + 1); });
    return [...m.entries()]
      .map(([chave, qtd]) => ({ chave, nome: nomesContrato.get(chave) || chave, qtd }))
      .sort((a, b) => b.qtd - a.qtd);
  }, [doAno, base, nomesContrato]);

  // Trocar de base com um contrato de outra base ainda selecionado deixaria a
  // tela vazia sem explicar por quê.
  useEffect(() => {
    if (contrato && !contratosDaBase.some(c => c.chave === contrato)) setContrato('');
  }, [contratosDaBase, contrato]);

  const visiveis = useMemo(() =>
    doAno.filter(r => (!base || r.base === base) && (!contrato || r.contratoChave === contrato)),
    [doAno, base, contrato]);

  // 🔑 Um mês fora da faixa desenhada não existe pra ninguém. Se o gráfico
  // encolher (virada de ano) e a escolha continuar guardada, o card mostraria
  // um mês que não está mais na linha, sem nada na tela explicando.
  useEffect(() => {
    if (mesEscolhido !== null && mesEscolhido > new Date().getMonth()) setMesEscolhido(null);
  }, [mesEscolhido]);

  const geradas = useMemo(() => visiveis.reduce((s, r) => s + r.horas, 0), [visiveis]);
  const compensadas = useMemo(() =>
    visiveis.filter(r => r.situacao === 'Compensa').reduce((s, r) => s + r.horas, 0), [visiveis]);
  const aPagar = useMemo(() =>
    visiveis.filter(r => r.situacao === 'Hora Extra').reduce((s, r) => s + r.horas, 0), [visiveis]);
  const pessoas = useMemo(() => new Set(visiveis.map(r => r.nomeChave)).size, [visiveis]);
  const pct = (v: number) => geradas > 0 ? `${Math.round((v / geradas) * 100)}%` : '';

  // Mês a mês do ano corrente, com os 12 meses sempre presentes: mês sem
  // lançamento tem que aparecer como zero, senão a linha "pula" o buraco e
  // some a informação de que naquele mês não houve nada.
  const serie = useMemo(() => {
    const m = new Map<number, { Geradas: number; Compensadas: number; 'A pagar': number }>();
    // Vai só até o mês corrente. Desenhar set/out/nov/dez zerados faz a linha
    // despencar no fim do gráfico, e quem bate o olho lê queda de hora extra
    // onde na verdade é mês que ainda não aconteceu.
    const ultimoMes = new Date().getMonth();
    for (let i = 0; i <= ultimoMes; i++) m.set(i, { Geradas: 0, Compensadas: 0, 'A pagar': 0 });
    visiveis.forEach(r => {
      // Sem o `if`, um registro num mês fora da faixa daria `undefined` e
      // derrubaria a guia inteira em vez de faltar um ponto no gráfico.
      const a = m.get(+r.data!.slice(5, 7) - 1);
      if (!a) return;
      a.Geradas += r.horas;
      if (r.situacao === 'Compensa') a.Compensadas += r.horas;
      else if (r.situacao === 'Hora Extra') a['A pagar'] += r.horas;
    });
    return [...m.entries()].map(([i, v]) => ({
      mes: MESES[i],
      Geradas: +v.Geradas.toFixed(2),
      Compensadas: +v.Compensadas.toFixed(2),
      'A pagar': +v['A pagar'].toFixed(2),
    }));
  }, [visiveis]);

  // Sem base escolhida a comparação útil é entre as bases; escolhida uma base,
  // entre os contratos dela; escolhido um contrato, entre as pessoas. O card é
  // o mesmo, o que muda é o que está sendo comparado.
  //
  // 🔑 A ORDEM É PELO QUE VIRA FOLHA (`pagar`), não pelo total gerado, e essa é
  // a mudança de 10/09: base que gera muita hora e compensa quase tudo não
  // custa dinheiro, e liderar um ranking de "geradas" a faria parecer o
  // problema. Quem manda aqui é o que sai do caixa.
  //
  // 🔑 O CARD RESPONDE AO MÊS CLICADO NO GRÁFICO, as pílulas do topo NÃO. É de
  // propósito: as pílulas são o retrato do ano e servem de referência fixa, e
  // o card é a lupa que abre um ponto da linha. Por isso o card diz em cima de
  // que mês ele está falando e traz o caminho de volta pro acumulado, senão
  // seria número de setembro debaixo de uma pílula que fala do ano.
  const visiveisDoCard = useMemo(() =>
    mesEscolhido === null
      ? visiveis
      : visiveis.filter(r => +r.data!.slice(5, 7) - 1 === mesEscolhido),
    [visiveis, mesEscolhido]);

  const rankingCompleto = useMemo(() => {
    const chave = contrato ? (r: Registro) => r.nomeChave
      : base ? (r: Registro) => r.contratoChave
        : (r: Registro) => r.base;
    const nomes = contrato ? nomesPessoa : base ? nomesContrato : null;
    const m = new Map<string, { geradas: number; compensadas: number; pagar: number }>();
    visiveisDoCard.forEach(r => {
      const k = chave(r); if (!k) return;
      const a = m.get(k) || { geradas: 0, compensadas: 0, pagar: 0 };
      a.geradas += r.horas;
      if (r.situacao === 'Compensa') a.compensadas += r.horas;
      else if (r.situacao === 'Hora Extra') a.pagar += r.horas;
      m.set(k, a);
    });
    return [...m.entries()]
      .map(([k, v]) => ({ chave: k, nome: nomes ? (nomes.get(k) || k) : k, ...v }))
      // Empate em zero a pagar é comum (base que compensa tudo). Aí o desempate
      // é pelas geradas, senão a ordem muda sozinha a cada leitura da planilha.
      .sort((a, b) => (b.pagar - a.pagar) || (b.geradas - a.geradas));
  }, [visiveisDoCard, base, contrato, nomesContrato, nomesPessoa]);

  const ranking = useMemo(() => rankingCompleto.slice(0, 20), [rankingCompleto]);

  // 🔴 Cheguei a pôr uma faixa de TOTAL no rodapé do card e ele mandou tirar
  // em 10/09: o total do mês já está no tooltip do gráfico, e a faixa comia
  // altura da lista pra repetir número. Não repor sem ele pedir.

  // 🔥 CLICAR NO GRÁFICO FAZIA AS TRÊS LINHAS SE DESENHAREM DE NOVO, do zero,
  // e a tela inteira parecia estar recarregando por causa de um filtro que nem
  // toca no gráfico. Duas causas somadas:
  //   1. a linha de referência entrava como PRIMEIRO filho do LineChart, o que
  //      empurra os irmãos de posição e faz o React remontar as três <Line>;
  //   2. remontada, cada <Line> reproduz a animação de entrada.
  // Por isso a animação está desligada nas linhas: elas só se desenham quando
  // o dado muda de verdade, e um clique de destaque não é mudança de dado.
  //
  // 🔑 O destaque é feito nos PONTOS, não na linha: o mês escolhido ganha um
  // ponto grande de miolo branco e os outros ficam apagados. A linha inteira
  // perde força junto, mas continua desenhada, porque apagar o traçado tiraria
  // justamente a leitura de subida e descida que faz o gráfico existir.
  const pontoDe = (cor: string) => (props: any) => {
    const { cx, cy, index, payload } = props;
    const chave = `ponto-${cor}-${index}`;
    if (cx == null || cy == null) return <g key={chave} />;
    if (mesEscolhido === null) {
      return <circle key={chave} cx={cx} cy={cy} r={3} fill={cor} />;
    }
    const destacado = payload?.mes === MESES[mesEscolhido];
    if (!destacado) return <circle key={chave} cx={cx} cy={cy} r={2.5} fill={cor} opacity={0.3} />;
    return (
      <circle key={chave} cx={cx} cy={cy} r={5} fill="#fff" stroke={cor} strokeWidth={2.5} />
    );
  };
  const opacidadeLinha = mesEscolhido === null ? 1 : 0.3;

  const rotuloRanking = contrato ? 'Funcionários' : base ? 'Contratos' : 'Bases';
  const rotuloColuna = contrato ? 'Funcionário' : base ? 'Contrato' : 'Base';

  if (carregando) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#94A3B8', fontWeight: 600 }}>Lendo a planilha...</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12,
          padding: '18px 22px', maxWidth: 520, textAlign: 'center',
        }}>
          <AlertTriangle size={22} color="#B91C1C" style={{ marginBottom: 8 }} />
          <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: '#B91C1C' }}>
            Não deu pra ler a planilha
          </p>
          <p style={{ margin: '0 0 4px', fontSize: 12, color: '#7F1D1D' }}>{erro}</p>
          <p style={{ margin: '0 0 14px', fontSize: 11, color: '#991B1B' }}>
            Esta tela fica vazia quando a leitura falha, porque número velho passando
            por atual é pior que tela vazia.
          </p>
          <button onClick={buscar} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, background: '#B91C1C',
            color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px',
            cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
          }}>
            <RefreshCw size={13} /> Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── Os três números e os dois filtros ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
        {/* 🔑 Primeira da fila de propósito: ela é o escopo de tudo que vem
            depois, e lida por último não resolve a dúvida de ninguém. */}
        <Pilula label="Acumulado" valor={periodoCurto()} discreta icone={<CalendarRange size={16} />} />
        <Pilula label="Geradas" valor={fmtH(geradas)} icone={<Clock size={16} />} />
        <Pilula label="Compensadas" valor={fmtH(compensadas)} sub={pct(compensadas)}
          icone={<Scale size={16} />} cor={COR_COMPENSADAS} />
        <Pilula label="A pagar" valor={fmtH(aPagar)} sub={pct(aPagar)}
          icone={<TrendingUp size={16} />} cor={COR_PAGAR} />
        <Pilula label="Pessoas" valor={String(pessoas)} icone={<Users size={16} />} />

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <select value={base} onChange={e => setBase(e.target.value)} style={seletor}>
            <option value="">Todas as bases ({contagemBase.length})</option>
            {contagemBase.map(b => (
              <option key={b.base} value={b.base} disabled={b.qtd === 0}>
                {b.base} {b.qtd ? `(${fmtNum(b.qtd)})` : '— sem lançamento'}
              </option>
            ))}
          </select>

          <select value={contrato} onChange={e => setContrato(e.target.value)}
            style={{ ...seletor, maxWidth: 250 }}>
            <option value="">{base ? `Todos os contratos de ${base}` : 'Todos os contratos'}</option>
            {contratosDaBase.map(c => (
              <option key={c.chave} value={c.chave}>{c.nome} ({c.qtd})</option>
            ))}
          </select>

          <button onClick={buscar} title="Reler a planilha agora" style={{
            ...seletor, display: 'flex', alignItems: 'center', gap: 5, color: '#64748B',
          }}>
            <RefreshCw size={13} /> {lidoEm}
          </button>
        </div>
      </div>

      {/* Base zerada é informação, não lista vazia: doze bases não lançarem
          nada no ano é um fato sobre a operação que o gerente deve enxergar. */}
      {basesSemLancamento.length > 0 && !base && (
        <div style={{
          flexShrink: 0, fontSize: 11, color: '#94A3B8', padding: '0 2px',
        }}>
          Sem nenhum lançamento em {ANO_ATUAL}:{' '}
          <strong style={{ color: '#64748B' }}>{basesSemLancamento.join(', ')}</strong>
          {' '}({basesSemLancamento.length} das {BASES.length} bases)
          {preenchimentoBase.daColuna < preenchimentoBase.total && (
            <>
              {' · '}
              a coluna BASE da planilha está preenchida em{' '}
              <strong style={{ color: '#64748B' }}>
                {fmtNum(preenchimentoBase.daColuna)} de {fmtNum(preenchimentoBase.total)}
              </strong>
              {' '}registros do ano; no resto a base é deduzida do nome do contrato
            </>
          )}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 470px', gap: 12 }}>
        <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Cartao
            titulo={`Mês a mês em ${ANO_ATUAL}`}
            dica="A linha escura é o total gerado, e ela se parte nas outras duas: verde vai pro banco de horas, vermelha vira folha. Clique num mês para abrir a composição dele ao lado."
            cresce={3}
            alturaMinima={260}
          >
            <ResponsiveContainer width="100%" height="100%">
              {/* 🔑 O clique é no GRÁFICO INTEIRO, não no ponto: acertar um
                  círculo de 3px com o mouse é tarefa pra ninguém. O Recharts
                  entrega o mês mais próximo do X clicado em `activeLabel`, o
                  mesmo que ele usa pra decidir qual tooltip mostrar, então o
                  que abre é sempre o mês que estava embaixo do cursor.
                  ⚠️ Voltamos pelo NOME do mês e não pelo índice do ponto: o
                  gráfico só desenha até o mês corrente, e um dia que ele passe
                  a pular mês sem lançamento o índice deixa de ser o mês. */}
              <LineChart
                data={serie}
                margin={{ left: 0, right: 14, top: 10, bottom: 4 }}
                style={{ cursor: 'pointer' }}
                onClick={(e: any) => {
                  const i = MESES.indexOf(String(e?.activeLabel ?? ''));
                  if (i < 0) return;
                  // Clicar de novo no mês que já está aberto volta pro
                  // acumulado: é o caminho de volta mais curto que existe.
                  setMesEscolhido(atual => (atual === i ? null : i));
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748B' }} interval={0} />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} width={44}
                  tickFormatter={(v: number) => `${Math.round(v)}h`} />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div style={{
                        background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8,
                        padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1E293B' }}>{label}</p>
                        {payload.map((p: any) => (
                          <p key={p.name} style={{ margin: '2px 0 0', fontSize: 12, color: p.color, fontWeight: 600 }}>
                            {p.name}: {fmtH(p.value)}
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Geradas" stroke={COR_GERADAS} strokeWidth={2.5}
                  strokeOpacity={opacidadeLinha} isAnimationActive={false}
                  dot={pontoDe(COR_GERADAS)} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="Compensadas" stroke={COR_COMPENSADAS} strokeWidth={2}
                  strokeOpacity={opacidadeLinha} isAnimationActive={false}
                  dot={pontoDe(COR_COMPENSADAS)} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="A pagar" stroke={COR_PAGAR} strokeWidth={2}
                  strokeOpacity={opacidadeLinha} isAnimationActive={false}
                  dot={pontoDe(COR_PAGAR)} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </Cartao>

        </div>

        {/* ── Direita: o ranking do que vira folha ──
            🔴 A PRIMEIRA VERSÃO DISTO ERA BARRA + PORCENTAGEM E ELE NÃO
            ENTENDEU, com razão: número solto sem rótulo em cima não diz o que
            é, e a faixa cinza da barra se confundia com a linha que separa uma
            linha da outra. Virou tabela com cabeçalho. Se for mexer aqui de
            novo, a régua é essa: cada número precisa de um título em cima. */}
        <Cartao
          titulo={`${rotuloRanking} com mais horas a pagar`}
          dica={mesEscolhido !== null
            ? `Só ${MESES_LONGOS[mesEscolhido]} de ${ANO_ATUAL}, o mês aberto no gráfico. As geradas se partem em duas: compensadas vai pro banco de horas, a pagar vira folha.`
            : `${periodoLongo()}. As geradas se partem em duas: compensadas vai pro banco de horas, a pagar vira folha.`}
          acao={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              {/* Sem esta saída, quem clica num mês fica preso nele sem
                  perceber e lê o mês achando que é o ano. */}
              {mesEscolhido !== null && (
                <button onClick={() => setMesEscolhido(null)} style={{
                  display: 'flex', alignItems: 'center', gap: 4, background: '#F1F5F9',
                  border: '1px solid #E2E8F0', borderRadius: 20, padding: '3px 9px',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 10, fontWeight: 700,
                  color: '#475569',
                }}>
                  {MESES_LONGOS[mesEscolhido]}
                  <X size={11} />
                </button>
              )}
              <a href={URL_PLANILHA} target="_blank" rel="noreferrer" style={{
                fontSize: 10, fontWeight: 700, color: '#2563EB', textDecoration: 'none',
              }}>abrir planilha</a>
            </div>
          }
        >
          {ranking.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
              <p style={{ color: '#94A3B8', fontSize: 12, fontWeight: 600, textAlign: 'center' }}>
                {mesEscolhido !== null
                  ? `Nenhum lançamento em ${MESES_LONGOS[mesEscolhido]} dentro do filtro escolhido`
                  : 'Nada no filtro escolhido'}
              </p>
            </div>
          ) : (
            <div className="rolagem-fina" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th style={{ ...tableStyles.th, fontSize: 10, padding: '7px 4px', textAlign: 'center', width: 26 }}>#</th>
                    <th style={{ ...tableStyles.th, fontSize: 10, padding: '7px 6px', textAlign: 'left' }}>{rotuloColuna}</th>
                    <th style={{ ...tableStyles.th, fontSize: 10, padding: '7px 6px', textAlign: 'right', width: 76 }}>Geradas</th>
                    <th style={{ ...tableStyles.th, fontSize: 10, padding: '7px 6px', textAlign: 'right', width: 92, color: COR_COMPENSADAS }}>Compensadas</th>
                    <th style={{ ...tableStyles.th, fontSize: 10, padding: '7px 6px', textAlign: 'right', width: 80, color: COR_PAGAR }}>A pagar</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((q, i) => (
                    <tr key={q.chave} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                      <td style={{
                        ...tableStyles.td, fontSize: 11, padding: '7px 4px', textAlign: 'center',
                        fontWeight: 700, color: i < 3 ? '#1E293B' : '#CBD5E1',
                      }}>{i + 1}</td>
                      <td style={{
                        ...tableStyles.td, fontSize: 11, padding: '7px 6px', fontWeight: 600,
                        color: '#1E293B', maxWidth: 0, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }} title={q.nome}>{q.nome}</td>
                      <td style={{
                        ...tableStyles.td, fontSize: 11, padding: '7px 6px', textAlign: 'right',
                        fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap',
                      }}>{fmtH(q.geradas)}</td>
                      <td style={{
                        ...tableStyles.td, fontSize: 11, padding: '7px 6px', textAlign: 'right',
                        fontWeight: 600, whiteSpace: 'nowrap',
                        color: q.compensadas ? COR_COMPENSADAS : '#CBD5E1',
                      }}>{q.compensadas ? fmtH(q.compensadas) : 'nenhuma'}</td>
                      <td style={{
                        ...tableStyles.td, fontSize: 11, padding: '7px 6px', textAlign: 'right',
                        fontWeight: 700, whiteSpace: 'nowrap',
                        color: q.pagar ? COR_PAGAR : '#CBD5E1',
                      }}>{q.pagar ? fmtH(q.pagar) : 'nenhuma'}</td>
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          )}
        </Cartao>
      </div>
    </>
  );
};

export default HorasExtras;
