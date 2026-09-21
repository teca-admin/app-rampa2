// ─── A prova do briefing e do debriefing ───────────────────────────────────
// Criado em 14/09/2026. A lista de presença assinada e a foto dos participantes,
// presas a cada briefing e a cada debriefing.
//
// ⚠️ O QUE A ASSINATURA PROVA, E O QUE NÃO PROVA. Guarda matrícula, nome, hora
// e o traço desenhado. NÃO prova que foi aquela pessoa: quem testemunha é o
// líder que passou o celular na mão, exatamente como no papel, onde qualquer um
// pode rabiscar por qualquer um. Empata com o papel em prova, e ganha em não se
// perder, em não molhar e em ser encontrável depois.
//
// 🔑 TUDO FICA NO CELULAR ATÉ A CONFIRMAÇÃO DA PRÉVIA. O líder está na rampa,
// com vinte pessoas na frente dele e o sinal que o armazém tem: subir uma
// assinatura de cada vez faria a fila parar toda vez que a rede engasgasse. E
// fica no localStorage, não só na memória, porque o Android mata o app quando o
// líder troca de tela, e perder vinte assinaturas de gente que já foi embora é
// o pior desfecho possível aqui.

import { supabase } from './supabase';

const BALDE = 'ramp-provas';

export type TipoProva = 'briefing' | 'debriefing';

export const rotuloProva = (tipo: TipoProva): string =>
  tipo === 'briefing' ? 'Briefing' : 'Debriefing';

export interface Funcionario {
  matricula: string;
  nome: string;
  funcao: string | null;
  ativo: boolean;
}

// Uma assinatura ainda no celular, antes de subir.
export interface AssinaturaLocal {
  matricula: string;
  nome: string;
  funcao: string | null;
  // PNG em data URL, do jeito que o canvas devolveu, já recortado no traço.
  imagem: string;
  assinadoEm: string;
}

export interface ProvaLocal {
  provaId: string;
  assinaturas: AssinaturaLocal[];
  // JPEG em data URL, já reduzido. Null enquanto o líder não tirou a foto.
  foto: string | null;
  // Preenchido depois que a foto sobe, pra uma segunda tentativa de envio não
  // subir a mesma imagem de novo e deixar arquivo órfão no balde.
  fotoArquivo?: string;
}

// Uma assinatura que já está no banco.
export interface Presenca {
  id: string;
  matricula: string;
  nome: string;
  funcao: string | null;
  arquivo: string;
  assinadoEm: string;
  coletadaPor: string;
}

export const novoId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const provaVazia = (): ProvaLocal => ({
  provaId: novoId(),
  assinaturas: [],
  foto: null,
});

// ─── o que ainda está só no celular ────────────────────────────────────────
//
// Chave própria, fora do rascunho do relatório. O rascunho é salvo a cada
// tecla: carregar uma foto de 200 KB junto faria o formulário engasgar a cada
// letra digitada.

const chave = (tipo: TipoProva) => `rampcontroll:prova:${tipo}`;

export const lerProvaLocal = (tipo: TipoProva): ProvaLocal => {
  try {
    const cru = localStorage.getItem(chave(tipo));
    if (!cru) return provaVazia();
    const p = JSON.parse(cru);
    return p && typeof p === 'object' && p.provaId && Array.isArray(p.assinaturas)
      ? p as ProvaLocal
      : provaVazia();
  } catch { return provaVazia(); }
};

// Devolve false quando não deu pra guardar (espaço estourado, modo restrito).
// Quem chama avisa; a lista continua na memória da tela.
export const gravarProvaLocal = (tipo: TipoProva, prova: ProvaLocal): boolean => {
  try {
    localStorage.setItem(chave(tipo), JSON.stringify(prova));
    return true;
  } catch { return false; }
};

export const limparProvasLocais = (): void => {
  try {
    localStorage.removeItem(chave('briefing'));
    localStorage.removeItem(chave('debriefing'));
  } catch { /* idem */ }
};

// ─── a lista de gente ──────────────────────────────────────────────────────

