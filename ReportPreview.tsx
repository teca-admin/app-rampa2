
import React, { useState } from 'react';
import { ArrowLeft, Send, Copy, CheckCircle } from 'lucide-react';

// Grupo "Lideres de Operacoes", conferido em 24/08/2026 consultando o proprio
// link (a pagina do convite devolve o nome do grupo em og:title). Ate esta data
// o codigo apontava para um grupo de TESTE chamado "Tanto faz", e ninguem tinha
// percebido porque quem enviava a mensagem era o n8n, nao o app.
//
// Tem que ser o link de CONVITE, nao o id interno do grupo (@g.us): id so
// funciona por API, que e exatamente o que saiu daqui.
//
// Ao trocar de grupo, confira para onde o link novo aponta antes de subir:
//   curl -s <link> | grep og:title
const GROUP_LINK = 'https://chat.whatsapp.com/BcOXC3K7h8M1vgzX1FU5OH';

// Abre o WhatsApp com a mensagem ja digitada. Se o navegador bloquear a aba nova
// (acontece depois de um await), navega na propria aba em vez de falhar calado.
const abrirWhatsApp = (url: string) => {
  const janela = window.open(url, '_blank');
  if (!janela) window.location.href = url;
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '--/--/----';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

export const buildMessage = (report: any): string => {
  let message = `✅ *RELATÓRIO DE ENTREGA DE TURNO*\n`;
  message += `🗓️ *Data:* ${formatDate(report.data)}\n`;
  message += `🕒 *Turno:* ${report.turno.toUpperCase()}\n`;
  message += `👤 *Líder:* ${report.lider}\n\n`;

  message += `*1 - CONTROLE DE RH* 📋\n`;
  message += `• Falta: ${report.teve_falta ? 'Sim ✅' : 'Não ❌'}\n`;
  if (report.teve_falta && report.detalhe_falta) {
    message += `  _Colaborador: ${report.detalhe_falta}_\n`;
  }
  message += `• Atestado: ${report.teve_atestado ? 'Sim ✅' : 'Não ❌'}\n`;
  message += `• Compensação: ${report.teve_compensacao ? 'Sim ✅' : 'Não ❌'}\n`;
  message += `• Saída antecipada: ${report.teve_saida_antecipada ? 'Sim ✅' : 'Não ❌'}\n\n`;

  message += `*2 - PENDÊNCIAS:* ⚠️\n`;
  message += `${report.descricao_pendencias || 'Não ✅'}\n\n`;

  message += `*3 - OCORRÊNCIAS:* 🛡️\n`;
  message += `${report.descricao_ocorrencias || 'Não ✅'}\n\n`;

  message += `*4 - LOCAÇÕES / ALOCAÇÕES:* 🚜\n`;
  if (report.locacoes && report.locacoes.length > 0) {
    report.locacoes.forEach((l: any) => {
      const empresa = l.empresa || 'Interno';
      message += `• LOCAÇÃO: ${empresa} - ${l.equipamento} (${l.inicio} às ${l.fim})\n`;
    });
  } else {
    message += `Nenhuma locação registrada. ✅\n`;
  }
  message += `\n`;

  message += `*5 - VOOS ATENDIDOS:* ✈️\n`;
  if (report.voos && report.voos.length > 0) {
    report.voos.forEach((v: any) => {
      message += `• *${v.companhia}* (Início: ${v.inicio} | Fim: ${v.fim})\n`;
    });
  } else {
    message += `Nenhum voo registrado. ✅\n`;
  }
  message += `\n`;

  message += `*6 - EQUIPAMENTOS P/ MANUTENÇÃO (GSE):* 🔧\n`;
  if (report.tem_equipamento_enviado && report.gse_enviados && report.gse_enviados.length > 0) {
    report.gse_enviados.forEach((g: any) => {
      message += `• *${g.prefixo}* (Motivo: ${g.motivo || 'Não informado'})\n`;
    });
  } else {
    message += `Nenhuma baixa registrada. ✅\n`;
  }
  message += `\n`;

  message += `*7 - EQUIPAMENTOS QUE RETORNARAM:* ♻️\n`;
  if (report.tem_equipamento_retornado && report.gse_retornados && report.gse_retornados.length > 0) {
    report.gse_retornados.forEach((g: any) => {
      message += `• *${g.prefixo}* retornou ao pátio. ✅\n`;
    });
  } else {
    message += `Nenhum retorno registrado. ✅\n`;
  }
  message += `\n`;

  message += `*8 - TRANSPORTE TRIPULAÇÃO / IMIGRAÇÃO:* 🚐\n`;
  if (report.transporte_tripulacao && report.transporte_tripulacao.length > 0) {
    report.transporte_tripulacao.forEach((t: any) => {
      message += `• Atendimento realizado para: *${t.cia}* ✅\n`;
    });
  } else {
    message += `Nenhum transporte registrado. ✅\n`;
  }
  message += `\n`;

  message += `*9 - BRIEFING / DEBRIEFING:* 📢\n`;
  const temBriefing = report.briefing_inicio || report.briefing_fim;
  const temDebriefing = report.debriefing_inicio || report.debriefing_fim;
  if (temBriefing || temDebriefing) {
    if (temBriefing) {
      message += `• *Briefing:* ${report.briefing_inicio || '--:--'} às ${report.briefing_fim || '--:--'}\n`;
    }
    if (temDebriefing) {
      message += `• *Debriefing:* ${report.debriefing_inicio || '--:--'} às ${report.debriefing_fim || '--:--'}\n`;
    }
  } else {
    message += `Nenhum briefing/debriefing registrado.\n`;
  }

  return message;
};

interface ReportPreviewProps {
  reportPayload: any;
  onBack: () => void;
  onConfirmSend: () => Promise<boolean>;
  isSubmitting: boolean;
}

const ReportPreview: React.FC<ReportPreviewProps> = ({ reportPayload, onBack, onConfirmSend, isSubmitting }) => {
  const message = buildMessage(reportPayload);
  const [copied, setCopied] = useState(false);

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const handleSendWhatsApp = async () => {
    const gravou = await onConfirmSend();
    if (!gravou) return; // banco falhou: nao abre o WhatsApp, o lider tenta de novo

    // A mensagem viaja pela area de transferencia, nunca pela URL: mandar o texto
    // dentro do link (wa.me/?text=) faz o Windows converter os emojis em losango
    // ao repassar pro aplicativo. Colando, o texto chega intacto em qualquer aparelho.
    try { await navigator.clipboard.writeText(message); } catch { /* ignore */ }

    abrirWhatsApp(GROUP_LINK);
  };

  // Plano B: abre o WhatsApp deixando o lider escolher o destino, com a mensagem
  // ja na area de transferencia. Serve quando o grupo nao abre pelo link fixo.
  const handleEscolherDestino = async () => {
    try { await navigator.clipboard.writeText(message); } catch { /* ignore */ }
    abrirWhatsApp('https://wa.me/');
  };

  return (
    <div className="h-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          disabled={isSubmitting}
          className="p-2 rounded-sm bg-slate-100 hover:bg-slate-200 transition-all disabled:opacity-30"
        >
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <div>
          <h2 className="text-lg font-black italic uppercase text-slate-900 tracking-tight">
            PRÉ-<span className="text-blue-600">VISUALIZAÇÃO</span>
          </h2>
          <p className="text-[9px] font-bold text-slate-400 uppercase italic">Confirme os dados antes de enviar</p>
        </div>
      </div>

      {/* Message Preview */}
      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-4 pb-4">
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-sm p-5 shadow-inner">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-black text-emerald-700 uppercase italic tracking-widest">Mensagem WhatsApp</span>
            <button
              onClick={handleCopyMessage}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-sm text-[9px] font-black uppercase italic hover:bg-emerald-700 transition-all"
            >
              {copied ? <><CheckCircle size={12} /> COPIADO</> : <><Copy size={12} /> COPIAR</>}
            </button>
          </div>
          <pre className="whitespace-pre-wrap text-sm text-slate-800 font-medium leading-relaxed break-words" style={{ fontFamily: "'Segoe UI', sans-serif" }}>
            {message}
          </pre>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex-none pt-4 border-t border-slate-200 flex flex-col gap-3">
        <button
          onClick={handleSendWhatsApp}
          disabled={isSubmitting}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm font-black uppercase italic text-sm flex items-center justify-center gap-3 shadow-2xl shadow-emerald-500/30 transition-all active:scale-95 disabled:opacity-30"
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Send size={20} />
              ENVIAR NO WHATSAPP
            </>
          )}
        </button>
        <button
          onClick={onBack}
          disabled={isSubmitting}
          className="w-full py-3 border border-slate-200 text-slate-500 rounded-sm font-black uppercase italic text-xs hover:bg-slate-50 transition-all disabled:opacity-30"
        >
          <ArrowLeft size={14} className="inline mr-2" />
          VOLTAR E EDITAR
        </button>
        <p className="text-center text-[9px] font-bold text-slate-400 uppercase italic leading-relaxed">
          A mensagem é copiada e o grupo abre: é só colar e enviar
        </p>
        <button
          onClick={handleEscolherDestino}
          disabled={isSubmitting}
          className="w-full text-center text-[9px] font-bold text-slate-400 underline underline-offset-2 hover:text-emerald-600 transition-all disabled:opacity-30"
        >
          Se o grupo não abrir, toque aqui e escolha o destino
        </button>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(16, 185, 129, 0.3); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default ReportPreview;
