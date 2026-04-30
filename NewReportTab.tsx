
import React, { useState } from 'react';
import { Plus, Trash2, Send, RefreshCcw, Handshake, AlertTriangle, Plane, Lock } from 'lucide-react';

interface NewReportTabProps {
  themeClasses: any;
  formDate: string;
  setFormDate: (d: string) => void;
  formShift: string;
  setFormShift: (s: any) => void;
  formLeader: string;
  setFormLeader: (l: string) => void;
  leaders: any[];
  formHR: any;
  setFormHR: (hr: any) => void;
  formPendencias: string;
  setFormPendencias: (p: string) => void;
  formOcorrencias: string;
  setFormOcorrencias: (o: string) => void;
  formRentals: any[];
  handleAddRental: () => void;
  handleRemoveRental: (i: number) => void;
  handleRentalChange: (i: number, f: string, v: string) => void;
  formFlights: any[];
  handleAddFlight: () => void;
  handleRemoveFlight: (i: number) => void;
  handleFlightChange: (i: number, f: string, v: string) => void;
  airlines: string[];
  formGseOut: any[];
  handleAddGseOut: () => void;
  handleRemoveGseOut: (i: number) => void;
  handleGseOutChange: (i: number, f: string, v: string) => void;
  formGseIn: any[];
  handleAddGseIn: () => void;
  handleRemoveGseIn: (i: number) => void;
  handleGseInChange: (i: number, v: string) => void;
  formTransporte: any[];
  handleAddTransporte: () => void;
  handleRemoveTransporte: (i: number) => void;
  handleTransporteChange: (i: number, f: string, v: string) => void;
  fleetDetails: any[];
  isSubmitting: boolean;
  handleSaveReport: () => void;
  resetForm: () => void;
  setActiveTab: (t: any) => void;
  handleAddAirline: (nome: string) => void;
  handleAddEquipamento: (prefixo: string, nome: string) => void;
  formBriefing: { ativo: boolean; inicio: string; fim: string };
  setFormBriefing: (b: any) => void;
  formDebriefing: { ativo: boolean; inicio: string; fim: string };
  setFormDebriefing: (d: any) => void;
}

// Equipamentos segregados por fornecedor (correspondem exatamente à tabela de preços no Supabase)
const EQUIPAMENTOS_POR_FORNECEDOR: Record<string, string[]> = {
  'Gol':     ['LPU/ASU', 'GPU'],
  'Pro Air': ['TRATOR', 'PUSHBACK NARROW', 'VIATURA', 'LOADER LDL'],
  'Dnata':   ['PUSHBACK NARROW', 'PUSHBACK WIDE', 'TRATOR', 'LOADER LDL', 'LOADER MDL', 'LPU/ASU', 'GPU', 'CARRETA'],
  'AeroSky': ['PUSHBACK NARROW', 'VIATURA'],
};

const EMPRESAS_LOCACAO = Object.keys(EQUIPAMENTOS_POR_FORNECEDOR);

