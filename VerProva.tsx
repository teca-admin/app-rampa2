import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Presenca, listarPresencas, provaUrl } from './provas';

// ─── A prova aberta no painel ──────────────────────────────────────────────
// Criado em 14/09/2026. Clicar no horário de um briefing ou de um debriefing
// abre isto: a foto dos participantes e a lista de quem assinou.
//
// 🔑 ABRE DENTRO DO SISTEMA, e nunca numa aba nova. Quem está conferindo a
// tabela de briefings não perde o lugar onde estava, e volta fechando.
//
// 📌 Não existe botão de apagar aqui, nem de editar. Prova que o próprio
// sistema desfaz não é prova: corrigir é o líder colher de novo no turno.

export interface ProvaAberta {
  provaId: string;
  foto: string | null;
  titulo: string;   // "Briefing" ou "Debriefing"
  subtitulo: string; // data, turno e líder
  horario: string;
}

const hora = (iso: string): string => {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return '--:--'; }
};

const VerProva: React.FC<{ prova: ProvaAberta; onFechar: () => void }> = ({ prova, onFechar }) => {
  const [presencas, setPresencas] = useState<Presenca[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [fotoAmpliada, setFotoAmpliada] = useState(false);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    listarPresencas(prova.provaId)
      .then(lista => { if (ativo) { setPresencas(lista); setErro(''); } })
      .catch(problema => { if (ativo) setErro(problema?.message || 'Não foi possível ler a lista de presença.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [prova.provaId]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (fotoAmpliada) setFotoAmpliada(false); else onFechar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [fotoAmpliada, onFechar]);

  return (
    <div
      onClick={onFechar}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14, padding: 24, maxWidth: 680, width: '92%',
          maxHeight: '86vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1E293B' }}>
            {prova.titulo} · {prova.horario}
          </span>
          <button
            onClick={onFechar}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', padding: 4 }}
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        <p style={{ margin: '0 0 18px', fontSize: 11, color: '#94A3B8', flexShrink: 0 }}>
          {prova.subtitulo}
        </p>

        <div className="rolagem-fina" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'grid', gap: 20 }}>
          {/* ── A foto ── */}
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Foto dos participantes
            </p>
            {prova.foto ? (
              <img
                src={provaUrl(prova.foto)}
                alt="Participantes"
                onClick={() => setFotoAmpliada(true)}
                style={{
                  width: '100%', maxHeight: 320, objectFit: 'cover',
                  borderRadius: 10, border: '1px solid #E2E8F0', cursor: 'zoom-in', display: 'block',
                }}
              />
            ) : (
              <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>
                Este registro é anterior à foto obrigatória.
              </p>
            )}
          </div>

          {/* ── A lista ── */}
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Lista de presença {presencas.length > 0 && `· ${presencas.length}`}
            </p>

            {carregando ? (
              <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>Buscando as assinaturas...</p>
            ) : erro ? (
              <p style={{ fontSize: 13, color: '#EF4444', margin: 0 }}>{erro}</p>
            ) : presencas.length === 0 ? (
              <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>Nenhuma assinatura neste registro.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr>
                    {['Nome', 'Matrícula', 'Função', 'Hora', 'Assinatura'].map(h => (
                      <th key={h} style={{
                        textAlign: h === 'Assinatura' ? 'center' : 'left', fontSize: 10, color: '#94A3B8',
                        fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px',
                        padding: '6px 8px', borderBottom: '1px solid #E2E8F0',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {presencas.map((p, i) => (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                      <td style={{ fontSize: 12, color: '#1E293B', padding: '6px 8px', fontWeight: 600 }}>{p.nome}</td>
                      <td style={{ fontSize: 12, color: '#64748B', padding: '6px 8px' }}>{p.matricula}</td>
                      <td style={{ fontSize: 11, color: '#94A3B8', padding: '6px 8px' }}>{p.funcao || '—'}</td>
                      <td style={{ fontSize: 12, color: '#64748B', padding: '6px 8px' }}>{hora(p.assinadoEm)}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                        <img
                          src={provaUrl(p.arquivo)}
                          alt={`Assinatura de ${p.nome}`}
                          style={{ height: 34, maxWidth: 150, objectFit: 'contain' }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {presencas.length > 0 && (
              // Quem passou o celular na mão é o único testemunho que existe,
              // então ele fica escrito na prova, e não só no relatório.
              <p style={{ margin: '10px 0 0', fontSize: 11, color: '#94A3B8' }}>
                Assinaturas colhidas por {presencas[0].coletadaPor}.
              </p>
            )}
          </div>
        </div>
      </div>

      {fotoAmpliada && prova.foto && (
        <div
          onClick={e => { e.stopPropagation(); setFotoAmpliada(false); }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1100,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', padding: 24,
          }}
        >
          <img
            src={provaUrl(prova.foto)}
            alt="Participantes"
            style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 10 }}
          />
        </div>
      )}
    </div>
  );
};

export default VerProva;
