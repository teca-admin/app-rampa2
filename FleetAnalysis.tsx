
import React, { useMemo, useState } from 'react';
import { Truck, Wrench, CheckCircle2, AlertCircle, Activity, X, Calendar, ArrowLeft, ArrowRight } from 'lucide-react';

interface FleetAnalysisProps {
  isDarkMode: boolean;
  themeClasses: any;
  fleetDetails: any[];
}

const FleetAnalysis: React.FC<FleetAnalysisProps> = ({ isDarkMode, themeClasses, fleetDetails }) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const analysis = useMemo(() => {
    const categories: Record<string, { total: number; operational: number; maintenance: number }> = {};
    fleetDetails.forEach(item => {
      const cat = (item.nome || 'OUTROS').trim().toUpperCase();
      if (!categories[cat]) categories[cat] = { total: 0, operational: 0, maintenance: 0 };
      categories[cat].total += 1;
      if (item.status === 'OPERACIONAL') categories[cat].operational += 1;
      if (item.status === 'MANUTENCAO') categories[cat].maintenance += 1;
    });

    return Object.entries(categories).map(([name, stats]) => {
      const maintenanceRate = (stats.maintenance / stats.total) * 100;
      let situation: 'CRÍTICO' | 'ALERTA' | 'ESTÁVEL' | 'EXCELENTE' = 'EXCELENTE';
      let bgColor = 'bg-emerald-500';
      let textColor = 'text-emerald-500';

      if (maintenanceRate > 50) { situation = 'CRÍTICO'; bgColor = 'bg-rose-500'; textColor = 'text-rose-500'; }
      else if (maintenanceRate > 25) { situation = 'ALERTA'; bgColor = 'bg-amber-500'; textColor = 'text-amber-500'; }
      else if (maintenanceRate > 0) { situation = 'ESTÁVEL'; bgColor = 'bg-blue-500'; textColor = 'text-blue-500'; }

      return { name, ...stats, maintenanceRate, situation, bgColor, textColor };
    }).sort((a, b) => b.maintenanceRate - a.maintenanceRate);
  }, [fleetDetails]);

  return (
    <div className="animate-in fade-in slide-in-from-right-5 h-full flex flex-col gap-6 overflow-hidden">
      <div className="space-y-1 border-b border-white/5 pb-6">
        <h2 className={`text-4xl md:text-5xl font-black italic uppercase tracking-tighter ${themeClasses.textHeader}`}>Análise Técnica <span className="text-blue-600">de Frota</span></h2>
        <p className={`text-[11px] font-black ${themeClasses.textMuted} uppercase tracking-[0.3em] italic`}>CLIQUE EM UMA CATEGORIA PARA VER DETALHES</p>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className={`border ${themeClasses.border} rounded-sm overflow-hidden bg-slate-900/20 shadow-2xl`}>
          {/* Header da Tabela Adaptado */}
          <div className={`grid grid-cols-12 px-6 py-5 border-b ${themeClasses.border} bg-white/5 text-[10px] font-black uppercase tracking-widest ${themeClasses.textMuted} italic`}>
            <div className="col-span-5 md:col-span-4">CATEGORIA</div>
            <div className="col-span-4 md:col-span-4 text-center">SAÚDE DA FROTA</div>
            <div className="col-span-3 md:col-span-4 text-right">STATUS CONSOLIDADO</div>
          </div>

          <div className="divide-y divide-white/5">
            {analysis.map((cat, idx) => (
              <div key={idx} onClick={() => setSelectedCategory(cat.name)} className="grid grid-cols-12 px-6 py-8 items-center hover:bg-blue-600/10 transition-all cursor-pointer group relative">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-blue-600 transition-all"></div>
                
                <div className="col-span-5 md:col-span-4 flex items-center gap-5">
                  <div className={`w-14 h-14 flex items-center justify-center rounded-sm ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'} border ${themeClasses.border} group-hover:bg-blue-600 transition-colors shadow-xl`}>
                    <Truck size={24} className={cat.textColor + " group-hover:text-white"} />
                  </div>
                  <div className="overflow-hidden">
                    <h3 className={`text-xl md:text-2xl font-black italic uppercase leading-none truncate ${themeClasses.textHeader}`}>{cat.name}</h3>
                    <p className={`text-[10px] font-black ${cat.textColor} uppercase italic mt-1.5 tracking-widest`}>{cat.situation}</p>
                  </div>
                </div>

                <div className="col-span-4 md:col-span-4 px-6">
                  <div className="flex justify-between items-center mb-2.5">
                    <p className="text-[10px] font-black text-slate-500 uppercase italic">Indisponível <span className={cat.textColor}>{cat.maintenanceRate.toFixed(0)}%</span></p>
                  </div>
                  <div className="h-2.5 w-full bg-slate-800/80 rounded-full overflow-hidden border border-white/5 shadow-inner">
                    <div className={`h-full ${cat.bgColor} transition-all duration-1000 ease-out`} style={{ width: `${cat.maintenanceRate}%` }}></div>
                  </div>
                </div>

                <div className="col-span-3 md:col-span-4 flex justify-end">
                   <div className={`p-2.5 rounded-sm ${cat.bgColor} text-white shadow-xl md:px-6 md:py-3 flex items-center gap-3 transition-transform group-active:scale-90`}>
                     <ArrowRight size={20} className="md:hidden" />
                     <span className="hidden md:inline text-[11px] font-black uppercase italic tracking-widest">Ver Detalhes</span>
                     <ArrowRight size={18} className="hidden md:block" />
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legendas Conforme Imagem 2 */}
      <div className={`${themeClasses.bgCard} border ${themeClasses.border} p-6 rounded-sm shadow-2xl space-y-5`}>
        <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] italic mb-2">LEGENDA DE OPERAÇÃO:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {c: 'emerald', l: 'EXCELENTE (PRONTO P/ PICO)'}, 
            {c: 'blue', l: 'ESTÁVEL (OPERAÇÃO NORMAL)'}, 
            {c: 'amber', l: 'ALERTA (MONITORAR RESERVAS)'}, 
            {c: 'rose', l: 'CRÍTICO (DÉFICIT TÉCNICO)'}
          ].map(l => (
            <div key={l.c} className="flex items-center gap-3 group">
              <div className={`w-4 h-4 rounded-full bg-${l.c}-500 shadow-[0_0_10px_rgba(0,0,0,0.5)] group-hover:scale-125 transition-transform`}></div>
              <span className={`text-[10px] font-black uppercase italic text-${l.c}-500 tracking-wider`}>{l.l}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Modal Detalhes */}
      {selectedCategory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => setSelectedCategory(null)}></div>
          <div className={`relative w-full max-w-2xl ${isDarkMode ? 'bg-[#1e293b]' : 'bg-white'} border ${themeClasses.border} shadow-2xl rounded-sm overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200`}>
            <div className="p-8 border-b border-white/10 flex justify-between items-center bg-blue-600/5">
              <h3 className="text-2xl font-black italic uppercase text-white tracking-tighter">Frota Ativa: {selectedCategory}</h3>
              <button onClick={() => setSelectedCategory(null)} className="p-2 hover:bg-white/5 rounded-full transition-all"><X size={32}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar bg-slate-900/20">
              {fleetDetails.filter(e => (e.nome || 'OUTROS').trim().toUpperCase() === selectedCategory).map((item, i) => (
                <div key={i} className="p-5 bg-slate-900 border border-white/5 flex justify-between items-center rounded-sm shadow-xl group hover:border-blue-500 transition-all">
                  <div className="flex flex-col">
                    <span className="text-2xl font-black italic text-white uppercase tracking-tighter">{item.prefixo}</span>
                    <span className="text-[10px] font-black text-slate-500 uppercase italic mt-1">{item.nome}</span>
                  </div>
                  <span className={`px-5 py-2 text-[11px] font-black uppercase italic rounded-sm shadow-lg ${item.status === 'OPERACIONAL' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FleetAnalysis;