const NewReportTab: React.FC<NewReportTabProps> = (props) => {
  const { themeClasses } = props;

  const [newAirline, setNewAirline] = useState('');
  const [newEquipPrefixo, setNewEquipPrefixo] = useState('');
  const [newEquipNome, setNewEquipNome] = useState('');
  const [savingAirline, setSavingAirline] = useState(false);
  const [savingEquip, setSavingEquip] = useState(false);

  const handleSaveAirline = async () => {
    const nome = newAirline.trim().toUpperCase();
    if (!nome) return;
    setSavingAirline(true);
    await props.handleAddAirline(nome);
    setNewAirline('');
    setSavingAirline(false);
  };

  const handleSaveEquip = async () => {
    const prefixo = newEquipPrefixo.trim().toUpperCase();
    const nome = newEquipNome.trim().toUpperCase();
    if (!prefixo || !nome) return;
    setSavingEquip(true);
    await props.handleAddEquipamento(prefixo, nome);
    setNewEquipPrefixo('');
    setNewEquipNome('');
    setSavingEquip(false);
  };

  const isRentalsValid = props.formRentals.every(loc => {
    if (loc.tipo === 'ALOCAR') return loc.equipamento && loc.inicio && loc.fim;
    return loc.empresa && loc.equipamento && loc.inicio && loc.fim && loc.quem_atender && loc.motivo_locacao?.trim();
  });

  const isFlightsValid = props.formFlights.every(v => {
    const hasCia = v.companhia && (v.companhia !== 'OUTROS' || (v.manual_name && v.manual_name.trim() !== ''));
    return hasCia && v.pouso && v.reboque;
  });

  const isTransporteValid = props.formTransporte.every(t => {
    const hasCia = t.cia && (t.cia !== 'OUTROS' || (t.manual_name && t.manual_name.trim() !== ''));
    return hasCia;
  });
  const isGseOutValid = props.formGseOut.every(g => g.prefixo && g.motivo?.trim());
  const isGseInValid = props.formGseIn.every(g => g.prefixo);
  const isHRValid = !props.formHR.falta || (props.formHR.falta && props.formHR.detalhe_falta?.trim());

  const canSubmit = props.formLeader && isRentalsValid && isFlightsValid && isTransporteValid && isGseOutValid && isGseInValid && isHRValid;
  const isDateLocked = props.formShift !== 'madrugada';

  return (
    <div className="h-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
       <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-5 pb-6">
         
         {/* CABEÇALHO */}
         <div className={`${themeClasses.bgCard} border ${themeClasses.border} p-5 md:p-8 shadow-2xl space-y-6 rounded-sm`}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-1.5 h-6 bg-blue-600"></div>
              <h2 className="text-xl font-black italic uppercase tracking-tighter">LANÇAMENTO DE <span className="text-blue-600">TURNO</span></h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-1.5 relative">
                <label className="text-[9px] font-black text-blue-500 uppercase italic flex items-center gap-2">
                  REFERÊNCIA {isDateLocked && <Lock size={8} className="opacity-50" />}
                </label>
                <div className="relative">
                  <input 
                    type="date" 
                    value={props.formDate} 
                    onChange={e => props.setFormDate(e.target.value)} 
                    disabled={isDateLocked}
                    className={`${themeClasses.bgInput} border ${themeClasses.border} p-3.5 font-black text-xs w-full italic rounded-sm outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed`} 
                  />
                  {isDateLocked && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-20">
                      <Lock size={14} />
                    </div>
                  )}
                </div>
                {isDateLocked && <p className="text-[7px] font-black text-slate-500 uppercase italic">Bloqueado p/ turnos diurnos</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-blue-500 uppercase italic">TURNO VIGENTE</label>
                <select 
                  value={props.formShift} 
                  onChange={e => props.setFormShift(e.target.value as any)} 
                  className={`${themeClasses.bgInput} border ${themeClasses.border} p-3.5 font-black text-xs w-full italic rounded-sm outline-none appearance-none`}
                >
                  <option value="manha">MANHÃ</option>
                  <option value="tarde">TARDE</option>
                  <option value="noite">NOITE</option>
                  <option value="madrugada">MADRUGADA</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-blue-500 uppercase italic">LÍDER RESPONSÁVEL</label>
                <select 
                  value={props.formLeader} 
                  onChange={e => props.setFormLeader(e.target.value)} 
                  className={`${themeClasses.bgInput} border ${themeClasses.border} p-3.5 font-black text-xs w-full italic rounded-sm outline-none appearance-none ${!props.formLeader ? 'border-amber-500/50' : ''}`}
                >
                  <option value="">-- SELECIONE --</option>
                  {props.leaders.map(l => <option key={l.id} value={l.nome}>{l.nome}</option>)}
                </select>
              </div>
            </div>
         </div>

         {/* RH */}
         <div className={`${themeClasses.bgCard} border ${themeClasses.border} p-5 shadow-xl rounded-sm`}>
            <h4 className="text-[10px] font-black italic uppercase text-slate-500 mb-4 tracking-widest">Controle de Equipe</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[{k: 'falta', l: 'Falta'}, {k: 'atestado', l: 'Atestado'}, {k: 'compensacao', l: 'Compens.'}, {k: 'saida_antecipada', l: 'Saída Ant.'}].map(i => (
                <button 
                  key={i.k} 
                  onClick={() => props.setFormHR({...props.formHR, [i.k]: !props.formHR[i.k]})} 
                  className={`py-4 px-2 border transition-all rounded-sm flex items-center justify-center text-center ${props.formHR[i.k] ? 'bg-rose-500/20 border-rose-500 text-rose-500 shadow-lg' : `${themeClasses.bgInput} border-transparent opacity-50`}`}
                >
                  <span className="text-[9px] font-black uppercase italic leading-none">{i.l}</span>
                </button>
              ))}
            </div>
            
            {props.formHR.falta && (
              <div className="mt-4 space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                <label className="text-[9px] font-black text-rose-500 uppercase italic">Identificação de quem faltou</label>
                <input 
                  type="text" 
                  value={props.formHR.detalhe_falta || ''} 
                  onChange={e => props.setFormHR({...props.formHR, detalhe_falta: e.target.value})}
                  placeholder="Nome do colaborador..."
                  className={`${themeClasses.bgInput} border border-rose-500/30 p-3.5 font-black text-xs w-full italic rounded-sm outline-none focus:border-rose-500`}
                />
              </div>
            )}
         </div>

         {/* PENDENCIAS / OCORRENCIAS */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className={`${themeClasses.bgCard} border ${themeClasses.border} p-5 shadow-xl rounded-sm space-y-3`}>
                <label className="text-[10px] font-black text-amber-500 uppercase italic flex items-center gap-2">
                  <AlertTriangle size={12}/> PENDÊNCIAS
                </label>
              <textarea 
                value={props.formPendencias} 
                onChange={e => props.setFormPendencias(e.target.value)} 
                rows={2} 
                placeholder="Ex: Equipamento X no box 2..."
                className={`${themeClasses.bgInput} border ${themeClasses.border} p-4 font-bold text-xs rounded-sm w-full italic outline-none focus:border-amber-500`}
              />
            </div>
            <div className={`${themeClasses.bgCard} border ${themeClasses.border} p-5 shadow-xl rounded-sm space-y-3`}>
                <label className="text-[10px] font-black text-rose-500 uppercase italic flex items-center gap-2">
                  <AlertTriangle size={12}/> OCORRÊNCIAS
                </label>
              <textarea 
                value={props.formOcorrencias} 
                onChange={e => props.setFormOcorrencias(e.target.value)} 
                rows={2} 
                placeholder="Ex: Atraso no voo 123..."
                className={`${themeClasses.bgInput} border ${themeClasses.border} p-4 font-bold text-xs rounded-sm w-full italic outline-none focus:border-rose-500`}
              />
            </div>
         </div>

         {/* ATENDIMENTOS */}
         <div className={`${themeClasses.bgCard} border ${themeClasses.border} p-5 shadow-2xl rounded-sm`}>
             <div className="flex items-center gap-3 mb-5">
               <Plane size={16} className="text-blue-600" />
               <h4 className="text-[10px] font-black italic uppercase text-blue-600 tracking-widest">5 - LOG DE ATENDIMENTOS</h4>
             </div>
             
             <button 
               onClick={props.handleAddFlight} 
               className="w-full py-3 mb-5 bg-blue-600 hover:bg-blue-700 text-white rounded-sm font-black uppercase italic flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
             >
               <Plus size={18} /> INSERIR CIA
             </button>
            
            <div className="space-y-3">
              {props.formFlights.map((v, i) => (
                <div key={i} className={`${themeClasses.bgInput} p-3 rounded-sm relative border border-white/5`}>
                  <button onClick={() => props.handleRemoveFlight(i)} className="absolute -top-1.5 -right-1.5 bg-rose-600 p-1.5 rounded-full text-white shadow-xl z-10"><Trash2 size={10}/></button>
                  <div className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-12 md:col-span-6 flex gap-2">
                      <div className="flex-1">
                        <select 
                          value={v.companhia} 
                          onChange={e => props.handleFlightChange(i, 'companhia', e.target.value)} 
                          className="bg-transparent border-none p-1 font-black text-xs w-full outline-none focus:ring-0 italic appearance-none"
                        >
                          <option value="">CIA</option>
                          {props.airlines.map(cia => <option key={cia} value={cia}>{cia}</option>)}
                          <option value="OUTROS">OUTROS</option>
                        </select>
                      </div>
                    </div>
                    {v.companhia === 'OUTROS' && (
                      <div className="col-span-12">
                        <input 
                          type="text" 
                          placeholder="NOME CIA..." 
                          value={v.manual_name || ''} 
                          onChange={e => props.handleFlightChange(i, 'manual_name', e.target.value)} 
                          className="bg-slate-900/20 border-none p-2 font-black text-[10px] w-full italic rounded-sm" 
                        />
                      </div>
                    )}
                    <div className="col-span-6 md:col-span-3">
                      <label className="text-[7px] font-black text-slate-500 uppercase block mb-1">Início</label>
                      <input type="time" value={v.pouso} onChange={e => props.handleFlightChange(i, 'pouso', e.target.value)} className="bg-slate-900/20 p-2 rounded-sm border-none font-black text-xs text-blue-500 w-full" />
                    </div>
                    <div className="col-span-6 md:col-span-3">
                      <label className="text-[7px] font-black text-slate-500 uppercase block mb-1">Fim</label>
                      <input type="time" value={v.reboque} onChange={e => props.handleFlightChange(i, 'reboque', e.target.value)} className="bg-slate-900/20 p-2 rounded-sm border-none font-black text-xs text-emerald-500 w-full" />
                    </div>
                  </div>
                </div>
              ))}
              {props.formFlights.length === 0 && <p className="text-center py-4 text-[9px] font-black uppercase italic opacity-20">Nenhum voo adicionado</p>}
            </div>
         </div>

         {/* LOCAÇÕES */}
         <div className={`${themeClasses.bgCard} border ${themeClasses.border} p-5 shadow-2xl rounded-sm`}>
             <div className="flex items-center gap-3 mb-5">
               <Handshake size={16} className="text-emerald-600" />
               <h4 className="text-[10px] font-black italic uppercase text-emerald-600 tracking-widest">4 - LOCAÇÕES / ALOCAÇÕES</h4>
             </div>

             <button 
               onClick={props.handleAddRental} 
               className="w-full py-3 mb-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm font-black uppercase italic flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
             >
               <Plus size={18} /> NOVA LOCAÇÃO
             </button>

            <div className="space-y-4">
              {props.formRentals.map((loc, i) => (
                <div key={i} className={`${themeClasses.bgInput} p-4 rounded-sm relative border border-white/5 space-y-4`}>
                  <button onClick={() => props.handleRemoveRental(i)} className="absolute -top-1.5 -right-1.5 bg-rose-600 p-1.5 rounded-full text-white shadow-xl z-10"><Trash2 size={10}/></button>
                  
                  {/* Toggle Interno / Externo */}
                  <div className="flex gap-1 bg-slate-900/40 p-1 rounded-sm">
                    <button 
                      onClick={() => props.handleRentalChange(i, 'tipo', 'ALOCAR')}
                      className={`flex-1 py-1.5 text-[8px] font-black uppercase italic rounded-sm transition-all ${loc.tipo === 'ALOCAR' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
                    >
                      Interno
                    </button>
                    <button 
                      onClick={() => props.handleRentalChange(i, 'tipo', 'LOCAR')}
                      className={`flex-1 py-1.5 text-[8px] font-black uppercase italic rounded-sm transition-all ${loc.tipo === 'LOCAR' ? 'bg-amber-600 text-white' : 'text-slate-500'}`}
                    >
                      Externo
                    </button>
                  </div>

                  {loc.tipo === 'ALOCAR' ? (
                    <select 
                      value={loc.equipamento} 
                      onChange={e => props.handleRentalChange(i, 'equipamento', e.target.value)} 
                      className="bg-slate-900/30 border border-white/10 p-2.5 font-black text-[10px] w-full italic rounded-sm outline-none text-white appearance-none"
                    >
                      <option value="">EQUIPAMENTO FROTA</option>
                      {props.fleetDetails.map(e => <option key={e.id} value={e.prefixo}>{e.prefixo} - {e.nome}</option>)}
                    </select>
                  ) : (
                    <>
                      {/* Fornecedor + Equipamento filtrado */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[7px] font-black text-amber-400 uppercase block">FORNECEDOR</label>
                          <select
                            value={loc.empresa || ''}
                            onChange={e => {
                              props.handleRentalChange(i, 'empresa', e.target.value);
                              props.handleRentalChange(i, 'equipamento', ''); // reset equipamento ao trocar fornecedor
                            }}
                            className="bg-slate-900/30 border border-white/10 p-2.5 font-black text-[10px] w-full italic rounded-sm outline-none text-white appearance-none"
                          >
                            <option value="">SELECIONE</option>
                            {EMPRESAS_LOCACAO.map(emp => <option key={emp} value={emp}>{emp.toUpperCase()}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[7px] font-black text-amber-400 uppercase block">
                            EQUIPAMENTO {loc.empresa === 'Gol' && <span className="text-yellow-400">💲 USD</span>}
                          </label>
                          <select
                            value={loc.equipamento}
                            onChange={e => props.handleRentalChange(i, 'equipamento', e.target.value)}
                            disabled={!loc.empresa}
                            className="bg-slate-900/30 border border-white/10 p-2.5 font-black text-[10px] w-full italic rounded-sm outline-none text-white appearance-none disabled:opacity-40"
                          >
                            <option value="">TIPO</option>
                            {(EQUIPAMENTOS_POR_FORNECEDOR[loc.empresa] || []).map(eq => (
                              <option key={eq} value={eq}>{eq}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Campo: Quem vamos atender */}
                      <div className="space-y-1">
                        <label className="text-[7px] font-black text-emerald-400 uppercase block">
                          1. QUEM SERÁ ATENDIDO COM ESSA LOCAÇÃO?
                        </label>
                        <select
                          value={loc.quem_atender || ''}
                          onChange={e => props.handleRentalChange(i, 'quem_atender', e.target.value)}
                          className={`bg-slate-900/20 border p-2.5 font-black text-[10px] w-full italic rounded-sm outline-none focus:border-emerald-500 transition-colors appearance-none ${!loc.quem_atender?.trim() ? 'border-amber-500/40' : 'border-white/5'}`}
                        >
                          <option value="">SELECIONE A CIA</option>
                          {props.airlines.map(cia => <option key={cia} value={cia}>{cia}</option>)}
                        </select>
                      </div>

                      {/* Campo: Motivo da locação */}
                      <div className="space-y-1">
                        <label className="text-[7px] font-black text-emerald-400 uppercase block">
                          2. MOTIVO DA LOCAÇÃO
                        </label>
                        <textarea
                          value={loc.motivo_locacao || ''}
                          onChange={e => props.handleRentalChange(i, 'motivo_locacao', e.target.value)}
                          rows={2}
                          placeholder="Ex: Nosso equipamento está com defeito / Em manutenção..."
                          className={`bg-slate-900/20 border p-2.5 font-black text-[10px] w-full italic rounded-sm outline-none focus:border-emerald-500 transition-colors resize-none ${!loc.motivo_locacao?.trim() ? 'border-amber-500/40' : 'border-white/5'}`}
                        />
                      </div>
                    </>
                  )}

                  {/* Horários */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[7px] font-black text-slate-500 uppercase block">Início</label>
                      <input type="time" value={loc.inicio} onChange={e => props.handleRentalChange(i, 'inicio', e.target.value)} className="bg-slate-900/20 border border-white/5 p-2 font-black text-[10px] text-blue-500 w-full rounded-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[7px] font-black text-slate-500 uppercase block">Fim</label>
                      <input type="time" value={loc.fim} onChange={e => props.handleRentalChange(i, 'fim', e.target.value)} className="bg-slate-900/20 border border-white/5 p-2 font-black text-[10px] text-blue-500 w-full rounded-sm" />
                    </div>
                  </div>
                </div>
              ))}
              {props.formRentals.length === 0 && <p className="text-center py-4 text-[9px] font-black uppercase italic opacity-20">Nenhuma locação</p>}
            </div>
         </div>

         {/* TRANSPORTE TRIPULAÇÃO */}
         <div className={`${themeClasses.bgCard} border ${themeClasses.border} p-5 shadow-2xl rounded-sm`}>
             <div className="flex items-center gap-3 mb-5">
               <Handshake size={16} className="text-blue-500" />
               <h4 className="text-[10px] font-black italic uppercase text-blue-500 tracking-widest">8 - TRANSPORTE DE TRIPULANTE E IMIGRAÇÃO</h4>
             </div>
             
             <button 
               onClick={props.handleAddTransporte} 
               className="w-full py-3 mb-5 bg-blue-500 hover:bg-blue-600 text-white rounded-sm font-black uppercase italic flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
             >
               <Plus size={18} /> NOVO TRANSPORTE
             </button>
            
            <div className="space-y-3">
              {props.formTransporte.map((t, i) => (
                <div key={i} className={`${themeClasses.bgInput} p-3 rounded-sm relative border border-white/5 space-y-2`}>
                  <button onClick={() => props.handleRemoveTransporte(i)} className="absolute -top-1.5 -right-1.5 bg-rose-600 p-1.5 rounded-full text-white shadow-xl z-10"><Trash2 size={10}/></button>
                  <select 
                    value={t.cia} 
                    onChange={e => props.handleTransporteChange(i, 'cia', e.target.value)} 
                    className="bg-transparent border-none p-1 font-black text-xs w-full outline-none focus:ring-0 italic appearance-none"
                  >
                    <option value="">SELECIONE A CIA</option>
                    {props.airlines.map(cia => <option key={cia} value={cia}>{cia}</option>)}
                    <option value="OUTROS">OUTROS</option>
                  </select>
                  {t.cia === 'OUTROS' && (
                    <input 
                      type="text" 
                      placeholder="NOME DA CIA..." 
                      value={t.manual_name || ''} 
                      onChange={e => props.handleTransporteChange(i, 'manual_name', e.target.value)} 
                      className="bg-slate-900/20 border-none p-2 font-black text-[10px] w-full italic rounded-sm outline-none focus:ring-1 focus:ring-blue-500" 
                    />
                  )}
                </div>
              ))}
              {props.formTransporte.length === 0 && <p className="text-center py-4 text-[9px] font-black uppercase italic opacity-20">Nenhum transporte registrado</p>}
            </div>
         </div>

         {/* BAIXAS / RETORNOS */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className={`${themeClasses.bgCard} border ${themeClasses.border} p-5 shadow-xl rounded-sm space-y-4`}>
               <h4 className="text-[10px] font-black italic uppercase text-rose-500 tracking-widest mb-4">6 - BAIXA TÉCNICA (GSE)</h4>
               
               <button 
                 onClick={props.handleAddGseOut} 
                 className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-sm font-black uppercase italic flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
               >
                 <Plus size={18} /> NOVA BAIXA
               </button>
               <div className="space-y-2">
                 {props.formGseOut.map((item, i) => (
                   <div key={i} className={`${themeClasses.bgInput} p-3 rounded-sm relative border border-white/5 space-y-2`}>
                     <button onClick={() => props.handleRemoveGseOut(i)} className="absolute -top-1 -right-1 bg-rose-700 p-1 rounded-full text-white shadow-xl"><Trash2 size={10}/></button>
                     <select value={item.prefixo} onChange={e => props.handleGseOutChange(i, 'prefixo', e.target.value)} className="bg-transparent border-none p-1 font-black text-[10px] w-full focus:ring-0 italic appearance-none">
                       <option value="">EQUIPAMENTO</option>
                       {props.fleetDetails.filter(e => e.status === 'OPERACIONAL').map(e => <option key={e.id} value={e.prefixo}>{e.prefixo}</option>)}
                     </select>
                     <input 
                       type="text" 
                       placeholder="MOTIVO DA BAIXA..." 
                       value={item.motivo || ''} 
                       onChange={e => props.handleGseOutChange(i, 'motivo', e.target.value)} 
                       className="bg-slate-900/20 border-none p-2 font-black text-[9px] w-full italic rounded-sm outline-none focus:ring-1 focus:ring-rose-500" 
                     />
                   </div>
                 ))}
               </div>
            </div>
            <div className={`${themeClasses.bgCard} border ${themeClasses.border} p-5 shadow-xl rounded-sm space-y-4`}>
               <h4 className="text-[10px] font-black italic uppercase text-emerald-500 tracking-widest mb-4">7 - RETORNO DE GSE</h4>
               
               <button 
                 onClick={props.handleAddGseIn} 
                 className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm font-black uppercase italic flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
               >
                 <Plus size={18} /> NOVO RETORNO
               </button>
               <div className="space-y-2">
                 {props.formGseIn.map((item, i) => (
                   <div key={i} className={`${themeClasses.bgInput} p-3 rounded-sm relative border border-white/5`}>
                     <button onClick={() => props.handleRemoveGseIn(i)} className="absolute -top-1 -right-1 bg-emerald-700 p-1 rounded-full text-white shadow-xl"><Trash2 size={10}/></button>
                     <select value={item.prefixo} onChange={e => props.handleGseInChange(i, e.target.value)} className="bg-transparent border-none p-1 font-black text-[10px] w-full focus:ring-0 italic appearance-none">
                       <option value="">EQUIPAMENTO</option>
                       {props.fleetDetails.filter(e => e.status === 'MANUTENCAO').map(e => <option key={e.id} value={e.prefixo}>{e.prefixo}</option>)}
                     </select>
                   </div>
                 ))}
               </div>
            </div>
         </div>

         {/* BRIEFING / DEBRIEFING */}
         <div className={`${themeClasses.bgCard} border ${themeClasses.border} p-5 shadow-2xl rounded-sm`}>
           <div className="flex items-center gap-3 mb-5">
             <div className="w-1.5 h-6 bg-violet-500"></div>
             <h4 className="text-[10px] font-black italic uppercase text-violet-500 tracking-widest">8 - BRIEFING / DEBRIEFING</h4>
           </div>

           <div className="grid grid-cols-2 gap-3">
             {/* BRIEFING */}
             <div className="space-y-3">
               <button
                 onClick={() => props.setFormBriefing({ ...props.formBriefing, ativo: !props.formBriefing.ativo })}
                 className={`w-full py-4 border transition-all rounded-sm flex items-center justify-center text-center ${props.formBriefing.ativo ? 'bg-violet-500/20 border-violet-500 text-violet-400 shadow-lg' : `${themeClasses.bgInput} border-transparent opacity-50`}`}
               >
                 <span className="text-[9px] font-black uppercase italic leading-none">Briefing</span>
               </button>
               {props.formBriefing.ativo && (
                 <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                   <div className="space-y-1">
                     <label className="text-[7px] font-black text-slate-500 uppercase block">Início</label>
                     <input type="time" value={props.formBriefing.inicio} onChange={e => props.setFormBriefing({ ...props.formBriefing, inicio: e.target.value })} className="bg-slate-900/20 border border-white/5 p-2 font-black text-[10px] text-blue-500 w-full rounded-sm" />
                   </div>
                   <div className="space-y-1">
                     <label className="text-[7px] font-black text-slate-500 uppercase block">Fim</label>
                     <input type="time" value={props.formBriefing.fim} onChange={e => props.setFormBriefing({ ...props.formBriefing, fim: e.target.value })} className="bg-slate-900/20 border border-white/5 p-2 font-black text-[10px] text-emerald-500 w-full rounded-sm" />
                   </div>
                 </div>
               )}
             </div>

             {/* DEBRIEFING */}
             <div className="space-y-3">
               <button
                 onClick={() => props.setFormDebriefing({ ...props.formDebriefing, ativo: !props.formDebriefing.ativo })}
                 className={`w-full py-4 border transition-all rounded-sm flex items-center justify-center text-center ${props.formDebriefing.ativo ? 'bg-violet-500/20 border-violet-500 text-violet-400 shadow-lg' : `${themeClasses.bgInput} border-transparent opacity-50`}`}
               >
                 <span className="text-[9px] font-black uppercase italic leading-none">Debriefing</span>
               </button>
               {props.formDebriefing.ativo && (
                 <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                   <div className="space-y-1">
                     <label className="text-[7px] font-black text-slate-500 uppercase block">Início</label>
                     <input type="time" value={props.formDebriefing.inicio} onChange={e => props.setFormDebriefing({ ...props.formDebriefing, inicio: e.target.value })} className="bg-slate-900/20 border border-white/5 p-2 font-black text-[10px] text-blue-500 w-full rounded-sm" />
                   </div>
                   <div className="space-y-1">
                     <label className="text-[7px] font-black text-slate-500 uppercase block">Fim</label>
                     <input type="time" value={props.formDebriefing.fim} onChange={e => props.setFormDebriefing({ ...props.formDebriefing, fim: e.target.value })} className="bg-slate-900/20 border border-white/5 p-2 font-black text-[10px] text-emerald-500 w-full rounded-sm" />
                   </div>
                 </div>
               )}
             </div>
           </div>
         </div>

         {/* CADASTROS RÁPIDOS */}
         <div className={`${themeClasses.bgCard} border ${themeClasses.border} p-5 shadow-xl rounded-sm space-y-5`}>
           <h4 className="text-[10px] font-black italic uppercase text-slate-400 tracking-widest">Cadastros Rápidos</h4>

           {/* Nova CIA */}
           <div className="space-y-2">
             <label className="text-[8px] font-black text-blue-400 uppercase italic">Nova Companhia Aérea</label>
             <div className="flex gap-2">
               <input
                 type="text"
                 value={newAirline}
                 onChange={e => setNewAirline(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && handleSaveAirline()}
                 placeholder="Ex: LATAM"
                 className={`flex-1 ${themeClasses.bgInput} border ${themeClasses.border} p-3 font-black text-xs italic rounded-sm outline-none focus:border-blue-500`}
               />
               <button
                 onClick={handleSaveAirline}
                 disabled={!newAirline.trim() || savingAirline}
                 className="px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-sm font-black uppercase italic text-[10px] disabled:opacity-30 transition-all flex items-center gap-1"
               >
                 {savingAirline ? <RefreshCcw size={12} className="animate-spin" /> : <Plus size={12} />}
                 ADD
               </button>
             </div>
           </div>

           {/* Novo Equipamento */}
           <div className="space-y-2">
             <label className="text-[8px] font-black text-emerald-400 uppercase italic">Novo Equipamento (Frota)</label>
             <div className="flex flex-col gap-2">
               <div className="flex gap-2">
                 <input
                   type="text"
                   value={newEquipPrefixo}
                   onChange={e => setNewEquipPrefixo(e.target.value)}
                   placeholder="Prefixo (ex: LM00999)"
                   className={`flex-1 ${themeClasses.bgInput} border ${themeClasses.border} p-3 font-black text-xs italic rounded-sm outline-none focus:border-emerald-500`}
                 />
                 <input
                   type="text"
                   value={newEquipNome}
                   onChange={e => setNewEquipNome(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && handleSaveEquip()}
                   placeholder="Tipo (ex: PUSHBACK)"
                   className={`flex-1 ${themeClasses.bgInput} border ${themeClasses.border} p-3 font-black text-xs italic rounded-sm outline-none focus:border-emerald-500`}
                 />
               </div>
               <button
                 onClick={handleSaveEquip}
                 disabled={!newEquipPrefixo.trim() || !newEquipNome.trim() || savingEquip}
                 className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm font-black uppercase italic text-[10px] disabled:opacity-30 transition-all flex items-center justify-center gap-1"
               >
                 {savingEquip ? <RefreshCcw size={12} className="animate-spin" /> : <Plus size={12} />}
                 ADD EQUIPAMENTO
               </button>
             </div>
           </div>
         </div>

       </div>

       {/* FOOTER FIXO */}
       <div className={`flex-none pt-4 border-t ${themeClasses.border} flex flex-col gap-3 items-center bg-transparent backdrop-blur-md`}>
          {!canSubmit && (
            <div className="flex items-center gap-2 text-[8px] font-black text-amber-500 uppercase italic animate-pulse">
               <AlertTriangle size={12} /> Preencha todos os campos obrigatórios
            </div>
          )}
          <button 
            disabled={props.isSubmitting || !canSubmit} 
            onClick={props.handleSaveReport} 
            className={`w-full py-4 text-[12px] font-black text-white rounded-sm uppercase italic flex items-center justify-center gap-4 transition-all shadow-2xl active:scale-95 disabled:opacity-30 ${canSubmit ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/40' : 'bg-slate-700'}`}
          >
            {props.isSubmitting ? <RefreshCcw className="animate-spin" size={24}/> : <><Send size={24}/> FINALIZAR TURNO</>}
          </button>
       </div>

       <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(37, 99, 235, 0.2); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default NewReportTab;