export const listarFuncionarios = async (): Promise<Funcionario[]> => {
  const { data, error } = await supabase
    .from('funcionarios')
    .select('matricula, nome, funcao, ativo')
    .order('nome', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as Funcionario[];
};

// Tira acento e caixa pra busca não depender de como a pessoa digita: no
// celular, com pressa, ninguém acerta "JOSÉ" com acento.
export const chaveDeBusca = (texto: string): string =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');

// ─── o traço ───────────────────────────────────────────────────────────────

// Corta a imagem na moldura do traço.
//
// 🔑 SEM ISTO A ASSINATURA APARECE MINÚSCULA em todo lugar. O canvas tem o
// tamanho da TELA INTEIRA e a assinatura ocupa uma faixa no meio: guardar a
// imagem inteira é guardar 70% de vazio, e qualquer tela que a exiba encolhe o
// traço pra caber no vazio junto.
export const recortarTraco = (fonte: HTMLCanvasElement): string => {
  const L = fonte.width;
  const A = fonte.height;
  if (!L || !A) return fonte.toDataURL('image/png');

  const ctx = fonte.getContext('2d');
  if (!ctx) return fonte.toDataURL('image/png');

  const { data } = ctx.getImageData(0, 0, L, A);
  let x1 = L, y1 = A, x2 = -1, y2 = -1;

  for (let y = 0; y < A; y++) {
    for (let x = 0; x < L; x++) {
      // Alfa acima de 10 pra ignorar a borda quase transparente do traço.
      if (data[(y * L + x) * 4 + 3] > 10) {
        if (x < x1) x1 = x;
        if (x > x2) x2 = x;
        if (y < y1) y1 = y;
        if (y > y2) y2 = y;
      }
    }
  }

  // Sem traço nenhum devolve a imagem inteira em vez de falhar: quem garante
  // que existe assinatura é a conferência antes de confirmar.
  if (x2 < 0) return fonte.toDataURL('image/png');

  // Uma folga em volta, senão o traço encosta na borda e parece cortado.
  const folga = Math.round(Math.max(L, A) * 0.02);
  x1 = Math.max(0, x1 - folga);
  y1 = Math.max(0, y1 - folga);
  x2 = Math.min(L - 1, x2 + folga);
  y2 = Math.min(A - 1, y2 + folga);

  const corte = document.createElement('canvas');
  corte.width = x2 - x1 + 1;
  corte.height = y2 - y1 + 1;
  corte.getContext('2d')?.drawImage(fonte, x1, y1, corte.width, corte.height, 0, 0, corte.width, corte.height);
  return corte.toDataURL('image/png');
};

// ─── a foto ────────────────────────────────────────────────────────────────

// Reduz no APARELHO, antes de qualquer envio. Uma foto de celular moderno chega
// com 4 a 8 MB, e mandar isso da rampa, no sinal que tem lá, é o que faz o
// envio falhar. Sai daqui com 1280 no maior lado.
//
// 🔑 E ela fica guardada no celular até o fim do turno: em data URL, 8 MB
// estouram o localStorage na hora e a lista de assinaturas ia junto.
const MAX_LADO = 1280;
const QUALIDADE = 0.65;

export const reduzirFoto = (arquivo: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const endereco = URL.createObjectURL(arquivo);
    const imagem = new Image();

    imagem.onload = () => {
      try {
        const escala = Math.min(1, MAX_LADO / Math.max(imagem.naturalWidth, imagem.naturalHeight));
        const tela = document.createElement('canvas');
        tela.width = Math.max(1, Math.round(imagem.naturalWidth * escala));
        tela.height = Math.max(1, Math.round(imagem.naturalHeight * escala));
        const ctx = tela.getContext('2d')!;
        // Fundo branco antes de desenhar: JPEG não tem transparência, e imagem
        // transparente (um PNG escolhido da galeria) sairia com o fundo PRETO.
        // Foto de câmera não tem esse problema, mas a galeria do celular tem.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, tela.width, tela.height);
        ctx.drawImage(imagem, 0, 0, tela.width, tela.height);
        const saida = tela.toDataURL('image/jpeg', QUALIDADE);
        // Zerar a tela devolve a memória dela na hora, sem esperar o coletor.
        tela.width = 0;
        tela.height = 0;
        resolve(saida);
      } catch (problema) {
        reject(problema as Error);
      } finally {
        URL.revokeObjectURL(endereco);
      }
    };

    imagem.onerror = () => {
      URL.revokeObjectURL(endereco);
      reject(new Error('Não foi possível ler essa imagem.'));
    };

    imagem.src = endereco;
  });

// ─── o envio ───────────────────────────────────────────────────────────────

// Data URL vira Blob sem passar por servidor nenhum.
const comoBlob = (dataUrl: string): Blob => {
  const [cabecalho, base64] = dataUrl.split(',');
  const tipo = /:(.*?);/.exec(cabecalho)?.[1] || 'image/png';
  const bytes = atob(base64);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
  return new Blob([buffer], { type: tipo });
};

