
import React from 'react';
import { Calendar, Plane, ArrowRight, RefreshCcw, Clock8 } from 'lucide-react';

interface HistoryTabProps {
  startDate: string;
  setStartDate: (d: string) => void;
  endDate: string;
  setEndDate: (d: string) => void;
  fetchData: () => void;
  loading: boolean;
  allFlights: any[];
  themeClasses: any;
  isDarkMode: boolean;
  calculateTurnaround: (start: any, end: any) => string;
  setSelectedDate: (d: string) => void;
  setSelectedShift: (s: any) => void;
  setActiveTab: (t: any) => void;
}

const HistoryTab: React.FC<HistoryTabProps> = ({
  startDate, setStartDate, endDate, setEndDate, fetchData, loading,
  allFlights, themeClasses, isDarkMode, calculateTurnaround,
  setSelectedDate, setSelectedShift, setActiveTab
}) => {
  return (
    <div className="animate-in slide-in-from-right-5 h-full flex flex-col gap-6 overflow-hidden">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-6">
          <h2 className={`text-4xl md:text-5xl font-black italic uppercase tracking-tighter ${themeClasses.textHeader}`}>Histórico de <span className="text-blue-600">Voos</span></h2>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className={`${themeClasses.bgCard} border ${themeClasses.border} flex flex-1 md:flex-none items-center px-4 py-3 gap-6 rounded-sm shadow-2xl`}>
              <div className="flex flex-col flex-1">
                <label className="text-[8px] font-black text-blue-500 uppercase italic mb-1">Início do Período</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none focus:ring-0 text-[11px] font-black italic text-white outline-none w-full appearance-none" />
              </div>
              <div className="w-px h-8 bg-white/10"></div>
              <div className="flex flex-col flex-1">
                <label className="text-[8px] font-black text-blue-500 uppercase italic mb-1">Fim do Período</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none focus:ring-0 text-[11px] font-black italic text-white outline-none w-full appearance-none" />
              </div>
            </div>
            
            <button onClick={fetchData} className="bg-blue-600 w-[56px] h-[56px] md:w-[50px] md:h-[50px] flex items-center justify-center rounded-sm text-white shadow-2xl shadow-blue-600/30 transition-all active:scale-90 hover:bg-blue-500 shrink-0">
              <RefreshCcw size={24} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
       </div>

       <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-5">
          {allFlights.length > 0 ? allFlights.map((v, i) => (
            <div 
              key={i} 
              onClick={() => { setSelectedDate(v.parentDate); setSelectedShift(v.parentShift === 'manhã' ? 'manha' : v.parentShift); setActiveTab('dashboard'); }} 
              className={`${themeClasses.bgCard} border ${themeClasses.border} p-6 md:p-8 flex flex-col gap-6 rounded-sm shadow-2xl hover:border-blue-500 transition-all cursor-pointer group relative overflow-hidden active:scale-[0.98] transition-transform`}
            >
               <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-600/20 group-hover:bg-blue-600 transition-all"></div>
               
               <div className="flex justify-between items-start">
                  <div>
                    <p className="text-lg font-black italic text-white tracking-tighter">{v.parentDate.split('-').reverse().join('/')}</p>
                    <p className="text-[10px] font-black text-blue-500 uppercase italic mt-1 tracking-widest">{v.parentShift.toUpperCase()}</p>
                  </div>
                  <div className="flex items-center gap-3 bg-blue-600/10 px-4 py-2 rounded-full border border-blue-500/20 shadow-lg">
                     <Clock8 size={14} className="text-blue-500" />
                     <span className="text-[13px] font-black italic text-blue-500 tabular-nums">{calculateTurnaround(v.pouso, v.reboque)}</span>
                  </div>
               </div>

               <div className="flex items-center gap-6 py-4 border-y border-white/5">
                  <div className="w-14 h-14 md:w-16 md:h-16 rounded-sm bg-slate-800 flex items-center justify-center text-slate-500 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-2xl border border-white/5">
                    <Plane size={32} />
                  </div>
                  <h3 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter text-white leading-none">{v.companhia}</h3>
               </div>

               <div className="flex items-center justify-between">
                  <p className="text-[11px] font-black uppercase italic text-slate-500 tracking-wider">Líder: <span className="text-white ml-2 text-xs">{v.parentLider}</span></p>
                  <div className="bg-blue-600/10 p-2 rounded-full transform group-hover:translate-x-2 transition-all">
                    <ArrowRight size={22} className="text-blue-500" />
                  </div>
               </div>
            </div>
          )) : (
            <div className="flex flex-col items-center justify-center py-32 opacity-10">
               <Calendar size={100} />
               <p className="text-2xl font-black italic uppercase mt-8 tracking-tighter">Nenhum registro encontrado</p>
            </div>
          )}
       </div>
    </div>
  );
};

export default HistoryTab;
