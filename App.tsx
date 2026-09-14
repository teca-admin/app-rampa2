
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  salvarLocal, lerLocal, salvarRascunho, lerRascunho, apagarRascunho, rascunhoVelho,
} from './armazenamentoLocal';
import {
  Zap, Sun, Moon, RefreshCcw, Download, Send, WifiOff, Save
} from 'lucide-react';
import { supabase } from './supabase';
import { FleetStat } from './types';

// Subcomponentes
import NewReportTab from './NewReportTab';
import ReportPreview from './ReportPreview';
import { ToastProvider, useToast, SuccessScreen } from './CustomToast';
import GerenciaDashboard from './GerenciaDashboard';
import CoordDashboard from './CoordDashboard';
import AvisoHorarios from './AvisoHorarios';
import { paresInvertidosDoFormulario, ParInvertido } from './horarios';
import ColetaProva from './ColetaProva';
import {
  ProvaLocal, TipoProva, enviarProva, gravarProvaLocal, lerProvaLocal,
  limparProvasLocais, provaVazia, rotuloProva,
} from './provas';

// --- HELPERS ---
const getLocalDateString = () => {
  const now = new Date();
  return now.toLocaleDateString('en-CA'); 
};

// Busca cotação USD→BRL da API pública do Banco Central
const fetchUsdToBrl = async (): Promise<number> => {
  try {
    const res = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL');
    const data = await res.json();
    return parseFloat(data.USDBRL.bid);
  } catch {
    return 5.8; // fallback conservador caso a API falhe
  }
};

// Só a hora, sem a data: o rascunho é do turno em andamento, e a data completa
// ocuparia a linha sem responder nada que o líder já não saiba.
const formatarHoraRascunho = (iso: string): string => {
  const d = new Date(iso);
  return isFinite(d.getTime())
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '--:--';
};