export interface ResultadoDoEnvio {
  // O caminho da foto no balde, pra gravar no relatório.
  fotoArquivo: string | null;
  enviadas: number;
  // Quem não subiu continua no celular pra tentar de novo.
  faltando: AssinaturaLocal[];
  erro?: string;
}

// Sobe a prova inteira, no momento da confirmação da prévia.
//
// 🔑 UMA POR VEZ, E CADA UMA COMPLETA ANTES DA PRÓXIMA. Se a quinta falhar, as
// quatro anteriores já estão gravadas e só as que faltam voltam pro celular.
// Subir tudo num lote só faria uma falha no meio desfazer o que já tinha dado
// certo, e o líder teria que recolher vinte assinaturas de novo.
export const enviarProva = async (
  tipo: TipoProva,
  prova: ProvaLocal,
  coletadaPor: string,
): Promise<ResultadoDoEnvio> => {
  const faltando: AssinaturaLocal[] = [];
  let enviadas = 0;
  let erro: string | undefined;
  let fotoArquivo = prova.fotoArquivo || null;

  // A foto primeiro: é uma só, é a mais pesada e é a que mais falha. Falhando,
  // nem começa a fila de assinaturas, que levaria minutos pra falhar igual.
  if (prova.foto && !fotoArquivo) {
    const caminho = `fotos/${prova.provaId}-${novoId()}.jpg`;
    try {
      // ⚠️ O try/catch NÃO é decoração. Sem rede o `fetch` de dentro do
      // Supabase ESTOURA em vez de devolver erro, e a exceção subia até a tela
      // e virava "Failed to fetch" na cara do líder, em inglês e sem dizer o
      // que fazer. Aqui ela vira uma falha comum de envio, e quem chama explica
      // que está tudo guardado no aparelho.
      const { error } = await supabase.storage
        .from(BALDE)
        .upload(caminho, comoBlob(prova.foto), { contentType: 'image/jpeg', upsert: false });
      if (error) throw new Error(error.message);
      fotoArquivo = caminho;
    } catch (problema: any) {
      return {
        fotoArquivo: null,
        enviadas: 0,
        faltando: prova.assinaturas,
        erro: problema?.message || 'Falha ao enviar a foto',
      };
    }
  }

  for (const item of prova.assinaturas) {
    try {
      const caminho = `assinaturas/${prova.provaId}/${item.matricula}-${novoId()}.png`;

      const { error: erroUpload } = await supabase.storage
        .from(BALDE)
        .upload(caminho, comoBlob(item.imagem), { contentType: 'image/png', upsert: false });
      if (erroUpload) throw new Error(erroUpload.message);

      const { error: erroLinha } = await supabase.from('presencas').insert({
        id: novoId(),
        prova_id: prova.provaId,
        matricula: item.matricula,
        nome: item.nome,
        funcao: item.funcao,
        arquivo: caminho,
        assinado_em: item.assinadoEm,
        coletada_por: coletadaPor,
      });

      // 23505 é a trava de "esta pessoa já assinou esta lista". Chegar aqui
      // quer dizer que a assinatura já subiu numa tentativa anterior, então é
      // sucesso, e não erro: repetir o envio não pode travar o líder.
      if (erroLinha && erroLinha.code !== '23505') throw new Error(erroLinha.message);

      enviadas++;
    } catch (problema: any) {
      faltando.push(item);
      erro = problema?.message || 'Falha ao enviar assinatura';
    }
  }

  return { fotoArquivo, enviadas, faltando, erro };
};

// ─── a leitura, no painel ──────────────────────────────────────────────────

export const provaUrl = (arquivo: string): string =>
  supabase.storage.from(BALDE).getPublicUrl(arquivo).data.publicUrl;

export const listarPresencas = async (provaId: string): Promise<Presenca[]> => {
  const { data, error } = await supabase
    .from('presencas')
    .select('*')
    .eq('prova_id', provaId)
    .order('assinado_em', { ascending: true });
  if (error) throw new Error(error.message);

  return (data || []).map((l: any) => ({
    id: l.id,
    matricula: l.matricula,
    nome: l.nome,
    funcao: l.funcao,
    arquivo: l.arquivo,
    assinadoEm: l.assinado_em,
    coletadaPor: l.coletada_por,
  }));
};
