import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, PenLine, Search, Trash2, UserPlus, X } from 'lucide-react';
import { useToast } from './CustomToast';
import {
  AssinaturaLocal, Funcionario, ProvaLocal, TipoProva,
  chaveDeBusca, listarFuncionarios, recortarTraco, reduzirFoto, rotuloProva,
} from './provas';
import { lerLocal, salvarLocal } from './armazenamentoLocal';

// ─── A coleta da prova, no celular do líder ────────────────────────────────
// Criado em 14/09/2026. Abre pelo botão embaixo do briefing ou do debriefing e
// faz duas coisas: a foto dos participantes e a lista de presença assinada.
//
// 🔑 NADA AQUI SOBE NA HORA. Tudo fica no aparelho até a confirmação da prévia,
// pelo mesmo motivo do rascunho: o líder está na rampa, com gente na frente
// dele, e o sinal do armazém não aguenta uma subida a cada assinatura.
//
// 📌 Tela branca de propósito, e não o escuro do formulário: esta é a única
// tela do app usada de pé, no pátio, com sol na cara.

interface Props {
  tipo: TipoProva;
  prova: ProvaLocal;
  onChange: (prova: ProvaLocal) => void;
  onFechar: () => void;
}

const hora = (iso: string): string => {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return '--:--'; }
};

