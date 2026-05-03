
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Zap, Sun, Moon, RefreshCcw, Download, Send
} from 'lucide-react';
import { supabase } from './supabase';
import { FleetStat } from './types';

// Subcomponentes
import NewReportTab from './NewReportTab';
import GerenciaDashboard from './GerenciaDashboard';
import CoordDashboard from './CoordDashboard';

// --- CONFIG ---
const WEBHOOK_URL = 'https://teca-admin-n8n.ly7t0m.easypanel.host/webhook/e4eb976b-e3b7-40e7-b069-56c3162c9f70';

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

const App: React.FC = () => {
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
  }, []);

  const fetchData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      
      const { data: equips } = await supabase.from('equipamentos').select('*').order('prefixo', { ascending: true });
      if (equips) setFleetDetails(equips);

      const { data: leadersData } = await supabase.from('lideres').select('*').order('nome', { ascending: true });
      if (leadersData) setLeaders(leadersData);

      const { data: airlinesData } = await supabase.from('companhias_aereas').select('nome').order('nome', { ascending: true });
      if (airlinesData) setAirlines(airlinesData.map(a => a.nome));

    } catch (err) { console.error(err); } finally { if (!isSilent) setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddAirline = useCallback(async (nome: string) => {
    const { error } = await supabase.from('companhias_aereas').insert({ nome });
    if (error) { alert('Erro ao cadastrar: ' + error.message); return; }
    fetchData(true);
  }, [fetchData]);

  const handleAddEquipamento = useCallback(async (prefixo: string, nome: string) => {
    const { error } = await supabase.from('equipamentos').insert({ prefixo, nome, status: 'OPERACIONAL' });
    if (error) { alert('Erro ao cadastrar: ' + error.message); return; }
    fetchData(true);
  }, [fetchData]);

  const handleSaveReport = async () => {
    if (!formLeader) { alert("Selecione o Líder!"); return; }
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

      const reportPayload = {
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
        briefing_inicio: formBriefing.ativo ? (formBriefing.inicio || null) : null,
        briefing_fim: formBriefing.ativo ? (formBriefing.fim || null) : null,
        debriefing_inicio: formDebriefing.ativo ? (formDebriefing.inicio || null) : null,
        debriefing_fim: formDebriefing.ativo ? (formDebriefing.fim || null) : null,
      };

      const { error } = await supabase.from('relatorios_consolidados').insert([reportPayload]);
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

      await fetch(WEBHOOK_URL, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportPayload) 
      }).catch(console.error);

      alert("Relatório Enviado com Sucesso!"); 
      resetForm(); 
      fetchData();
    } catch (err: any) { alert(err.message); } finally { setIsSubmitting(false); }
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
            // Desktop: logo WFS
            <img
              src="https://drive.google.com/thumbnail?id=1sNzDKhdh2zH8d8DoyqIjx8l5LzBEXN5g&sz=w512"
              alt="WFS"
              style={{ height: 40, objectFit: 'contain' }}
            />
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
          // Mobile: sempre o formulário de relatório
          loading ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20">
              <RefreshCcw size={48} className="animate-spin text-blue-500 mb-4" />
              <p className="font-black uppercase italic tracking-widest">Sincronizando Dados...</p>
            </div>
          ) : (
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
              handleSaveReport={handleSaveReport}
              resetForm={resetForm}
              setActiveTab={() => {}}
              handleAddAirline={handleAddAirline}
              handleAddEquipamento={handleAddEquipamento}
              formBriefing={formBriefing} setFormBriefing={setFormBriefing}
              formDebriefing={formDebriefing} setFormDebriefing={setFormDebriefing}
            />
          )
        ) : (
          // Desktop: sempre um dashboard
          activeView === 'gerencia' ? <GerenciaDashboard /> : <CoordDashboard />
        )}
      </main>

      <footer className={`flex-none ${isDarkMode ? 'bg-[#0f172a] border-white/10' : 'bg-white border-slate-200'} border-t px-6 py-2 flex justify-center items-center text-[8px] font-black uppercase ${themeClasses.textMuted} italic transition-colors duration-300`}>
        <span>RAMP CONTROLL STABLE V17.0 - PWA MODE</span>
      </footer>
    </div>
  );
};

export default App;
