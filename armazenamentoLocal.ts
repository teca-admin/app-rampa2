// ─── O que o app guarda no próprio celular ─────────────────────────────────
// Criado em 10/09/2026 junto com o offline. São duas coisas diferentes:
//
// 1. O ESPELHO das listas do banco (frota, líderes, companhias). Sem isso, o
//    líder abre o app sem internet e não tem nem o próprio nome pra escolher:
//    o formulário existe e não dá pra preencher nada.
//
// 2. O RASCUNHO do relatório em andamento, que é o pedido de verdade. Ele
//    passou a ser salvo a cada tecla, pra o líder ir preenchendo ao longo do
//    turno e o app poder fechar, cair ou o celular reiniciar sem perder nada.
//
// 🔴 NADA AQUI SUBSTITUI O ENVIO. O que grava no banco continua sendo o envio
// pelo WhatsApp, com internet. Isto é papel de rascunho, não é fila de envio:
// relatório que só existe no celular do líder não existe para a operação.
//
// ⚠️ Toda leitura e escrita está dentro de try/catch de propósito. Em aba
// anônima, com armazenamento cheio ou com o site bloqueado nas configurações,
// o próprio acesso ao localStorage ESTOURA, e um erro aqui derrubaria o app
// inteiro por causa de um rascunho.

const PREFIXO = 'rampcontroll:';
const CHAVE_RASCUNHO = `${PREFIXO}rascunho`;

export const salvarLocal = (chave: string, valor: any): void => {
  try {
    localStorage.setItem(`${PREFIXO}${chave}`, JSON.stringify(valor));
  } catch { /* sem espaço ou sem permissão: seguir sem guardar */ }
};

export const lerLocal = <T,>(chave: string, padrao: T): T => {
  try {
    const cru = localStorage.getItem(`${PREFIXO}${chave}`);
    if (!cru) return padrao;
    const v = JSON.parse(cru);
    return (v ?? padrao) as T;
  } catch { return padrao; }
};

export interface Rascunho {
  salvoEm: string;      // ISO, pra tela dizer de quando é
  data: string;
  turno: string;
  lider: string;
  campos: Record<string, any>;
}

export const salvarRascunho = (rascunho: Rascunho): void => {
  try {
    localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(rascunho));
  } catch { /* idem */ }
};

export const lerRascunho = (): Rascunho | null => {
  try {
    const cru = localStorage.getItem(CHAVE_RASCUNHO);
    if (!cru) return null;
    const r = JSON.parse(cru);
    // 🔑 Rascunho sem `campos` é lixo de uma versão anterior do app. Devolver
    // isso faria o formulário restaurar `undefined` por cima de estado bom.
    return r && typeof r === 'object' && r.campos ? r as Rascunho : null;
  } catch { return null; }
};

export const apagarRascunho = (): void => {
  try { localStorage.removeItem(CHAVE_RASCUNHO); } catch { /* idem */ }
};

// 🔑 Um rascunho só serve enquanto o turno dele faz sentido. Depois de dois
// dias é quase certo que ficou esquecido, e restaurar dado velho por cima de
// um turno novo é pior que não restaurar nada.
export const rascunhoVelho = (r: Rascunho): boolean => {
  const salvo = new Date(r.salvoEm).getTime();
  if (!isFinite(salvo)) return true;
  return Date.now() - salvo > 48 * 60 * 60 * 1000;
};
