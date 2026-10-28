import React from 'react';
import { CheckSquare, Square } from 'lucide-react';
import { TemaConfirmado, temaDoDia } from './temaDoDia';

// ─── O tema do dia no formulário do líder, entrou em 28/10/2026 ──────────
// Fica na seção 9 e aparece SÓ COM O BRIEFING LIGADO (quem decide é o
// `NewReportTab`): o tema é do briefing, e o debriefing continua como era.
//
// 🔑 Os 3 pontos são lidos EM VOZ ALTA, no pátio. Por isso não seguem o
// estilo do resto do formulário (caixa alta, itálico, 8px): aqui a letra é
// maior, normal e sem itálico, que é o que se lê de pé sem tropeçar.
//
// 🔑 O botão é a declaração do líder de que leu os 3 pontos para a equipe.
// O "Finalizar turno" segura o envio enquanto ela faltar (ver `App.tsx`).

const horaDe = (iso: string): string => {
  const d = new Date(iso);
  return isFinite(d.getTime())
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '--:--';
};

const CartaoTema: React.FC<{
  data: string;
  confirmado: TemaConfirmado | null;
  onConfirmar: (c: TemaConfirmado | null) => void;
}> = ({ data, confirmado, onConfirmar }) => {
  const tema = temaDoDia(data);
  if (!tema) return null;

  // Confirmação de outro dia não conta: a data do relatório mudou e o tema
  // mudou junto.
  const lido = !!confirmado && confirmado.dia === tema.dia;

  return (
    <div id="tema-do-dia" className="mt-4 border border-violet-500/40 bg-violet-500/5 rounded-sm p-4">
      <p className="text-[8px] font-black uppercase italic text-violet-500 tracking-widest mb-1">
        Tema do dia {tema.dia} · Leia para a equipe no briefing
      </p>
      <p className="text-[14px] font-black text-slate-900 leading-snug mb-3">{tema.titulo}</p>

      <ol className="space-y-2.5">
        {tema.pontos.map((ponto, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="flex-shrink-0 w-5 h-5 mt-px rounded-full bg-violet-600 text-white text-[10px] font-black flex items-center justify-center">
              {i + 1}
            </span>
            <span className="text-[13px] font-medium text-slate-700 leading-snug">{ponto}</span>
          </li>
        ))}
      </ol>

      <p className="mt-3 text-[9px] font-bold text-slate-400">MGO {tema.mgo}</p>

      <button
        onClick={() => onConfirmar(lido ? null : { dia: tema.dia, em: new Date().toISOString() })}
        className={`mt-4 w-full py-3 px-3 border rounded-sm flex items-center justify-center gap-2 transition-all ${
          lido
            ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-600'
            : 'bg-amber-500/10 border-amber-500/50 text-amber-600'
        }`}
      >
        {lido ? <CheckSquare size={16} /> : <Square size={16} />}
        <span className="text-[10px] font-black uppercase italic leading-none">
          {lido ? `Lido para a equipe às ${horaDe(confirmado!.em)}` : 'Li os 3 pontos para a equipe'}
        </span>
      </button>
    </div>
  );
};

export default CartaoTema;
