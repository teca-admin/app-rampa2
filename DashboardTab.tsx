
import React from 'react';
import { Plane, HardHat, AlertCircle, ShieldAlert, Handshake, Wrench, Clock, CheckCircle2, UserCheck, AlertTriangle } from 'lucide-react';

interface DashboardTabProps {
  report: any;
  themeClasses: any;
  isDarkMode: boolean;
  calculateTurnaround: (start: any, end: any) => string;
  fleetDetails: any[];
}

const DashboardTab: React.FC<DashboardTabProps> = ({ report, themeClasses, isDarkMode, calculateTurnaround }) => {
  if (!report) return (
    <div className="flex-1 flex flex-col items-center justify-center p-10 text-center animate-in fade-in zoom-in-95 duration-500">
      <div className="opacity-10 mb-8">
        <AlertTriangle size={120} />
      </div>
      <h3 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter opacity-30 leading-tight max-w-[280px] md:max-w-none">
        NENHUM RELATÓRIO ENCONTRADO PARA ESTE TURNO
      </h3>
    </div>
  );

  return (
    <div className="animate-in fade-in duration-500 h-full flex flex-col gap-6 overflow-hidden">
      
      {/* HEADER SECTION - Adaptado para Mobile */}
      <div className="flex flex-col md:flex-row flex-none justify-between items-start md:items-end gap-4 px-1">
        <div className="space-y-1">
          <p className="text-[10px] font-black text-blue-500 uppercase italic tracking-[0.2em] opacity-80">Relatório de Entrega de Turno</p>
          <h2 className={`text-3xl md:text-5xl font-black italic uppercase tracking-tighter ${themeClasses.textHeader}`}>Log de <span className="text-blue-600">Atendimentos</span></h2>
        </div>
        
        <div className={`${themeClasses.bgCard} border ${themeClasses.border} px-6 py-4 rounded-sm flex items-center gap-5 shadow-2xl relative overflow-hidden w-full md:min-w-[320px] md:w-auto`}>
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-600"></div>
          <div className="bg-blue-600/10 p-2.5 rounded-sm text-blue-500">
            <HardHat size={22} />
          </div>
          <div>
            <p className="text-[8px] font-black text-slate-500 uppercase italic leading-none mb-1">Responsável pelo Turno</p>
            <p className={`text-lg font-black italic uppercase tracking-tight ${themeClasses.textHeader}`}>{report.lider}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-6 overflow-y-auto lg:overflow-hidden custom-scrollbar pb-6 px-1">
        
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-6">
          <div className="flex-none lg:flex-1 space-y-4">
            {report.voos?.length ? report.voos.map((voo: any, idx: number) => (
              <div key={idx} className={`${themeClasses.bgCard} border ${themeClasses.border} p-5 flex flex-col md:flex-row justify-between items-start md:items-center group relative rounded-sm shadow-xl hover:border-blue-500 transition-all gap-4 overflow-hidden`}>
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600/30 group-hover:bg-blue-600 transition-all"></div>
                <div className="flex items-center gap-5 w-full md:w-auto">
                  <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'} w-14 h-14 md:w-20 md:h-20 border ${themeClasses.border} rounded-sm flex items-center justify-center text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-lg shrink-0`}>
                    <Plane size={28} className="md:hidden" />
                    <Plane size={42} className="hidden md:block" />
                  </div>
                  <div className="space-y-1">
                    <h3 className={`text-2xl md:text-4xl font-black italic uppercase tracking-tighter ${themeClasses.textHeader}`}>{voo.companhia}</h3>
                    <div className="flex items-center gap-4">
                       <div className="flex items-center gap-2 text-[10px] md:text-[11px] font-black text-blue-500 uppercase italic">
                          <span>INÍCIO: <span className={`${isDarkMode ? 'text-white' : 'text-slate-900'} ml-1`}>{voo.inicio || voo.pouso}</span></span>
                       </div>
                       <div className="flex items-center gap-2 text-[10px] md:text-[11px] font-black text-emerald-500 uppercase italic">
                          <span>FIM: <span className={`${isDarkMode ? 'text-white' : 'text-slate-900'} ml-1`}>{voo.fim || voo.reboque}</span></span>
                       </div>
                    </div>
                  </div>
                </div>
                
                <div className="md:text-right flex items-center md:items-end justify-between w-full md:w-auto border-t md:border-t-0 border-white/5 pt-3 md:pt-0">
                  <div className="md:hidden">
                     <p className="text-[9px] font-black text-slate-500 uppercase italic">Turnaround Solo</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock size={20} className="text-blue-500 md:hidden" />
                    <p className={`text-3xl md:text-5xl font-black italic tabular-nums group-hover:text-blue-500 transition-colors ${themeClasses.textHeader}`}>
                      {calculateTurnaround(voo.inicio || voo.pouso, voo.fim || voo.reboque)}
                    </p>
                  </div>
                </div>
              </div>
            )) : (
              <div className="py-20 flex flex-col items-center justify-center opacity-10">
                <Plane size={80} />
                <p className="font-black italic uppercase mt-4 text-xl">Sem voos registrados</p>
              </div>
            )}
          </div>

          <div className="flex-none grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={`${themeClasses.bgCard} border-l-8 border-amber-500 p-6 md:p-8 rounded-sm shadow-2xl flex flex-col min-h-[160px]`}>
              <div className="flex items-center gap-3 mb-4">
                 <AlertCircle size={22} className="text-amber-500" />
                 <h4 className="text-[14px] font-black uppercase italic text-amber-500 tracking-widest">Pendências</h4>
              </div>
              <p className={`text-[15px] md:text-[16px] font-bold italic leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                {report.descricao_pendencias || "Nenhuma pendência para este turno."}
              </p>
            </div>

            <div className={`${themeClasses.bgCard} border-l-8 border-rose-500 p-6 md:p-8 rounded-sm shadow-2xl flex flex-col min-h-[160px]`}>
              <div className="flex items-center gap-3 mb-4">
                 <ShieldAlert size={22} className="text-rose-500" />
                 <h4 className="text-[14px] font-black uppercase italic text-rose-500 tracking-widest">Ocorrências</h4>
              </div>
              <p className={`text-[15px] md:text-[16px] font-bold italic leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                {report.descricao_ocorrencias || "Turno sem intercorrências registradas."}
              </p>
            </div>
          </div>
        </div>

        {/* SIDEBAR - Locações e RH */}
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6">
          <div className={`${themeClasses.bgCard} border ${themeClasses.border} p-6 rounded-sm shadow-2xl`}>
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-[15px] font-black uppercase italic text-blue-500 tracking-tighter">Locações Externas</h4>
              <Handshake size={22} className="text-blue-500 opacity-30" />
            </div>
            <div className="space-y-4">
              {report.locacoes?.length ? report.locacoes.map((loc: any, i: number) => (
                <div key={i} className="p-4 border-l-4 border-blue-600 bg-blue-600/5 rounded-sm shadow-inner group hover:bg-blue-600/10 transition-all">
                  <p className="text-[14px] font-black italic text-white uppercase leading-tight">{loc.equipamento}</p>
                  <p className="text-[10px] font-black text-blue-500 uppercase italic mt-1 tracking-widest">{loc.inicio} → {loc.fim}</p>
                </div>
              )) : (
                <p className="text-center py-6 opacity-20 italic uppercase text-[11px] font-black">Sem locações ativas</p>
              )}
            </div>
          </div>

          <div className={`${themeClasses.bgCard} border ${themeClasses.border} p-6 rounded-sm shadow-2xl`}>
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-[15px] font-black uppercase italic text-blue-500 tracking-tighter">Transporte Tripulação</h4>
              <Handshake size={22} className="text-blue-500 opacity-30" />
            </div>
            <div className="space-y-4">
              {report.transporte_tripulacao?.length ? report.transporte_tripulacao.map((t: any, i: number) => (
                <div key={i} className="p-4 border-l-4 border-blue-600 bg-blue-600/5 rounded-sm shadow-inner group hover:bg-blue-600/10 transition-all">
                  <p className="text-[14px] font-black italic text-white uppercase leading-tight">{t.cia}</p>
                </div>
              )) : (
                <p className="text-center py-6 opacity-20 italic uppercase text-[11px] font-black">Sem registros</p>
              )}
            </div>
          </div>

          <div className={`${themeClasses.bgCard} border ${themeClasses.border} p-6 rounded-sm shadow-2xl`}>
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-[15px] font-black uppercase italic text-slate-400 tracking-tighter">Status de Equipe</h4>
              <UserCheck size={22} className="text-slate-400 opacity-30" />
            </div>
            <div className="space-y-2">
              {[
                { l: 'Faltas', v: report.teve_falta },
                { l: 'Atestados', v: report.teve_atestado },
                { l: 'Compensação', v: report.teve_compensacao },
                { l: 'Saída Antecipada', v: report.teve_saida_antecipada }
              ].map(q => (
                <div key={q.l} className={`flex flex-col px-5 py-4 rounded-sm transition-all ${q.v ? 'bg-rose-500/10 border-l-4 border-rose-500' : 'bg-slate-800/40 opacity-40'}`}>
                   <div className="flex justify-between items-center w-full">
                      <span className="text-[11px] font-black uppercase italic text-slate-200">{q.l}</span>
                      <span className={`text-[11px] font-black uppercase italic ${q.v ? 'text-rose-500' : 'text-slate-500'}`}>
                         {q.v ? 'ALERTA' : 'OK'}
                      </span>
                   </div>
                   {q.l === 'Faltas' && q.v && report.detalhe_falta && (
                     <p className="text-[9px] font-bold italic text-rose-400 mt-2 uppercase">
                       Colaborador: {report.detalhe_falta}
                     </p>
                   )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardTab;
