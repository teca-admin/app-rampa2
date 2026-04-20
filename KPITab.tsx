
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, Legend, LabelList } from 'recharts';
import { Zap, Clock, TrendingUp, Handshake, Target, Calendar, ChevronLeft, ChevronRight, Check, ChevronDown, X, Trophy } from 'lucide-react';

interface KPITabProps {
  rawReportsInPeriod: any[];
  allFlights: any[];
  themeClasses: any;
  isDarkMode: boolean;
  startDate: string;
  setStartDate: (d: string) => void;
  endDate: string;
  setEndDate: (d: string) => void;
  fetchData: () => void;
  loading: boolean;
}

const KPITab: React.FC<KPITabProps> = ({ 
  rawReportsInPeriod, allFlights, themeClasses, isDarkMode,
  startDate, setStartDate, endDate, setEndDate, fetchData, loading
}) => {
  
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [detailView, setDetailView] = useState<'alocadas' | 'locadas' | null>(null);
  const [viewDate, setViewDate] = useState(new Date());
  const [tempStart, setTempStart] = useState<Date | null>(new Date(startDate + 'T00:00:00'));
  const [tempEnd, setTempEnd] = useState<Date | null>(new Date(endDate + 'T00:00:00'));
  const pickerRef = useRef<HTMLDivElement>(null);

  const formatFullRange = () => {
    const d1 = startDate.split('-').reverse().join('/');
    const d2 = endDate.split('-').reverse().join('/');
    return `${d1} → ${d2}`;
  };

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const startDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handleDayClick = (day: number) => {
    const clickedDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    clickedDate.setHours(0,0,0,0);
    
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(clickedDate);
      setTempEnd(null);
    } else {
      if (clickedDate < tempStart) {
        setTempEnd(tempStart);
        setTempStart(clickedDate);
      } else {
        setTempEnd(clickedDate);
      }
    }
  };

  const isSelected = (day: number) => {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    d.setHours(0,0,0,0);
    if (tempStart && !tempEnd) return d.getTime() === tempStart.getTime();
    if (tempStart && tempEnd) return d >= tempStart && d <= tempEnd;
    return false;
  };

  const applyPeriod = () => {
    if (tempStart) {
      const startStr = tempStart.toLocaleDateString('en-CA');
      const endStr = tempEnd ? tempEnd.toLocaleDateString('en-CA') : startStr;
      setStartDate(startStr);
      setEndDate(endStr);
      setIsPickerOpen(false);
      fetchData();
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const monthNames = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

  const formatTimeLabel = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if (h === 0) return `${m}min`;
    const paddedM = m < 10 ? `0${m}` : m;
    return `${h}h ${paddedM}m`;
  };

  const timelineData = useMemo(() => {
    const dataByDate: Record<string, { date: string; locadas: number; alocadas: number }> = {};
    rawReportsInPeriod.forEach(report => {
      const dateKey = report.data.split('-').reverse().slice(0, 2).join('/');
      if (!dataByDate[dateKey]) dataByDate[dateKey] = { date: dateKey, locadas: 0, alocadas: 0 };
      report.locacoes?.forEach((loc: any) => {
        const t2m = (t: string) => { if(!t) return 0; const [h,m] = t.split(':').map(Number); return h*60+m; };
        let dur = t2m(loc.fim) - t2m(loc.inicio);
        if (dur < 0) dur += 1440;
        if (loc.tipo === 'LOCAR') dataByDate[dateKey].locadas += dur / 60;
        else dataByDate[dateKey].alocadas += dur / 60;
      });
    });
    return Object.values(dataByDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [rawReportsInPeriod]);

  const equipmentRanking = useMemo(() => {
    if (!detailView) return [];
    const targetType = detailView === 'alocadas' ? 'ALOCAR' : 'LOCAR';
    const stats: Record<string, { mins: number, name: string, company?: string }> = {};

    rawReportsInPeriod.forEach(report => {
      report.locacoes?.forEach((loc: any) => {
        if (loc.tipo !== targetType) return;
        
        const t2m = (t: string) => { if(!t) return 0; const [h,m] = t.split(':').map(Number); return h*60+m; };
        let dur = t2m(loc.fim) - t2m(loc.inicio);
        if (dur < 0) dur += 1440;
        
        const equipName = (loc.equipamento || 'NÃO IDENTIFICADO').toUpperCase().trim();
        const companyName = (loc.empresa || '').toUpperCase().trim();
        
        const key = targetType === 'ALOCAR' ? equipName : `${equipName}-${companyName}`;
        
        if (!stats[key]) {
          stats[key] = { 
            mins: 0, 
            name: equipName, 
            company: targetType === 'LOCAR' ? companyName : undefined 
          };
        }
        stats[key].mins += dur;
      });
    });

    return Object.values(stats)
      .sort((a, b) => b.mins - a.mins);
  }, [rawReportsInPeriod, detailView]);

  const { turnaroundData, generalAvg } = useMemo(() => {
    const ciaStats: Record<string, { name: string; totalMins: number; count: number }> = {};
    let totalMinsGlobal = 0, totalFlightsGlobal = 0;
    allFlights.forEach(flight => {
      if (!flight.companhia || !flight.pouso || !flight.reboque) return;
      const t2m = (t: string) => { if(!t) return 0; const [h,m] = t.split(':').map(Number); return h*60+m; };
      let dur = t2m(flight.reboque) - t2m(flight.pouso);
      if (dur < 0) dur += 1440;
      if (!ciaStats[flight.companhia]) ciaStats[flight.companhia] = { name: flight.companhia, totalMins: 0, count: 0 };
      ciaStats[flight.companhia].totalMins += dur;
      ciaStats[flight.companhia].count += 1;
      totalMinsGlobal += dur;
      totalFlightsGlobal += 1;
    });
    const formattedData = Object.values(ciaStats).map(stat => ({ name: stat.name, avg: Math.round(stat.totalMins / stat.count) })).sort((a, b) => b.avg - a.avg);
    return { turnaroundData: formattedData, generalAvg: totalFlightsGlobal > 0 ? Math.round(totalMinsGlobal / totalFlightsGlobal) : 0 };
  }, [allFlights]);

  const totalLocadasMins = useMemo(() => {
    let total = 0;
    rawReportsInPeriod.forEach(report => {
      report.locacoes?.forEach((loc: any) => {
        if (loc.tipo === 'LOCAR') {
          const t2m = (t: string) => { if(!t) return 0; const [h,m] = t.split(':').map(Number); return h*60+m; };
          let dur = t2m(loc.fim) - t2m(loc.inicio);
          if (dur < 0) dur += 1440;
          total += dur;
        }
      });
    });
    return total;
  }, [rawReportsInPeriod]);

  const totalAlocadasMins = useMemo(() => {
    let total = 0;
    rawReportsInPeriod.forEach(report => {
      report.locacoes?.forEach((loc: any) => {
        if (loc.tipo === 'ALOCAR') {
          const t2m = (t: string) => { if(!t) return 0; const [h,m] = t.split(':').map(Number); return h*60+m; };
          let dur = t2m(loc.fim) - t2m(loc.inicio);
          if (dur < 0) dur += 1440;
          total += dur;
        }
      });
    });
    return total;
  }, [rawReportsInPeriod]);

  return (
    <div className="animate-in fade-in slide-in-from-right-5 h-full flex flex-col gap-6 overflow-hidden">
      
      {/* KPI CARDS GRID - Conforme Imagem 1 e 3 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 flex-none">
        
        {/* HORAS ALOCADAS */}
        <button 
          onClick={() => setDetailView('alocadas')}
          className={`${themeClasses.bgCard} border ${themeClasses.border} p-8 rounded-sm shadow-2xl relative overflow-hidden group min-h-[140px] flex flex-col justify-center text-left hover:border-blue-500 transition-all active:scale-95`}
        >
          <div className="absolute left-0 top-0 bottom-0 w-2 bg-blue-500"></div>
          <p className="text-[11px] font-black text-slate-500 uppercase italic mb-2 tracking-[0.2em]">HORAS ALOCADAS</p>
          <h4 className="text-5xl font-black italic text-white tracking-tighter tabular-nums">{formatTimeLabel(totalAlocadasMins)}</h4>
          <TrendingUp size={28} className="absolute right-8 bottom-6 opacity-10 text-blue-500 group-hover:opacity-40 transition-opacity" />
        </button>

        {/* HORAS LOCADAS */}
        <button 
          onClick={() => setDetailView('locadas')}
          className={`${themeClasses.bgCard} border ${themeClasses.border} p-8 rounded-sm shadow-2xl relative overflow-hidden group min-h-[140px] flex flex-col justify-center text-left hover:border-amber-500 transition-all active:scale-95`}
        >
          <div className="absolute left-0 top-0 bottom-0 w-2 bg-amber-500"></div>
          <p className="text-[11px] font-black text-slate-500 uppercase italic mb-2 tracking-[0.2em]">HORAS LOCADAS</p>
          <h4 className="text-5xl font-black italic text-white tracking-tighter tabular-nums">{formatTimeLabel(totalLocadasMins)}</h4>
          <Handshake size={28} className="absolute right-8 bottom-6 opacity-10 text-amber-500 group-hover:opacity-40 transition-opacity" />
        </button>

        {/* MÉDIA GERAL */}
        <div className={`${themeClasses.bgCard} border ${themeClasses.border} p-8 rounded-sm shadow-2xl relative overflow-hidden group min-h-[140px] flex flex-col justify-center`}>
          <div className="absolute left-0 top-0 bottom-0 w-2 bg-blue-600"></div>
          <p className="text-[11px] font-black text-blue-500 uppercase italic mb-2 tracking-[0.2em]">MÉDIA GERAL DE ATENDIMENTO</p>
          <h4 className="text-5xl font-black italic text-white tracking-tighter tabular-nums">{formatTimeLabel(generalAvg)}</h4>
          <Target size={28} className="absolute right-8 bottom-6 opacity-10 text-blue-600" />
        </div>

        {/* FILTRO DE PERÍODO */}
        <div className="relative" ref={pickerRef}>
          <button 
            onClick={() => setIsPickerOpen(!isPickerOpen)}
            className={`${themeClasses.bgCard} border ${isPickerOpen ? 'border-blue-500' : themeClasses.border} p-8 rounded-sm shadow-2xl min-h-[140px] w-full text-left transition-all relative overflow-hidden group flex flex-col justify-center`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-slate-500/50"></div>
            <div className="flex justify-between items-center w-full">
               <div className="flex-1">
                  <p className="text-[11px] font-black text-slate-500 uppercase italic mb-2 tracking-[0.2em] flex items-center gap-2">
                    <Calendar size={14}/> FILTRO DE PERÍODO
                  </p>
                  <p className="text-[16px] font-black italic text-white tracking-tight uppercase leading-none truncate pr-8">
                    {formatFullRange()}
                  </p>
               </div>
               <ChevronDown size={28} className={`text-blue-500 transition-transform duration-500 ${isPickerOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {isPickerOpen && (
            <div className="absolute top-[150px] right-0 left-0 xl:left-auto xl:w-[400px] z-[100] animate-in fade-in slide-in-from-top-4 duration-300">
              <div className={`${themeClasses.bgCard} border border-blue-500/50 rounded-sm shadow-[0_30px_60px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden`}>
                <div className="bg-slate-900/90 p-5 border-b border-white/10 flex justify-between items-center">
                  <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1))} className="p-2 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"><ChevronLeft size={20}/></button>
                  <span className="text-[13px] font-black italic uppercase text-white tracking-[0.3em]">{monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}</span>
                  <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1))} className="p-2 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"><ChevronRight size={20}/></button>
                </div>
                <div className="p-6 bg-slate-900/60">
                  <div className="grid grid-cols-7 text-center mb-4">
                    {['D','S','T','Q','Q','S','S'].map(d => <span key={d} className="text-[10px] font-black text-slate-600">{d}</span>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {Array.from({length: startDayOfMonth(viewDate.getFullYear(), viewDate.getMonth())}).map((_, i) => <div key={`e-${i}`}></div>)}
                    {Array.from({length: daysInMonth(viewDate.getFullYear(), viewDate.getMonth())}).map((_, i) => {
                      const day = i + 1;
                      const active = isSelected(day);
                      return (
                        <button key={day} onClick={() => handleDayClick(day)} className={`h-10 w-full flex items-center justify-center text-[12px] font-black transition-all rounded-sm border ${active ? 'bg-blue-600 text-white border-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.5)] z-10' : 'text-slate-400 border-transparent hover:bg-white/10'}`}>{day}</button>
                      );
                    })}
                  </div>
                </div>
                <div className="p-6 border-t border-white/10 bg-slate-900/80">
                  <button onClick={applyPeriod} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-sm text-[13px] font-black uppercase italic flex items-center justify-center gap-4 shadow-2xl active:scale-[0.97] transition-all">
                    <Check size={20}/> APLICAR NOVO PERÍODO
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CHARTS GRID */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
        <div className={`${themeClasses.bgCard} border ${themeClasses.border} p-8 rounded-sm shadow-2xl flex flex-col`}>
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-2xl font-black italic uppercase tracking-tighter">Fluxo de <span className="text-blue-600">Alocação Técnica</span></h3>
              <p className="text-[10px] font-black text-slate-500 uppercase italic mt-1.5 tracking-widest">Comparativo: Horas Internas vs Aluguéis Externos</p>
            </div>
            <Clock size={24} className="text-blue-500 opacity-20" />
          </div>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="colorAlocadas" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                  <linearGradient id="colorLocadas" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="date" fontSize={11} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 900, fontStyle: 'italic'}} dy={12} />
                <YAxis fontSize={11} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 900}} />
                <Tooltip 
                  formatter={(value: any) => formatTimeLabel(Math.round(parseFloat(value) * 60))}
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '4px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: '900', fontStyle: 'italic' }}
                />
                <Legend iconType="circle" />
                <Area type="monotone" dataKey="alocadas" name="Horas Alocadas" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorAlocadas)" />
                <Area type="monotone" dataKey="locadas" name="Horas Locadas" stroke="#f59e0b" strokeWidth={4} fillOpacity={1} fill="url(#colorLocadas)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`${themeClasses.bgCard} border ${themeClasses.border} p-8 rounded-sm shadow-2xl flex flex-col`}>
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-2xl font-black italic uppercase tracking-tighter">Performance <span className="text-emerald-500">Logística</span></h3>
              <p className="text-[10px] font-black text-slate-500 uppercase italic mt-1.5 tracking-widest">Turnaround Médio por Companhia Aérea</p>
            </div>
            <Zap size={24} className="text-emerald-500 opacity-20" />
          </div>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={turnaroundData} layout="vertical" margin={{ left: 20, right: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  fontSize={11} 
                  axisLine={false} 
                  tickLine={false} 
                  width={130}
                  tick={{fill: '#fff', fontWeight: 900, fontStyle: 'italic'}}
                />
                <Bar dataKey="avg" name="Turnaround" radius={[0, 4, 4, 0]} barSize={32}>
                  <LabelList 
                    dataKey="avg" 
                    position="right" 
                    style={{ fill: '#64748b', fontWeight: 900, fontSize: 11, fontStyle: 'italic' }} 
                    offset={15} 
                    formatter={formatTimeLabel} 
                  />
                  {turnaroundData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.avg > 60 ? '#f43f5e' : entry.avg > 45 ? '#f59e0b' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* RANKING MODAL */}
      {detailView && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setDetailView(null)}></div>
          <div className={`relative w-full max-w-3xl max-h-[85vh] ${themeClasses.bgCard} border ${detailView === 'alocadas' ? 'border-blue-500/50' : 'border-amber-500/50'} shadow-2xl flex flex-col rounded-sm animate-in zoom-in-95 duration-200 overflow-hidden`}>
            
            <div className={`flex justify-between items-center p-10 border-b border-white/10 ${detailView === 'alocadas' ? 'bg-blue-600/5' : 'bg-amber-600/5'}`}>
              <div className="flex items-center gap-6">
                <div className={`p-5 ${detailView === 'alocadas' ? 'bg-blue-600' : 'bg-amber-600'} rounded-sm shadow-2xl text-white`}>
                  <Trophy size={32} />
                </div>
                <div>
                  <h3 className="text-3xl font-black italic uppercase tracking-tighter leading-none text-white">
                    TOP <span className={detailView === 'alocadas' ? 'text-blue-500' : 'text-amber-500'}>UTILIZAÇÃO</span>
                  </h3>
                  <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mt-3 italic">Acúmulo de horas operacionais por ativo técnico</p>
                </div>
              </div>
              <button onClick={() => setDetailView(null)} className="p-3 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all"><X size={40} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-6 bg-slate-900/40">
               {equipmentRanking.length > 0 ? equipmentRanking.map((item, i) => {
                 const maxMins = equipmentRanking[0].mins;
                 const progress = (item.mins / maxMins) * 100;
                 return (
                   <div key={i} className="space-y-3 group">
                      <div className="flex justify-between items-end">
                        <div className="flex items-center gap-5">
                          <span className="text-xs font-black text-slate-700 italic">#{i+1}</span>
                          <div className="flex flex-col">
                             <span className="text-xl font-black italic tracking-tighter text-white uppercase leading-none">{item.name}</span>
                             {detailView === 'locadas' && item.company && (
                               <span className="text-[10px] font-black text-amber-500 uppercase italic mt-1.5 tracking-widest opacity-60">FORNECEDOR: {item.company}</span>
                             )}
                          </div>
                        </div>
                        <span className={`text-xl font-black italic tabular-nums ${detailView === 'alocadas' ? 'text-blue-500' : 'text-amber-500'}`}>
                          {formatTimeLabel(item.mins)}
                        </span>
                      </div>
                      <div className="h-3 w-full bg-slate-800/80 rounded-sm overflow-hidden shadow-inner">
                        <div 
                          className={`h-full ${detailView === 'alocadas' ? 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.4)]'} transition-all duration-1000 ease-out`}
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                   </div>
                 );
               }) : (
                 <div className="h-80 flex flex-col items-center justify-center opacity-10">
                    <X size={80} className="mb-6" />
                    <p className="text-2xl font-black italic uppercase tracking-tighter">Sem dados para este período</p>
                 </div>
               )}
            </div>

            <div className="p-10 border-t border-white/10 flex justify-end bg-slate-900">
              <button onClick={() => setDetailView(null)} className="bg-slate-800 hover:bg-slate-700 px-12 py-4 text-[14px] font-black text-white uppercase italic rounded-sm shadow-2xl active:scale-95 transition-all tracking-widest">FECHAR RANKING</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(37, 99, 235, 0.4); border-radius: 4px; }
      `}</style>
    </div>
  );
};

export default KPITab;
