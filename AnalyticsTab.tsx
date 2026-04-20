
import React, { useState, useMemo } from 'react';
import { RefreshCcw, TrendingUp, Settings, X, Truck, Handshake, Wrench } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, ReferenceLine, PieChart, Pie, Cell } from 'recharts';

interface AnalyticsTabProps {
  startDate: string;
  setStartDate: (d: string) => void;
  endDate: string;
  setEndDate: (d: string) => void;
  analyticsAirline: string;
  setAnalyticsAirline: (c: string) => void;
  analyticsShift: string;
  setAnalyticsShift: (s: any) => void;
  airlines: string[];
  fetchData: () => void;
  loading: boolean;
  analyticsData: any;
  fleetSummary: any;
  isDarkMode: boolean;
  themeClasses: any;
  averageFlights: number;
  handleBarClick: (data: any) => void;
  fleetDetails: any[];
  allRentalsInPeriod: any[];
}

const formatMinutes = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  startDate, setStartDate, endDate, setEndDate, analyticsAirline, setAnalyticsAirline, 
  analyticsShift, setAnalyticsShift, airlines, fetchData, loading, analyticsData,
  fleetSummary, isDarkMode, themeClasses, averageFlights, handleBarClick, fleetDetails,
  allRentalsInPeriod
}) => {
  const [detailView, setDetailView] = useState<'locacoes' | 'operantes' | 'manutencao' | null>(null);

  const pieData = useMemo(() => {
    const op = fleetDetails.filter(e => e.status === 'OPERACIONAL').length;
    const inop = fleetDetails.filter(e => e.status !== 'OPERACIONAL').length;
    return [{ name: 'DISP', value: op, color: '#10b981' }, { name: 'INOP', value: inop, color: '#f43f5e' }];
  }, [fleetDetails]);

  return (
    <div className="animate-in slide-in-from-right-5 h-full flex flex-col gap-6 overflow-hidden">
      
      {/* Filtros Superiores */}
      <div className={`${themeClasses.bgCard} p-6 border ${themeClasses.border} rounded-sm shadow-2xl grid grid-cols-2 lg:grid-cols-5 gap-4 items-end`}>
        <div className="space-y-1"><label className="text-[8px] font-black text-blue-500 uppercase italic">Início</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={`${themeClasses.bgInput} border ${themeClasses.border} p-3 font-black text-xs w-full rounded-sm outline-none`} /></div>
        <div className="space-y-1"><label className="text-[8px] font-black text-blue-500 uppercase italic">Fim</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={`${themeClasses.bgInput} border ${themeClasses.border} p-3 font-black text-xs w-full rounded-sm outline-none`} /></div>
        <div className="space-y-1"><label className="text-[8px] font-black text-blue-500 uppercase italic">Companhia</label><select value={analyticsAirline} onChange={e => setAnalyticsAirline(e.target.value)} className={`${themeClasses.bgInput} border ${themeClasses.border} p-3 font-black text-xs w-full rounded-sm outline-none appearance-none uppercase italic`}>
          <option value="todos">TODAS</option>
          {airlines.map(cia => <option key={cia} value={cia}>{cia}</option>)}
        </select></div>
        <div className="space-y-1"><label className="text-[8px] font-black text-blue-500 uppercase italic">Turno</label><select value={analyticsShift} onChange={e => setAnalyticsShift(e.target.value as any)} className={`${themeClasses.bgInput} border ${themeClasses.border} p-3 font-black text-xs w-full rounded-sm outline-none appearance-none uppercase italic`}>
          <option value="todos">TODOS</option>
          <option value="manha">MANHÃ</option><option value="tarde">TARDE</option><option value="noite">NOITE</option><option value="madrugada">MADRUGADA</option>
        </select></div>
        <button onClick={fetchData} className="bg-blue-600 h-11 w-full lg:w-12 rounded-sm text-white hover:bg-blue-500 transition-all flex items-center justify-center shrink-0"><RefreshCcw size={18} className={loading ? 'animate-spin' : ''}/></button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 flex-none overflow-x-auto pb-2 no-scrollbar">
        {[ 
          { id: 'voos', l: 'VOOS', sl: 'NO PERÍODO', v: analyticsData.monthlyFlights, c: 'blue' }, 
          { id: 'solo', l: 'MÉDIA SOLO', sl: 'TURNAROUND', v: formatMinutes(analyticsData.avgTurnaround), c: 'blue' }, 
          { id: 'frota', l: 'FROTA TOTAL', sl: 'ATIVOS', v: fleetSummary.total, c: 'slate' },
          { id: 'operantes', l: 'OPERANTES', sl: 'FROTA ATIVA', v: fleetSummary.op, c: 'emerald', cl: true },
          { id: 'manutencao', l: 'MANUTENÇÃO', sl: 'INDISPONÍVEIS', v: fleetSummary.mt, c: 'rose', cl: true },
          { id: 'locacoes', l: 'LOCAÇÕES', sl: 'SOH TOTAIS', v: analyticsData.rentalCount, c: 'amber', cl: true } 
        ].map((k, i) => (
          <div key={i} onClick={() => k.cl && setDetailView(k.id as any)} className={`${themeClasses.bgCard} border-l-4 border-${k.c}-500 p-5 rounded-sm shadow-xl min-w-[140px] hover:bg-slate-800/20 transition-all cursor-${k.cl ? 'pointer' : 'default'} active:scale-95`}>
            <h4 className={`text-2xl font-black italic tracking-tighter text-white tabular-nums`}>{k.v}</h4>
            <p className={`text-[9px] font-black text-${k.c}-500 uppercase italic tracking-widest`}>{k.l}</p>
            <p className="text-[7px] font-black text-slate-500 uppercase italic mt-1">{k.sl}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        <div className={`lg:col-span-8 ${themeClasses.bgCard} border ${themeClasses.border} p-6 rounded-sm shadow-2xl flex flex-col overflow-hidden`}>
          <div className="flex justify-between items-center mb-6">
             <h3 className="text-xl font-black italic uppercase tracking-tighter">Histórico de <span className="text-blue-600">Voos</span></h3>
             <TrendingUp size={20} className="text-blue-500 opacity-20" />
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.chartData} onClick={(d: any) => d?.activePayload && handleBarClick(d.activePayload[0].payload)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="name" fontSize={9} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 900, fontStyle: 'italic'}} dy={10} />
                <YAxis fontSize={9} axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <Tooltip cursor={{fill: 'white', opacity: 0.05}} contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '4px'}} />
                <Bar dataKey="voos" radius={[4, 4, 0, 0]} fill="#3b82f6" barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`hidden lg:flex lg:col-span-4 flex-col ${themeClasses.bgCard} border ${themeClasses.border} rounded-sm shadow-2xl p-6`}>
           <h3 className="text-xl font-black italic uppercase tracking-tighter text-white mb-6">Saúde da Frota</h3>
           <div className="flex-1 flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value" stroke="none">
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{backgroundColor: '#0f172a', border: 'none', borderRadius: '4px'}} />
                </PieChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>
      
      {detailView && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-sm" onClick={() => setDetailView(null)}></div>
          <div className={`relative w-full max-w-2xl bg-[#1e293b] border ${themeClasses.border} shadow-2xl rounded-sm overflow-hidden flex flex-col max-h-[70vh]`}>
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-blue-600/5">
               <h3 className="text-xl font-black italic uppercase text-white">Detalhamento</h3>
               <button onClick={() => setDetailView(null)}><X size={24}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
               <p className="text-center opacity-20 italic font-black uppercase py-20">Listagem de ativos detalhada...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsTab;
