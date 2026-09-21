import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ParInvertido, fmtDuracao } from './horarios';

// ─── O aviso de horário invertido, no app do líder ─────────────────────────
// Abre quando um par início/fim fica com o fim menor ou igual ao início, e
// de novo na hora de finalizar se ainda houver par assim sem confirmação.
//
// 🔑 "Corrigir" é o botão forte e "Seguir" é o fraco, de propósito: o caso
// comum é dedo trocado, e o raro (23:50 → 01:10, virada do 3º turno) é o que
// precisa de um toque a mais. Nada aqui é caixa nativa do navegador.

interface Props {
  itens: ParInvertido[];
  // true quando o aviso está segurando o "Finalizar turno": muda a frase do
  // botão, porque seguir aqui leva pra prévia.
  segurandoEnvio: boolean;
  onCorrigir: () => void;
  onSeguir: () => void;
}

const AvisoHorarios: React.FC<Props> = ({ itens, segurandoEnvio, onCorrigir, onSeguir }) => {
  if (itens.length === 0) return null;
  const varios = itens.length > 1;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onCorrigir}>
      <div
        className="bg-white rounded-sm shadow-2xl max-w-sm w-full p-6 space-y-5 animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertTriangle size={32} className="text-amber-500" />
          <h3 className="text-lg font-black italic uppercase text-slate-900 leading-tight">
            {varios ? 'Horários invertidos' : 'Horário invertido'}
          </h3>
          <p className="text-sm text-slate-600 font-medium">
            {varios
              ? 'Nestes lançamentos o início é maior que o fim, e o app vai contar como se tivesse virado a meia-noite:'
              : 'O início é maior que o fim, e o app vai contar como se tivesse virado a meia-noite:'}
          </p>
        </div>

        <ul className="space-y-2">
          {itens.map(p => (
            <li key={p.chave} className="bg-amber-50 border border-amber-200 rounded-sm px-3 py-2 text-left">
              <p className="text-[11px] font-black uppercase italic text-slate-800">{p.onde}</p>
              <p className="text-sm text-slate-700">
                {p.inicio} às {p.fim}
                <span className="font-black text-amber-600"> · conta {fmtDuracao(p.minutos)}</span>
              </p>
            </li>
          ))}
        </ul>

        <p className="text-sm text-slate-600 font-medium text-center">
          Deseja seguir assim mesmo?
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={onCorrigir}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-sm font-black uppercase italic text-xs transition-all shadow-lg"
          >
            Corrigir os horários
          </button>
          <button
            onClick={onSeguir}
            className="w-full py-3 border border-amber-300 rounded-sm font-black uppercase italic text-xs text-amber-700 hover:bg-amber-50 transition-all"
          >
            {segurandoEnvio ? 'Seguir assim mesmo e finalizar' : 'Seguir assim mesmo'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AvisoHorarios;