const AppInner: React.FC = () => {
  const { toast } = useToast();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Lógica PWA Install
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const isDarkMode = false;

  // Desktop sempre mostra um dashboard; mobile sempre mostra o formulário
  const [activeView, setActiveView] = useState<'gerencia' | 'coordenacao'>('gerencia');
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Dados necessários para o formulário
  const [leaders, setLeaders] = useState<any[]>([]);
  const [airlines, setAirlines] = useState<string[]>([]);
  const [fleetDetails, setFleetDetails] = useState<any[]>([]);

  // Form State
  const [formDate, setFormDate] = useState(getLocalDateString());
  const [formShift, setFormShift] = useState<'manha' | 'tarde' | 'noite' | 'madrugada'>('manha');
  const [formLeader, setFormLeader] = useState('');
  const [formHR, setFormHR] = useState({ falta: false, detalhe_falta: '', atestado: false, compensacao: false, saida_antecipada: false });
  const [formPendencias, setFormPendencias] = useState('');
  const [formOcorrencias, setFormOcorrencias] = useState('');
  const [formRentals, setFormRentals] = useState<{
    tipo: 'ALOCAR' | 'LOCAR';
    empresa?: string;
    equipamento: string;
    inicio: string;
    fim: string;
    quem_atender?: string;
    motivo_locacao?: string;
  }[]>([]);
  const [formGseOut, setFormGseOut] = useState<{ prefixo: string; motivo: string }[]>([]);
  const [formGseIn, setFormGseIn] = useState<{ prefixo: string }[]>([]);
  const [formFlights, setFormFlights] = useState<any[]>([]);
  const [formTransporte, setFormTransporte] = useState<{ cia: string; manual_name?: string }[]>([]);
  const [formBriefing, setFormBriefing] = useState({ ativo: false, inicio: '', fim: '' });
  const [formDebriefing, setFormDebriefing] = useState({ ativo: false, inicio: '', fim: '' });
  // Km do SPIN, pedido do coordenador em 10/09/2026. Guardado como TEXTO e não
  // como número porque o campo pode estar vazio, e `0` de campo vazio viraria
  // odômetro zerado no banco. A conversão pra número acontece só no payload.
  const [formKmSpin, setFormKmSpin] = useState({ inicial: '', final: '' });
  // OBS do turno, texto livre e opcional, na seção 10. Pedido dele em 11/09/2026.
  const [formObs, setFormObs] = useState('');
  // ─── A prova do briefing e do debriefing, pedido dele em 14/09/2026 ──────
  // 🔑 Fica FORA do rascunho, em chave própria do localStorage. O rascunho é
  // salvo a cada tecla, e carregar a foto reduzida junto faria o formulário
  // engasgar a cada letra digitada. Por isso a leitura inicial é direta do
  // aparelho: quem restaura a prova não é a restauração do rascunho.
  const [provaBriefing, setProvaBriefing] = useState<ProvaLocal>(() => lerProvaLocal('briefing'));
  const [provaDebriefing, setProvaDebriefing] = useState<ProvaLocal>(() => lerProvaLocal('debriefing'));
  const [provaAberta, setProvaAberta] = useState<TipoProva | null>(null);

  const atualizarProva = useCallback((tipo: TipoProva, prova: ProvaLocal) => {
    if (tipo === 'briefing') setProvaBriefing(prova); else setProvaDebriefing(prova);
    // Grava na hora, e não num efeito: a assinatura recolhida some se o Android
    // matar o app no instante seguinte, e é gente que já foi embora.
    if (!gravarProvaLocal(tipo, prova)) {
      toast('Sem espaço no aparelho pra guardar a prova. Finalize o turno antes de continuar.', 'error');
    }
  }, [toast]);

  // ─── Horário invertido (início maior que o fim), entrou em 11/09/2026 ────
  // O caso que motivou: locação 19:23 → 18:26 contada como 23h03 e cobrada
  // R$ 4.320. O aviso abre na hora em que o par fica invertido e, de novo, no
  // "Finalizar turno" se ainda houver par assim sem confirmação. O líder PODE
  // seguir, porque 23:50 → 01:10 é real na virada do 3º turno.
  //
  // Duas listas de chaves, e a chave carrega os horários (mudou o horário,
  // é outro aviso):
  // - perguntados: já apareceu o aviso, qualquer que tenha sido a resposta.
  //   Sem isto, "Corrigir" fecharia o aviso e ele abriria de novo na mesma
  //   hora, porque os horários continuam invertidos até o líder mexer.
  // - confirmados: ele disse "seguir assim mesmo". Só estes passam no envio.
  const [avisoHorarios, setAvisoHorarios] = useState<{ itens: ParInvertido[]; segurandoEnvio: boolean } | null>(null);
  const [horariosPerguntados, setHorariosPerguntados] = useState<Set<string>>(new Set());
  const [horariosConfirmados, setHorariosConfirmados] = useState<Set<string>>(new Set());

  // ─── Offline, entrou em 10/09/2026 ────────────────────────────────────────
  // 🔴 `navigator.onLine` só sabe dizer que NÃO HÁ REDE. Ele responde `true`
  // com wi-fi conectado que não chega a lugar nenhum, que é metade dos casos
  // do pátio. Por isso ele nunca libera nada sozinho: serve pra AVISAR, e a
  // prova de que dá pra gravar continua sendo a gravação em si.
  const [estaOffline, setEstaOffline] = useState(!navigator.onLine);
  const [rascunhoSalvoEm, setRascunhoSalvoEm] = useState<string | null>(null);
  const [rascunhoRestaurado, setRascunhoRestaurado] = useState<string | null>(null);
  // Enquanto não terminar de restaurar, NÃO pode salvar: o primeiro efeito de
  // gravação rodaria com o formulário vazio e apagaria o rascunho que o líder
  // tem no celular, antes de ele ver a tela.
  const prontoParaSalvar = useRef(false);

  // Fluxo do envio: formulário -> prévia -> sucesso. Nada é gravado antes da confirmação.
  const [mobileScreen, setMobileScreen] = useState<'form' | 'preview' | 'success'>('form');
  const [reportPayload, setReportPayload] = useState<any>(null);

  // ─── Rede: só avisa, nunca decide sozinho ────────────────────────────────
  useEffect(() => {
    const online = () => setEstaOffline(false);
    const offline = () => setEstaOffline(true);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  // ─── Restaura o rascunho, UMA vez, antes de qualquer gravação ────────────
  useEffect(() => {
    const r = lerRascunho();
    if (r && !rascunhoVelho(r)) {
      const c = r.campos;
      // Campo a campo e com valor de reserva: rascunho gravado por uma versão
      // anterior do app não tem os campos que nasceram depois, e espalhar
      // `undefined` no estado quebraria a tela na hora de desenhar.
      if (c.formDate) setFormDate(c.formDate);
      if (c.formShift) setFormShift(c.formShift);
      if (c.formLeader) setFormLeader(c.formLeader);
      if (c.formHR) setFormHR(c.formHR);
      if (typeof c.formPendencias === 'string') setFormPendencias(c.formPendencias);
      if (typeof c.formOcorrencias === 'string') setFormOcorrencias(c.formOcorrencias);
      if (Array.isArray(c.formRentals)) setFormRentals(c.formRentals);
      if (Array.isArray(c.formGseOut)) setFormGseOut(c.formGseOut);
      if (Array.isArray(c.formGseIn)) setFormGseIn(c.formGseIn);
      if (Array.isArray(c.formFlights)) setFormFlights(c.formFlights);
      if (Array.isArray(c.formTransporte)) setFormTransporte(c.formTransporte);
      if (c.formBriefing) setFormBriefing(c.formBriefing);
      if (c.formDebriefing) setFormDebriefing(c.formDebriefing);
      if (c.formKmSpin) setFormKmSpin(c.formKmSpin);
      if (typeof c.formObs === 'string') setFormObs(c.formObs);
      setRascunhoSalvoEm(r.salvoEm);
      setRascunhoRestaurado(r.salvoEm);
    } else if (r) {
      // Passou de dois dias: é rascunho esquecido, e restaurar dado velho por
      // cima de um turno novo é pior que não restaurar nada.
      apagarRascunho();
    }
    prontoParaSalvar.current = true;
  }, []);

  // ─── Salva o rascunho a cada mudança ─────────────────────────────────────
  // 🔴 É ISTO que resolve o pedido: o líder preenche ao longo do turno e o app
  // pode fechar, cair ou o celular reiniciar sem perder nada. Não há botão de
  // salvar de propósito, porque botão de salvar é coisa que se esquece de
  // apertar justamente no dia em que o celular morre.
  useEffect(() => {
    if (!prontoParaSalvar.current) return;
    const salvoEm = new Date().toISOString();
    salvarRascunho({
      salvoEm,
      data: formDate,
      turno: formShift,
      lider: formLeader,
      campos: {
        formDate, formShift, formLeader, formHR, formPendencias, formOcorrencias,
        formRentals, formGseOut, formGseIn, formFlights, formTransporte,
        formBriefing, formDebriefing, formKmSpin, formObs,
      },
    });
    setRascunhoSalvoEm(salvoEm);
  }, [formDate, formShift, formLeader, formHR, formPendencias, formOcorrencias,
      formRentals, formGseOut, formGseIn, formFlights, formTransporte,
      formBriefing, formDebriefing, formKmSpin, formObs]);

  // ─── Abre o aviso assim que um par de horários fica invertido ────────────
  // Roda a cada mudança nos quatro lugares que têm início e fim (locações,
  // voos, briefing e debriefing) e abre UM aviso por vez, só pra par que ainda
  // não foi perguntado. Também dispara ao restaurar o rascunho, e é bom que
  // dispare: o par invertido de ontem continua invertido hoje.
  useEffect(() => {
    if (avisoHorarios) return;
    const pendente = paresInvertidosDoFormulario({ formRentals, formFlights, formBriefing, formDebriefing })
      .find(p => !horariosPerguntados.has(p.chave));
    if (pendente) setAvisoHorarios({ itens: [pendente], segurandoEnvio: false });
  }, [formRentals, formFlights, formBriefing, formDebriefing, horariosPerguntados, avisoHorarios]);

  const responderAvisoHorarios = (seguir: boolean) => {
    if (!avisoHorarios) return;
    const chaves = avisoHorarios.itens.map(p => p.chave);
    setHorariosPerguntados(prev => new Set([...prev, ...chaves]));
    if (seguir) setHorariosConfirmados(prev => new Set([...prev, ...chaves]));
    const segurava = avisoHorarios.segurandoEnvio;
    setAvisoHorarios(null);
    if (seguir && segurava) montarPrevia();
  };

  // Regra de data automática: se o turno não for madrugada, reseta para hoje
  useEffect(() => {
    if (formShift !== 'madrugada') {
      const today = getLocalDateString();
      if (formDate !== today) {
        setFormDate(today);
      }
    }
  }, [formShift, formDate]);

  const resetForm = useCallback(() => {
    setFormDate(getLocalDateString());
    setFormShift('manha');
    setFormLeader('');
    setFormHR({ falta: false, detalhe_falta: '', atestado: false, compensacao: false, saida_antecipada: false });
    setFormPendencias('');
    setFormOcorrencias('');
    setFormRentals([]);
    setFormGseOut([]);
    setFormGseIn([]);
    setFormFlights([]);
    setFormTransporte([]);
    setFormBriefing({ ativo: false, inicio: '', fim: '' });
    setFormDebriefing({ ativo: false, inicio: '', fim: '' });
    setFormKmSpin({ inicial: '', final: '' });
    setFormObs('');
    // A prova morre junto com o formulário, pelo mesmo motivo do rascunho:
    // sobrando, o turno seguinte abriria com a lista de presença do anterior.
    setProvaBriefing(provaVazia());
    setProvaDebriefing(provaVazia());
    setProvaAberta(null);
    limparProvasLocais();
    setAvisoHorarios(null);
    setHorariosPerguntados(new Set());
    setHorariosConfirmados(new Set());
    // 🔑 O rascunho morre junto com o formulário. Ele existe pra atravessar o
    // turno, e turno entregue não tem mais rascunho: deixar sobrando faria o
    // próximo turno abrir com o relatório do anterior dentro.
    apagarRascunho();
    setRascunhoSalvoEm(null);
    setRascunhoRestaurado(null);
  }, []);

  // 🔑 Cada lista que chega do banco é ESPELHADA no celular, e quando a busca
  // falha o app cai no espelho em vez de ficar vazio. Sem isto o líder abre o
  // app sem sinal e não tem o próprio nome pra escolher, nem a frota, nem as
  // companhias: o formulário aparece e não dá pra preencher nada.
  // ⚠️ O espelho só é reescrito quando vem lista NÃO VAZIA. Uma resposta vazia
  // por falha de rede apagaria o espelho bom e deixaria o líder pior do que
  // antes de ter internet.
  const fetchData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);

      const { data: equips } = await supabase.from('equipamentos').select('*').order('prefixo', { ascending: true });
      if (equips && equips.length) { setFleetDetails(equips); salvarLocal('frota', equips); }
      else setFleetDetails(lerLocal<any[]>('frota', []));

      const { data: leadersData } = await supabase.from('lideres').select('*').order('nome', { ascending: true });
      if (leadersData && leadersData.length) { setLeaders(leadersData); salvarLocal('lideres', leadersData); }
      else setLeaders(lerLocal<any[]>('lideres', []));

      const { data: airlinesData } = await supabase.from('companhias_aereas').select('nome').order('nome', { ascending: true });
      if (airlinesData && airlinesData.length) {
        const nomes = airlinesData.map(a => a.nome);
        setAirlines(nomes); salvarLocal('companhias', nomes);
      } else setAirlines(lerLocal<string[]>('companhias', []));

      // 🔴 A lista de quem pode assinar entra no espelho JUNTO COM AS OUTRAS, na
      // abertura do app, e não só quando o líder abre a coleta. A coleta é feita
      // no pátio, no meio do turno, que é justo onde não tem sinal: esperar o
      // primeiro toque pra buscar faria o líder abrir a lista de presença sem
      // ninguém dentro. Aqui o app não usa a lista, só garante que ela está no
      // aparelho quando precisar.
      const { data: pessoal } = await supabase
        .from('funcionarios').select('matricula, nome, funcao, ativo').order('nome', { ascending: true });
      if (pessoal && pessoal.length) salvarLocal('funcionarios', pessoal);

    } catch (err) {
      // Sem rede o Supabase estoura antes de devolver qualquer coisa, e é aqui
      // que o espelho salva o turno.
      console.error(err);
      setFleetDetails(lerLocal<any[]>('frota', []));
      setLeaders(lerLocal<any[]>('lideres', []));
      setAirlines(lerLocal<string[]>('companhias', []));
    } finally { if (!isSilent) setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddAirline = useCallback(async (nome: string) => {
    const { error } = await supabase.from('companhias_aereas').insert({ nome });
    if (error) { toast('Erro ao cadastrar: ' + error.message, 'error'); return; }
    fetchData(true);
  }, [fetchData]);

  const handleAddEquipamento = useCallback(async (prefixo: string, nome: string) => {
    const { error } = await supabase.from('equipamentos').insert({ prefixo, nome, status: 'OPERACIONAL' });
    if (error) { toast('Erro ao cadastrar: ' + error.message, 'error'); return; }
    fetchData(true);
  }, [fetchData]);

  // PASSO 1: monta o payload e vai para a prévia. Nada é gravado aqui.
  // 🔑 Antes de montar, segura se ainda houver par de horários invertido que
  // o líder não confirmou. É a segunda chance do aviso: a primeira foi na hora
  // de digitar, e "Corrigir" sem corrigir de fato chegaria aqui calado.
  const handleGoToPreview = () => {
    if (!formLeader) { toast('Selecione o Líder!', 'warning'); return; }
    // 🔴 Briefing ligado exige prova. É o pedido dele de 14/09: a informação do
    // briefing só vale acompanhada de quem estava e da foto. Segura aqui, e
    // não na confirmação, porque a essa altura o líder ainda está no pátio,
    // com as pessoas por perto pra assinar.
    const semProva = ([['briefing', formBriefing, provaBriefing], ['debriefing', formDebriefing, provaDebriefing]] as const)
      .filter(([, campo, prova]) => campo.ativo && (!prova.foto || prova.assinaturas.length === 0));
    if (semProva.length > 0) {
      const [tipo, , prova] = semProva[0];
      const falta = !prova.foto && prova.assinaturas.length === 0
        ? 'a foto e a lista de presença'
        : (!prova.foto ? 'a foto dos participantes' : 'a lista de presença');
      toast(`${rotuloProva(tipo)}: falta ${falta}.`, 'warning');
      setProvaAberta(tipo);
      return;
    }
    const pendentes = paresInvertidosDoFormulario({ formRentals, formFlights, formBriefing, formDebriefing })
      .filter(p => !horariosConfirmados.has(p.chave));
    if (pendentes.length > 0) {
      setAvisoHorarios({ itens: pendentes, segurandoEnvio: true });
      return;
    }
    montarPrevia();
  };

  const montarPrevia = async () => {
    setIsSubmitting(true);
    try {
      // Buscar cotação do dólar para registros com fornecedor Gol
      const temLocacaoGol = formRentals.some(r => r.tipo === 'LOCAR' && r.empresa === 'Gol');
      let usdToBrl = 1;
      if (temLocacaoGol) {
        usdToBrl = await fetchUsdToBrl();
      }

      // Buscar preços da tabela de locação (invisível no app, apenas para registro)
      const { data: tabelaPrecos } = await supabase
        .from('tabela_precos_locacao')
        .select('fornecedor, equipamento, valor_hora, moeda');

      // Enriquecer locações externas com dados de custo (não exibidos no app)
      const locacoesEnriquecidas = formRentals.map(loc => {
        if (loc.tipo !== 'LOCAR' || !loc.empresa || !loc.equipamento) return loc;

        const preco = tabelaPrecos?.find(
          p => p.fornecedor.toLowerCase() === loc.empresa!.toLowerCase() &&
               p.equipamento.toLowerCase() === loc.equipamento.toLowerCase()
        );

        let valor_hora_brl: number | null = null;
        let valor_hora_original: number | null = null;
        let moeda: string | null = null;
        let cotacao_usd_brl: number | null = null;

        if (preco) {
          valor_hora_original = preco.valor_hora;
          moeda = preco.moeda;
          if (preco.moeda === 'USD') {
            valor_hora_brl = parseFloat((preco.valor_hora * usdToBrl).toFixed(2));
            cotacao_usd_brl = usdToBrl;
          } else {
            valor_hora_brl = preco.valor_hora;
          }
        }

        return {
          ...loc,
          valor_hora_original,
          moeda,
          valor_hora_brl,
          cotacao_usd_brl,
        };
      });

      const payload = {
        data: formDate,
        turno: formShift === 'manha' ? 'manhã' : formShift,
        lider: formLeader,
        teve_falta: formHR.falta,
        detalhe_falta: formHR.detalhe_falta,
        teve_atestado: formHR.atestado,
        teve_compensacao: formHR.compensacao,
        teve_saida_antecipada: formHR.saida_antecipada,
        descricao_pendencias: formPendencias || "Não",
        descricao_ocorrencias: formOcorrencias || "Não",
        locacoes: locacoesEnriquecidas,
        voos: formFlights.filter(v => v.companhia).map(v => ({
          companhia: v.companhia === 'OUTROS' ? (v.manual_name || 'OUTROS') : v.companhia,
          numero: v.numero || 'S/N', inicio: v.pouso, fim: v.reboque
        })),
        transporte_tripulacao: formTransporte.map(t => ({
          cia: t.cia === 'OUTROS' ? (t.manual_name || 'OUTROS') : t.cia
        })),
        gse_enviados: formGseOut,
        gse_retornados: formGseIn,
        tem_equipamento_enviado: formGseOut.length > 0,
        tem_equipamento_retornado: formGseIn.length > 0,
        // 🔑 Vazio vira NULL, nunca 0: o painel precisa separar "o líder não
        // preencheu" de "o carro não rodou". Zero seria a segunda coisa.
        km_spin_inicial: formKmSpin.inicial.trim() === '' ? null : Number(formKmSpin.inicial),
        km_spin_final: formKmSpin.final.trim() === '' ? null : Number(formKmSpin.final),
        // Vazio vira NULL: OBS em branco é o caso normal, não é dado.
        observacoes: formObs.trim() === '' ? null : formObs.trim(),
        briefing_inicio: formBriefing.ativo ? (formBriefing.inicio || null) : null,
        briefing_fim: formBriefing.ativo ? (formBriefing.fim || null) : null,
        debriefing_inicio: formDebriefing.ativo ? (formDebriefing.inicio || null) : null,
        debriefing_fim: formDebriefing.ativo ? (formDebriefing.fim || null) : null,
        // 🔑 A id da prova entra AQUI, ainda sem o caminho da foto: a foto só
        // ganha caminho depois de subir, na confirmação. A id, não: ela nasceu
        // no celular quando o líder abriu a lista, e é por ela que as
        // assinaturas já gravadas se acham.
        briefing_prova_id: formBriefing.ativo ? provaBriefing.provaId : null,
        briefing_foto: null,
        debriefing_prova_id: formDebriefing.ativo ? provaDebriefing.provaId : null,
        debriefing_foto: null,
      };

      setReportPayload(payload);
      setMobileScreen('preview');
    } catch (err: any) {
      toast(err.message || 'Erro ao montar o relatório', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // PASSO 2: só agora grava. Devolve true se gravou, para a prévia saber se pode
  // abrir o WhatsApp. Se o banco falhar, o líder continua na prévia e tenta de novo.
  const handleConfirmSend = async (): Promise<boolean> => {
    if (!reportPayload) return false;
    // 🔑 Sem rede, nem tenta. A regra da casa continua a mesma: se a gravação
    // falhar, o WhatsApp não abre, porque mandar no grupo um relatório que não
    // existe no sistema é pior que não mandar. O que muda é a EXPLICAÇÃO: sem
    // isto o líder levava um erro de banco e não entendia que era a internet,
    // nem que o que ele digitou está guardado.
    if (!navigator.onLine) {
      toast('Sem internet. O relatório está guardado no aparelho: envie quando a rede voltar.', 'error');
      return false;
    }
    setIsSubmitting(true);
    try {
      // ─── A prova sobe ANTES do relatório ───────────────────────────────
      // 🔑 Nesta ordem de propósito, e é a mesma regra do WhatsApp: relatório
      // dizendo que houve briefing sem a prova que o acompanha é meia verdade,
      // e meia verdade gravada é pior que tentar de novo. Falhou, nada é
      // gravado e tudo continua no aparelho.
      //
      // 📌 O que já subiu NÃO volta a subir: a foto guarda o caminho e as
      // assinaturas gravadas saem da lista local. Uma segunda tentativa manda
      // só o que faltou, e a trava de "esta pessoa já assinou" cobre o resto.
      const payload: any = { ...reportPayload };

      for (const [tipo, ativo, prova] of ([
        ['briefing', formBriefing.ativo, provaBriefing],
        ['debriefing', formDebriefing.ativo, provaDebriefing],
      ] as const)) {
        if (!ativo || (!prova.foto && prova.assinaturas.length === 0)) continue;

        const resultado = await enviarProva(tipo, prova, formLeader);
        const restante: ProvaLocal = {
          ...prova,
          assinaturas: resultado.faltando,
          fotoArquivo: resultado.fotoArquivo || undefined,
        };
        atualizarProva(tipo, restante);

        if (resultado.faltando.length > 0 || !resultado.fotoArquivo) {
          toast(
            `A prova do ${rotuloProva(tipo).toLowerCase()} não subiu inteira e o relatório não foi gravado. Tudo continua guardado no aparelho: tente de novo com sinal melhor.`,
            'error',
          );
          return false;
        }

        payload[`${tipo}_prova_id`] = prova.provaId;
        payload[`${tipo}_foto`] = resultado.fotoArquivo;
      }

      const { error } = await supabase.from('relatorios_consolidados').insert([payload]);
      if (error) throw error;

      if (formGseOut.length > 0) {
        await supabase.from('equipamentos').update({ status: 'MANUTENCAO' }).in('prefixo', formGseOut.map(i => i.prefixo));
        await supabase.from('historico_status_equipamentos').insert(
          formGseOut.map(gse => ({
            prefixo: gse.prefixo,
            status_novo: 'MANUTENCAO',
            motivo: gse.motivo,
            data: formDate,
            turno: formShift === 'manha' ? 'manhã' : formShift,
            lider: formLeader,
          }))
        );
      }
      if (formGseIn.length > 0) {
        await supabase.from('equipamentos').update({ status: 'OPERACIONAL' }).in('prefixo', formGseIn.map(i => i.prefixo));
        await supabase.from('historico_status_equipamentos').insert(
          formGseIn.map(gse => ({
            prefixo: gse.prefixo,
            status_novo: 'OPERACIONAL',
            data: formDate,
            turno: formShift === 'manha' ? 'manhã' : formShift,
            lider: formLeader,
          }))
        );
      }

      setMobileScreen('success');
      fetchData(true);
      return true;
    } catch (err: any) {
      toast(err.message || 'Erro ao salvar o relatório', 'error');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToForm = () => setMobileScreen('form');

  const handleSuccessClose = () => {
    resetForm();
    setReportPayload(null);
    setMobileScreen('form');
  };

  const themeClasses = {
    bgMain: isDarkMode ? 'bg-[#0f172a]' : 'bg-[#f8fafc]',
    bgCard: isDarkMode ? 'bg-[#1e293b]' : 'bg-white',
    bgInput: isDarkMode ? 'bg-[#0f172a]' : 'bg-[#f1f5f9]',
    border: isDarkMode ? 'border-white/10' : 'border-slate-200',
    textMain: isDarkMode ? 'text-slate-100' : 'text-slate-900',
    textMuted: isDarkMode ? 'text-slate-400' : 'text-slate-400',
    textHeader: isDarkMode ? 'text-white' : 'text-slate-900',
  };

  return (
    <div className={`h-screen ${themeClasses.bgMain} ${themeClasses.textMain} flex flex-col font-sans overflow-hidden transition-colors duration-300`}>
      <header className={`flex-none ${isDarkMode ? 'bg-[#1e293b] border-white/10' : 'bg-white border-slate-200'} border-b px-6 py-4 flex items-center justify-between shadow-xl z-20`}>
        <div className="flex items-center gap-4">
          {isMobile ? (
            // Mobile: logo do app + nome
            <>
              <div className="bg-white p-1 rounded shadow-lg overflow-hidden flex items-center justify-center w-[38px] h-[38px]">
                <img
                  src="https://drive.google.com/thumbnail?id=1Cfxz5qZPqBEZWVTN4QPhuXfqzuNcvMwR&sz=w512"
                  alt="Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex flex-col">
                <h1 className={`text-xl font-black italic uppercase leading-none ${themeClasses.textHeader}`}>Ramp<span className="text-blue-500">Controll</span></h1>
                <span className="text-[7px] font-black text-emerald-500 uppercase tracking-widest mt-0.5 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span> PWA Ativo
                </span>
              </div>
            </>
          ) : (
            // Desktop: logo WFS + título do dashboard
            <>
              <img
                src="https://drive.google.com/thumbnail?id=1sNzDKhdh2zH8d8DoyqIjx8l5LzBEXN5g&sz=w512"
                alt="WFS"
                style={{ height: 52, objectFit: 'contain' }}
              />
              <div style={{ borderLeft: '2px solid #E2E8F0', paddingLeft: 14, marginLeft: 4 }}>
                <p style={{ fontSize: 11, color: '#94A3B8', margin: 0, lineHeight: 1.3, fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>Dashboard de</p>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: '#EF4444', margin: 0, lineHeight: 1, fontFamily: "'Inter', sans-serif" }}>
                  {activeView === 'gerencia' ? 'Gerência' : 'Coordenação'}
                </h1>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Seletor de dashboard — visível apenas em desktop */}
          {!isMobile && (
            <div style={{ display: 'flex', gap: 6, background: '#F1F5F9', borderRadius: 8, padding: 4 }}>
              {(['gerencia', 'coordenacao'] as const).map(view => {
                const label = view === 'gerencia' ? 'Gerência' : 'Coordenação';
                const active = activeView === view;
                return (
                  <button
                    key={view}
                    onClick={() => setActiveView(active ? 'report' : view)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "'Inter', sans-serif",
                      background: active ? '#1E293B' : 'transparent',
                      color: active ? '#fff' : '#64748B',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Instalar App — apenas no mobile */}
          {isMobile && deferredPrompt && (
            <button
              onClick={handleInstallApp}
              className="flex items-center gap-2 h-[42px] px-4 rounded-sm border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all animate-pulse"
              title="Instalar Aplicativo"
            >
              <Download size={18} />
              <span className="hidden md:inline text-[10px] font-black uppercase italic">Instalar App</span>
            </button>
          )}
          <button onClick={() => fetchData()} className={`p-2.5 h-[42px] w-[42px] flex items-center justify-center rounded-sm border ${themeClasses.border} ${isDarkMode ? 'bg-[#334155]' : 'bg-slate-100'} text-slate-400 hover:text-blue-500 transition-all`}>
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <main className={`flex-1 overflow-hidden${isMobile ? ' p-3 max-w-[1200px] mx-auto w-full' : ''}`}>
        {isMobile ? (
          // Mobile: formulário -> prévia -> sucesso (a de sucesso é tela cheia)
          loading ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20">
              <RefreshCcw size={48} className="animate-spin text-blue-500 mb-4" />
              <p className="font-black uppercase italic tracking-widest">Sincronizando Dados...</p>
            </div>
          ) : mobileScreen === 'preview' && reportPayload ? (
            <ReportPreview
              reportPayload={reportPayload}
              onBack={handleBackToForm}
              onConfirmSend={handleConfirmSend}
              isSubmitting={isSubmitting}
            />
          ) : (
            <div className="h-full flex flex-col gap-2 overflow-hidden">
              {/* ── Estado da rede e do rascunho ──
                  Fica no App e não dentro do formulário de propósito: o
                  NewReportTab é o arquivo que já foi revertido uma vez, e o
                  aviso não precisa estar lá dentro pra ser visto. */}
              {estaOffline && (
                <div className="flex-shrink-0 flex items-start gap-2 bg-amber-500/10 border border-amber-500/40 text-amber-600 px-3 py-2 rounded-sm">
                  <WifiOff size={14} className="mt-[2px] flex-shrink-0" />
                  <p className="text-[9px] font-black uppercase italic leading-relaxed">
                    Sem internet. Pode preencher normalmente, que fica guardado no aparelho.
                    O envio pelo WhatsApp só funciona quando a rede voltar.
                  </p>
                </div>
              )}
              {rascunhoRestaurado && (
                <div className="flex-shrink-0 flex items-center gap-2 bg-blue-500/10 border border-blue-500/40 text-blue-600 px-3 py-2 rounded-sm">
                  <Save size={14} className="flex-shrink-0" />
                  <p className="flex-1 text-[9px] font-black uppercase italic leading-relaxed">
                    Recuperamos o que você já tinha preenchido, de {formatarHoraRascunho(rascunhoRestaurado)}
                  </p>
                  <button
                    onClick={() => { resetForm(); }}
                    className="flex-shrink-0 text-[9px] font-black uppercase italic underline"
                  >
                    Começar do zero
                  </button>
                </div>
              )}
              {!rascunhoRestaurado && rascunhoSalvoEm && (
                <p className="flex-shrink-0 text-[8px] font-black uppercase italic opacity-30 px-1">
                  Guardado no aparelho às {formatarHoraRascunho(rascunhoSalvoEm)}
                </p>
              )}
            {/* 🔴 ESTA CAIXA NÃO É ENFEITE. A raiz do NewReportTab é `h-full`,
                ou seja, 100% da ALTURA DO PAI. Solto aqui dentro, ele mediria a
                caixa inteira e ignoraria os avisos acima, empurrando o rodapé
                com o botão de finalizar pra fora da tela, justamente quando o
                líder está offline. `flex-1 min-h-0` dá a ele uma altura própria
                de que sobrar, e o `h-full` de dentro passa a medir essa. */}
            <div className="flex-1 min-h-0">
            <NewReportTab
              themeClasses={themeClasses}
              formDate={formDate} setFormDate={setFormDate}
              formShift={formShift} setFormShift={setFormShift}
              formLeader={formLeader} setFormLeader={setFormLeader} leaders={leaders}
              formHR={formHR} setFormHR={setFormHR}
              formPendencias={formPendencias} setFormPendencias={setFormPendencias}
              formOcorrencias={formOcorrencias} setFormOcorrencias={setFormOcorrencias}
              formRentals={formRentals}
              handleAddRental={() => setFormRentals([...formRentals, { tipo: 'ALOCAR', equipamento: '', inicio: '', fim: '' }])}
              handleRemoveRental={i => setFormRentals(formRentals.filter((_, idx) => idx !== i))}
              handleRentalChange={(i, f, v) => { const u = [...formRentals]; (u[i] as any)[f] = v; setFormRentals(u); }}
              formFlights={formFlights}
              handleAddFlight={() => setFormFlights([...formFlights, { companhia: '', numero: 'S/N', pouso: '', reboque: '', manual_name: '' }])}
              handleRemoveFlight={i => setFormFlights(formFlights.filter((_, idx) => idx !== i))}
              handleFlightChange={(i, f, v) => { const u = [...formFlights]; u[i][f] = v; setFormFlights(u); }}
              airlines={airlines}
              formGseOut={formGseOut}
              handleAddGseOut={() => setFormGseOut([...formGseOut, { prefixo: '', motivo: '' }])}
              handleRemoveGseOut={i => setFormGseOut(formGseOut.filter((_, idx) => idx !== i))}
              handleGseOutChange={(i, f, v) => { const u = [...formGseOut]; u[i][f] = v; setFormGseOut(u); }}
              formGseIn={formGseIn}
              handleAddGseIn={() => setFormGseIn([...formGseIn, { prefixo: '' }])}
              handleRemoveGseIn={i => setFormGseIn(formGseIn.filter((_, idx) => idx !== i))}
              handleGseInChange={(i, v) => { const u = [...formGseIn]; u[i].prefixo = v; setFormGseIn(u); }}
              formTransporte={formTransporte}
              handleAddTransporte={() => setFormTransporte([...formTransporte, { cia: '', manual_name: '' }])}
              handleRemoveTransporte={i => setFormTransporte(formTransporte.filter((_, idx) => idx !== i))}
              handleTransporteChange={(i, f, v) => { const u = [...formTransporte]; (u[i] as any)[f] = v; setFormTransporte(u); }}
              fleetDetails={fleetDetails}
              isSubmitting={isSubmitting}
              handleSaveReport={handleGoToPreview}
              resetForm={resetForm}
              setActiveTab={() => {}}
              handleAddAirline={handleAddAirline}
              handleAddEquipamento={handleAddEquipamento}
              formBriefing={formBriefing} setFormBriefing={setFormBriefing}
              formDebriefing={formDebriefing} setFormDebriefing={setFormDebriefing}
              formKmSpin={formKmSpin} setFormKmSpin={setFormKmSpin}
              formObs={formObs} setFormObs={setFormObs}
              provaBriefing={provaBriefing} provaDebriefing={provaDebriefing}
              abrirProva={setProvaAberta}
            />
            </div>
            </div>
          )
        ) : (
          // Desktop: sempre um dashboard
          activeView === 'gerencia' ? <GerenciaDashboard /> : <CoordDashboard />
        )}
      </main>

      <footer className={`flex-none ${isDarkMode ? 'bg-[#0f172a] border-white/10' : 'bg-white border-slate-200'} border-t px-6 py-2 flex justify-center items-center text-[8px] font-black uppercase ${themeClasses.textMuted} italic transition-colors duration-300`}>
        <span>RAMP CONTROLL STABLE V18.0 - PWA MODE</span>
      </footer>

      <SuccessScreen open={mobileScreen === 'success'} onClose={handleSuccessClose} />
      {provaAberta && (
        <ColetaProva
          tipo={provaAberta}
          prova={provaAberta === 'briefing' ? provaBriefing : provaDebriefing}
          onChange={prova => atualizarProva(provaAberta, prova)}
          onFechar={() => setProvaAberta(null)}
        />
      )}
      {avisoHorarios && (
        <AvisoHorarios
          itens={avisoHorarios.itens}
          segurandoEnvio={avisoHorarios.segurandoEnvio}
          onCorrigir={() => responderAvisoHorarios(false)}
          onSeguir={() => responderAvisoHorarios(true)}
        />
      )}
    </div>
  );
};

const App: React.FC = () => (
  <ToastProvider>
    <AppInner />
  </ToastProvider>
);

export default App;