const ColetaProva: React.FC<Props> = ({ tipo, prova, onChange, onFechar }) => {
  const { toast } = useToast();
  const [escolhendo, setEscolhendo] = useState(false);
  const [assinando, setAssinando] = useState<Funcionario | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const entradaFoto = useRef<HTMLInputElement>(null);

  const jaAssinou = (matricula: string) =>
    prova.assinaturas.some(a => a.matricula === matricula);

  const guardar = (assinatura: AssinaturaLocal) => {
    onChange({ ...prova, assinaturas: [...prova.assinaturas, assinatura] });
  };

  const remover = (matricula: string) => {
    onChange({ ...prova, assinaturas: prova.assinaturas.filter(a => a.matricula !== matricula) });
  };

  const aoEscolherFoto = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setOcupado(true);
    try {
      const reduzida = await reduzirFoto(arquivo);
      // A foto trocada perde o caminho do envio anterior: se a antiga já tinha
      // subido, a nova precisa subir também, senão o painel mostraria a velha.
      onChange({ ...prova, foto: reduzida, fotoArquivo: undefined });
    } catch (problema: any) {
      toast(problema?.message || 'Não foi possível usar essa foto.', 'error');
    } finally {
      setOcupado(false);
      if (entradaFoto.current) entradaFoto.current.value = '';
    }
  };

  if (escolhendo) {
    return (
      <EscolherFuncionario
        onVoltar={() => setEscolhendo(false)}
        onEscolher={f => {
          setEscolhendo(false);
          if (jaAssinou(f.matricula)) {
            toast(`${f.nome} já está na lista.`, 'warning');
            return;
          }
          setAssinando(f);
        }}
      />
    );
  }

  if (assinando) {
    return (
      <TelaDeAssinatura
        funcionario={assinando}
        onCancelar={() => setAssinando(null)}
        onAssinou={imagem => {
          guardar({
            matricula: assinando.matricula,
            nome: assinando.nome,
            funcao: assinando.funcao,
            imagem,
            assinadoEm: new Date().toISOString(),
          });
          setAssinando(null);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[9997] bg-white flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
        <div>
          <h3 className="text-sm font-black italic uppercase text-slate-900 leading-none">
            Prova do {rotuloProva(tipo)}
          </h3>
          <p className="text-[10px] text-slate-500 font-medium mt-1">
            Foto dos participantes e lista de presença
          </p>
        </div>
        <button onClick={onFechar} className="p-2 text-slate-400 hover:text-slate-700" title="Fechar">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* ── A foto ── */}
        <div>
          <p className="text-[10px] font-black uppercase italic text-slate-500 tracking-widest mb-2">
            Foto dos participantes
          </p>

          <input
            ref={entradaFoto}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => aoEscolherFoto(e.target.files?.[0])}
          />

          {prova.foto ? (
            <div className="space-y-2">
              <img src={prova.foto} alt="Participantes" className="w-full rounded-sm border border-slate-200" />
              <button
                onClick={() => entradaFoto.current?.click()}
                disabled={ocupado}
                className="w-full py-2.5 border border-slate-300 rounded-sm font-black uppercase italic text-[11px] text-slate-600 disabled:opacity-50"
              >
                {ocupado ? 'Preparando...' : 'Trocar a foto'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => entradaFoto.current?.click()}
              disabled={ocupado}
              className="w-full py-8 border-2 border-dashed border-slate-300 rounded-sm flex flex-col items-center gap-2 text-slate-500 disabled:opacity-50"
            >
              <Camera size={26} />
              <span className="font-black uppercase italic text-[11px]">
                {ocupado ? 'Preparando a foto...' : 'Tirar foto'}
              </span>
            </button>
          )}
        </div>

        {/* ── A lista ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black uppercase italic text-slate-500 tracking-widest">
              Lista de presença
            </p>
            <span className="text-[10px] font-black text-slate-400">
              {prova.assinaturas.length} {prova.assinaturas.length === 1 ? 'assinatura' : 'assinaturas'}
            </span>
          </div>

          {prova.assinaturas.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6 border border-slate-200 rounded-sm">
              Ninguém assinou ainda.
            </p>
          ) : (
            <ul className="space-y-2">
              {prova.assinaturas.map(a => (
                <li key={a.matricula} className="border border-slate-200 rounded-sm p-3 flex items-center gap-3">
                  <img src={a.imagem} alt={`Assinatura de ${a.nome}`} className="h-10 w-24 object-contain shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-slate-800 truncate">{a.nome}</p>
                    <p className="text-[10px] text-slate-500">
                      {a.matricula} · {hora(a.assinadoEm)}
                    </p>
                  </div>
                  <button
                    onClick={() => remover(a.matricula)}
                    className="p-2 text-slate-300 hover:text-red-500 shrink-0"
                    title="Tirar da lista"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-slate-200 shrink-0 space-y-2">
        <button
          onClick={() => setEscolhendo(true)}
          className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-sm font-black uppercase italic text-xs shadow-lg flex items-center justify-center gap-2"
        >
          <UserPlus size={15} /> Adicionar assinatura
        </button>
        <button
          onClick={onFechar}
          className="w-full py-3 border border-slate-300 rounded-sm font-black uppercase italic text-xs text-slate-600"
        >
          Pronto
        </button>
      </div>
    </div>
  );
};

// ─── Quem vai assinar ──────────────────────────────────────────────────────
//
// 🔑 A lista fica guardada no aparelho junto com a frota e os líderes. Sem
// isso, o líder sem sinal abre a coleta e não tem NINGUÉM pra escolher, que é
// o mesmo buraco que o offline de 10/09 fechou pro resto do formulário.

const EscolherFuncionario: React.FC<{
  onVoltar: () => void;
  onEscolher: (f: Funcionario) => void;
}> = ({ onVoltar, onEscolher }) => {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>(() => lerLocal<Funcionario[]>('funcionarios', []));
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    let ativo = true;
    listarFuncionarios()
      .then(lista => {
        if (!ativo) return;
        if (lista.length) {
          setFuncionarios(lista);
          salvarLocal('funcionarios', lista);
        }
        setErro('');
      })
      .catch(problema => {
        if (!ativo) return;
        // Sem rede, a lista guardada no aparelho resolve. Só é erro quando não
        // há nem uma coisa nem outra.
        setErro(problema?.message || 'Não foi possível buscar a lista.');
      })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);

  const lista = useMemo(() => {
    const texto = chaveDeBusca(busca.trim());
    return funcionarios
      .filter(f => f.ativo !== false)
      .filter(f => !texto || chaveDeBusca(f.nome).includes(texto) || f.matricula.includes(texto))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [funcionarios, busca]);

  return (
    <div className="fixed inset-0 z-[9997] bg-white flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
        <h3 className="text-sm font-black italic uppercase text-slate-900">Quem vai assinar?</h3>
        <button onClick={onVoltar} className="p-2 text-slate-400 hover:text-slate-700" title="Voltar">
          <X size={20} />
        </button>
      </div>

      <div className="px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome ou matrícula"
            autoCapitalize="off"
            className="w-full bg-slate-50 border border-slate-200 rounded-sm py-2.5 pl-9 pr-3 text-sm text-slate-800"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {carregando && funcionarios.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8">Buscando a lista...</p>
        ) : funcionarios.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-8">
            {erro || 'Nenhum funcionário cadastrado.'}
          </p>
        ) : (
          <>
            <p className="text-[10px] text-slate-400 font-black uppercase mb-2">
              {lista.length} {lista.length === 1 ? 'pessoa' : 'pessoas'}
            </p>
            {lista.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">Ninguém com esse nome ou matrícula.</p>
            )}
            <div className="space-y-2">
              {lista.map(f => (
                <button
                  key={f.matricula}
                  onClick={() => onEscolher(f)}
                  className="w-full border border-slate-200 rounded-sm p-3 text-left active:scale-[0.99] transition-transform"
                >
                  <p className="text-[13px] font-bold text-slate-800">{f.nome}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {f.matricula}{f.funcao ? ` · ${f.funcao}` : ''}
                  </p>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── A assinatura ──────────────────────────────────────────────────────────
//
// 🔑 O canvas GIRA no celular em pé. Assinatura é um gesto no comprimento do
// braço: numa faixa estreita em retrato, o traço sai espremido e não parece a
// assinatura da pessoa. Copiado do Radar, que já passou por isso.

const TelaDeAssinatura: React.FC<{
  funcionario: Funcionario;
  onCancelar: () => void;
  onAssinou: (imagem: string) => void;
}> = ({ funcionario, onCancelar, onAssinou }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dims = useRef<{ W: number; H: number } | null>(null);
  // 🔑 REF, e não estado. O dedo já está a meio traço quando o React
  // re-renderiza, e com estado os primeiros movimentos depois do toque caem no
  // valor velho e não desenham: a assinatura sai com o começo comido.
  const desenhando = useRef(false);
  const [erro, setErro] = useState('');

  if (!dims.current) {
    const retrato = window.innerHeight > window.innerWidth;
    dims.current = retrato
      ? { W: window.innerHeight, H: window.innerWidth }
      : { W: window.innerWidth, H: window.innerHeight };
  }
  const { W, H } = dims.current;
  const girado = window.innerHeight > window.innerWidth;

  // Toque na tela vira ponto no canvas girado.
  const paraCanvas = (clientX: number, clientY: number) =>
    girado ? { x: clientY, y: H - clientX } : { x: clientX, y: clientY };

  const comecar = (x: number, y: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    desenhando.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const tracar = (x: number, y: number) => {
    if (!desenhando.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const limpar = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setErro('');
  };

  // Algum pixel não transparente? É o que impede gravar assinatura em branco.
  const temTraco = (canvas: HTMLCanvasElement): boolean => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return true;
    return false;
  };

  const confirmar = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!temTraco(canvas)) {
      setErro('Assine no campo antes de confirmar.');
      return;
    }
    onAssinou(recortarTraco(canvas));
  };

  const giro = girado ? 'translate(-50%,-50%) rotate(90deg)' : 'translate(-50%,-50%)';
  const botao: React.CSSProperties = {
    flex: 1, border: '1px solid #e2e8f0', color: '#64748b', padding: 12,
    borderRadius: 2, fontSize: 12, fontWeight: 800, background: '#fff',
    textTransform: 'uppercase', fontStyle: 'italic',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 9999, overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{
          position: 'absolute', top: '50%', left: '50%',
          width: `${W}px`, height: `${H}px`, transform: giro,
          touchAction: 'none', background: '#fff',
        }}
        onMouseDown={e => { const p = paraCanvas(e.clientX, e.clientY); comecar(p.x, p.y); }}
        onMouseMove={e => { const p = paraCanvas(e.clientX, e.clientY); tracar(p.x, p.y); }}
        onMouseUp={() => { desenhando.current = false; }}
        onMouseLeave={() => { desenhando.current = false; }}
        onTouchStart={e => { e.preventDefault(); const t = e.touches[0]; const p = paraCanvas(t.clientX, t.clientY); comecar(p.x, p.y); }}
        onTouchMove={e => { e.preventDefault(); const t = e.touches[0]; const p = paraCanvas(t.clientX, t.clientY); tracar(p.x, p.y); }}
        onTouchEnd={() => { desenhando.current = false; }}
      />

      {/* A moldura acompanha o giro do canvas, e só os botões recebem toque:
          o resto é área de assinatura. */}
      <div
        style={{
          position: 'absolute', top: '50%', left: '50%',
          width: `${W}px`, height: `${H}px`, transform: giro,
          pointerEvents: 'none', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', padding: 18,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: 0 }}>{funcionario.nome}</p>
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
            {funcionario.matricula} · assine no comprimento da tela
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'auto' }}>
          {erro && <p style={{ color: '#ef4444', fontSize: 12, textAlign: 'center', margin: 0 }}>{erro}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onCancelar} style={botao}>Cancelar</button>
            <button onClick={limpar} style={botao}>Refazer</button>
            <button
              onClick={confirmar}
              style={{ ...botao, background: '#7c3aed', color: '#fff', border: 'none' }}
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── O botão que fica embaixo do par de horários ───────────────────────────

export const BotaoProva: React.FC<{
  tipo: TipoProva;
  prova: ProvaLocal;
  onAbrir: () => void;
}> = ({ tipo, prova, onAbrir }) => {
  const assinaturas = prova.assinaturas.length;
  const completa = assinaturas > 0 && !!prova.foto;

  return (
    <button
      onClick={onAbrir}
      className={`w-full py-2.5 px-2 border rounded-sm flex flex-col items-center gap-1 transition-all ${
        completa
          ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-400'
          : 'bg-amber-500/10 border-amber-500/50 text-amber-400'
      }`}
    >
      <span className="flex items-center gap-1.5">
        {completa ? <Check size={12} /> : <PenLine size={12} />}
        <span className="text-[8px] font-black uppercase italic leading-none">
          {completa ? 'Prova pronta' : 'Prova pendente'}
        </span>
      </span>
      <span className="text-[8px] font-bold leading-none opacity-80">
        {prova.foto ? '1 foto' : 'sem foto'} · {assinaturas} {assinaturas === 1 ? 'assinatura' : 'assinaturas'}
      </span>
    </button>
  );
};

export default ColetaProva;
