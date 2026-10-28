// ─── O tema do dia do briefing, entrou em 28/10/2026 ───────────────────────
// Pedido dele, a partir do documento que o Edson mandou: "Programa de Briefing
// da Rampa, 31 temas do MGO" (RAMPA MAO, 10/2026). Até aqui, clicar num
// briefing no painel mostrava a foto e as assinaturas, mas não DO QUE se
// falou. Para auditoria, o assunto tem que estar no registro.
//
// A regra é a do documento, e é uma só: o tema é o do DIA DO MÊS. Dia 1 =
// tema 1, dia 2 = tema 2, e os turnos do mesmo dia dão o mesmo tema. O líder
// lê para a equipe os 3 pontos do dia, em menos de 1 minuto.
//
// 🔑 O dia sai da DATA DO RELATÓRIO, e não do relógio. A madrugada de 02/10
// que fez o briefing às 23:01 de 01/10 dá o tema 2: é a data do registro que
// diz qual tema foi dado, e é ela que o auditor vai olhar.
//
// 🔑 A lista mora AQUI, no código, e não numa tabela do banco. O cartão é lido
// no pátio, onde não tem sinal, e o que vem dentro do app abre sem internet.
// Mudou o MGO, muda este arquivo e sobe versão nova.
//
// 🔴 O QUE VAI PRO BANCO É UMA CÓPIA do tema (título, os 3 pontos, a
// referência e a revisão), e não só o número. Se a revisão do MGO mudar a
// lista, os registros antigos continuam dizendo o que foi dito NAQUELE dia.
// Mesma regra da assinatura, que grava nome e função do dia em vez de ler da
// tabela de funcionários.

export const REVISAO_MGO = 'MN-OPS-#000076, Rev. 03 (04/2026)';

export interface TemaMgo {
  dia: number;
  titulo: string;
  // Item e página do MGO, como o documento escreve.
  mgo: string;
  pontos: [string, string, string];
}

// O que fica gravado em `relatorios_consolidados.briefing_tema`.
export interface TemaGravado {
  dia: number;
  titulo: string;
  mgo: string;
  pontos: string[];
  revisao: string;
  // Quando o líder marcou "li os 3 pontos para a equipe". É a declaração dele,
  // e por isso a hora fica escrita junto.
  confirmado_em: string;
}

// O que o formulário guarda enquanto o turno anda: qual tema foi confirmado e
// quando. Guarda o DIA, e não um sim/não, de propósito: se a data do relatório
// mudar (a madrugada escolhe a data), o tema muda junto e a confirmação velha
// deixa de valer sozinha.
export interface TemaConfirmado {
  dia: number;
  em: string;
}

// Transcrito do PDF em 28/10/2026, dia por dia, e conferido contra o texto do
// próprio arquivo. Os dias 29 a 31 não existem em todo mês, e tudo bem: o mês
// que não tem dia 31 simplesmente não dá o tema 31.
export const TEMAS_MGO: TemaMgo[] = [
  {
    dia: 1, titulo: 'Áreas de perigo dos motores (sucção e jato)',
    mgo: '3.1.2.1–3.1.2.2 · p. 270–271',
    pontos: [
      'Motor ligado ou luz anticolisão acesa: pessoas e equipamentos longe da área de perigo.',
      'Nunca fique na frente do motor (sucção), atrás dele (jato) nem na área da hélice.',
      'A área de perigo pode passar da ERA e aumenta quando a aeronave acelera.',
    ],
  },
  {
    dia: 2, titulo: 'ERA: área de restrição de equipamentos',
    mgo: '3.1.2.3 · p. 272–274',
    pontos: [
      'A ERA é a área pintada onde a aeronave estaciona: livre antes, durante e depois do atendimento.',
      'Dentro dela, só quem e o que está no atendimento (exceção: GPU pré-posicionada).',
      'FOD ou derramamento dentro da ERA: limpar na hora.',
    ],
  },
  {
    dia: 3, titulo: 'FOD: nada solto no pátio',
    mgo: '3.1.2.4 · p. 275–276',
    pontos: [
      'Caminhada de FOD na posição antes da chegada, durante o atendimento e depois da saída.',
      'Viu FOD, recolhe e joga na lixeira, não importa quem deixou.',
      'Nada solto no equipamento nem na carga em cima do veículo.',
    ],
  },
  {
    dia: 4, titulo: 'EPI na rampa',
    mgo: '3.1.2.5 · p. 277 · 3.1.3.1 f · p. 279',
    pontos: [
      'Calçado de segurança, protetor auricular, colete refletivo e luvas quando a tarefa pedir.',
      'Proibido brinco, piercing, pulseira, anel ou cabelo solto na rampa.',
      'Cordão de crachá só com clipe que solta no puxão.',
    ],
  },
  {
    dia: 5, titulo: 'GSE: conferir antes de usar e aproximar da aeronave',
    mgo: '3.1.3.1–3.1.3.2 · p. 278–284',
    pontos: [
      'Checklist antes de usar; com defeito, marcar "Em manutenção" e tirar de operação.',
      'O equipamento não encosta na aeronave: folga mínima de 5 cm.',
      'Tocou ou acha que tocou: avise na hora e não mexa até a inspeção liberar.',
    ],
  },
  {
    dia: 6, titulo: 'GSE: dirigir e estacionar dentro da ERA',
    mgo: '3.1.3.4 · p. 288–290',
    pontos: [
      '3 paradas completas antes de entrar na ERA ou a 5 m da aeronave.',
      'Dentro da ERA, velocidade de pessoa andando (5 km/h).',
      'Visão ruim, só com balizador; perdeu o balizador de vista, pare.',
    ],
  },
  {
    dia: 7, titulo: 'Trator, carretas e dollies',
    mgo: '3.1.3.3 e 3.1.3.10 · p. 284–288, 306–307',
    pontos: [
      'Dolly ou carreta parado: freio do cambão acionado, sapata ou calço.',
      'Engate ao lado da barra, segurando só o cabo e o pino; confira o pino antes de rebocar.',
      'Nunca passe nem fique entre carretas e dollies, mesmo parados.',
    ],
  },
  {
    dia: 8, titulo: 'Esteira (belt loader)',
    mgo: '3.1.3.7 · p. 297–300',
    pontos: [
      'Checklist antes de usar; não mexa na esteira com alguém ou mala em cima.',
      'Proibido subir, andar ou sentar na esteira, e usá-la para levar carga pela rampa.',
      'Encoste e tire em linha reta, sem tocar a aeronave; na saída, plataforma abaixada e ré de 1 m antes da curva.',
    ],
  },
  {
    dia: 9, titulo: 'Loader e plataforma elevatória',
    mgo: '3.1.3.8–3.1.3.9 · p. 301–306',
    pontos: [
      'Plataformas abaixadas para manobrar; aproxime devagar e com balizador se a visão for limitada.',
      'Ninguém entre o loader e o trator nem na plataforma enquanto o ULD se move; limitadores levantados.',
      'Nunca coloque nenhuma parte do corpo na tesoura embaixo da plataforma.',
    ],
  },
  {
    dia: 10, titulo: 'Sinais manuais para guiar o GSE',
    mgo: '3.4.1–3.4.4 · p. 338–350',
    pontos: [
      'Use só os sinais do MGO e só quando não der para falar; confirme que foram entendidos.',
      'Quem sinaliza: colete refletivo, fora do caminho e com contato visual o tempo todo; perdeu o contato, para.',
      'Só guie o GSE depois que a aeronave terminar de ser balizada; à noite, use bastão ou lanterna.',
    ],
  },
  {
    dia: 11, titulo: 'Chegada da aeronave, GPU e ar-condicionado',
    mgo: '4.1.1–4.1.4 · p. 483–503',
    pontos: [
      'Antes da chegada: posição sem FOD; equipe e equipamentos fora da ERA e do trajeto da aeronave.',
      'Ninguém se aproxima antes de motores desligados, luz anticolisão apagada e calços; GSE só encosta após o walkaround.',
      'GPU/ACU: freio, calço e luva vermelha no cambão, solta do trator; só liga depois de conectar e com o OK da cabine.',
    ],
  },
  {
    dia: 12, titulo: 'Calços e cones',
    mgo: '4.2.1 e 4.3 · p. 503–518',
    pontos: [
      'Calço só depois da aeronave parada, motores desligados, luz anticolisão apagada e liberação.',
      'Vá até o trem principal paralelo à fuselagem, longe da entrada do motor; depois avise a tripulação: calços colocados.',
      'Cones a no máximo 1 m da aeronave (motores e pontas das asas); GSE só encosta depois dos cones.',
    ],
  },
  {
    dia: 13, titulo: 'Portas do porão',
    mgo: '4.4.3 · p. 530–535',
    pontos: [
      'Porta do porão só abre com motores e luz anticolisão desligados, aeronave calçada e com cones.',
      'Abrir e fechar com escada técnica ou esteira com corrimão; porta travada, não force: chame a manutenção.',
      'Fechou: indicadores de travamento acionados e manetes alinhados; depois do walkaround da partida, só reabre com OK da tripulação.',
    ],
  },
  {
    dia: 14, titulo: 'Inspeção do porão antes e depois',
    mgo: '4.5.5 · p. 564–566',
    pontos: [
      'Inspecione todos os porões depois de descarregar e antes de carregar, mesmo se vieram vazios.',
      'Procure dano no piso, paredes e portas, trava ou rede faltando, derramamento e carga esquecida.',
      'Achou dano ou derramamento: avise na hora o líder do carregamento.',
    ],
  },
  {
    dia: 15, titulo: 'Carregar pela LIR e avisar o controle de carga',
    mgo: '4.5.1 e 4.5.6.4 · p. 536–553, 569–570',
    pontos: [
      'Sem LIR não se carrega; antes de começar, o líder passa a sequência, as cargas especiais e a amarração.',
      'Carregue conforme a LIR; mudança só com aprovação do controle de carga, avisada à equipe antes de continuar.',
      'Problema (dano, vazamento, carga errada): pare e avise o líder; no fim, confirme travas e redes fechadas.',
    ],
  },
  {
    dia: 16, titulo: 'ULDs: conferir antes de carregar',
    mgo: '4.5.3.2 e 4.5.9.3 · p. 558–560, 591–594',
    pontos: [
      'ULD danificado não se carrega: identifique, etiquete e separe.',
      'Antes de carregar: cortinas e redes fechadas e travadas, sem vazamento, sem sinal de violação.',
      'Empurre, não puxe; fique fora do caminho do ULD em movimento e nunca o deixe direto no chão.',
    ],
  },
  {
    dia: 17, titulo: 'Cargueiro: convés principal e estabilidade no solo',
    mgo: '4.5.2 e 4.5.3.3 · p. 554–555, 560–562',
    pontos: [
      'Cargueiro pode tombar de cauda: descarregue primeiro o porão traseiro e carregue primeiro o dianteiro, se a LIR não disser outra coisa.',
      'Main deck: a rede de segurança só sai com o loader posicionado e volta assim que terminar.',
      'A aeronave sobe e desce até 70 cm na carga e descarga: acompanhe a folga e mantenha o loader nivelado.',
    ],
  },
  {
    dia: 18, titulo: 'Fixação e amarração da carga',
    mgo: '4.5.7 · p. 571–587',
    pontos: [
      'Carga presa para não se mover no voo: barril de líquido, animal vivo, peça de 150 kg ou mais, caixão e DG sempre presos.',
      'ULD travado no piso; com posição vazia no porão, levante as travas que sobraram.',
      'Cinta e corda em bom estado, sem misturar capacidades, presas só nos pontos de amarração.',
    ],
  },
  {
    dia: 19, titulo: 'Artigos perigosos (DG) na rampa',
    mgo: '4.5.10.2, 4.13 e 6.5.4 (DG) · p. 596–597, 679–686, 744',
    pontos: [
      'Volume de DG com dano ou vazamento não embarca; se já embarcou, sai. Vazamento: não toque e avise o líder.',
      'Etiqueta de risco à vista, seta para cima respeitada e volume travado para não mudar de posição.',
      'Etiqueta CAO = só em cargueiro. DG escondido ou mal declarado não embarca e é avisado à área de carga.',
    ],
  },
  {
    dia: 20, titulo: 'Cargas especiais: animal vivo, gelo seco, restos mortais',
    mgo: '4.5.3.1 k e 4.5.10.3–4.5.10.8 · p. 557, 597–604',
    pontos: [
      'Animal vivo: nunca no chão, protegido de sol e chuva, com ventilação livre e o mínimo de espera.',
      'Gelo seco (ICE): abra a porta do porão e espere ventilar antes de entrar: risco de asfixia.',
      'Caixão (HUM): na horizontal e nada em cima; na esteira, a cabeça vai do lado da porta.',
    ],
  },
  {
    dia: 21, titulo: 'Manuseio seguro de bagagem',
    mgo: '2.3 · p. 200–202',
    pontos: [
      'Não levante mais do que aguenta: peça ajuda ou use equipamento; coluna reta e cuidado ao girar o corpo.',
      'Proibido jogar mala ou carregar pela alça ou pelas rodinhas.',
      'Engate o cambão com luva e o pé fora de baixo dele; ninguém entre as carretas antes de mover.',
    ],
  },
  {
    dia: 22, titulo: 'Abastecimento: zona de segurança e derramamento',
    mgo: '3.2 · p. 310–314',
    pontos: [
      'Zona de segurança: 3 m em volta de respiros, bocal, mangueira e caminhão; nela é proibido fumar e estacionar.',
      'Não bloqueie a rota de fuga do caminhão; equipamento a pelo menos 3 m da mangueira e desligado quando parado.',
      'Derramou combustível: avise o abastecedor e o líder, afaste todos e isole 15 m em volta.',
    ],
  },
  {
    dia: 23, titulo: 'Tempestade e raios',
    mgo: '3.3.3 · p. 325–328',
    pontos: [
      'Raio a mais de 8 km = ALERTA: pare o que não é necessário em área aberta e evite celular.',
      'Raio a 5 km = PARADA: libere a rampa, tire o fone da aeronave e vá para prédio ou veículo fechado, nunca debaixo do avião.',
      'Sem aviso, conte do clarão ao trovão: menos de 15 segundos = PARADA. Só o COI libera a volta.',
    ],
  },
  {
    dia: 24, titulo: 'Partida: conferência, barra do pushback e calços',
    mgo: '4.6.3–4.6.5 · p. 613–623',
    pontos: [
      'Walkaround antes da partida: pátio sem FOD, GSE fora, portas e painéis fechados; dano, avise a tripulação e o líder.',
      'Barra só conecta com freio da aeronave acionado e pino de bypass instalado; os dois pés do mesmo lado da barra.',
      'Calço só sai com freio da aeronave confirmado, GSE desconectado e trator preso ao trem de nariz.',
    ],
  },
  {
    dia: 25, titulo: 'Partida: comunicação com a cabine e pushback seguro',
    mgo: '4.6.6–4.6.7 · p. 624–632',
    pontos: [
      'Partida sempre com headset testado; perdeu a comunicação, PARE e só siga com sinais combinados com a cabine.',
      'No push, ninguém debaixo da aeronave, no caminho dela ou do trator, nem perto dos motores; não ande de costas.',
      'Fim do push: só desconecte a barra depois de a cabine confirmar o freio de estacionamento.',
    ],
  },
  {
    dia: 26, titulo: 'Incêndio e emergência: o que fazer e a quem avisar',
    mgo: '3.1.4 e 8.4 · p. 308–310, 757',
    pontos: [
      'Proibido fumar fora da área de fumantes; saiba onde estão o extintor, o alarme e o ponto de encontro.',
      'Vazamento de combustível ou óleo: conter rápido e isolar com cones; fumaça em equipamento: avise na hora.',
      'Emergência: acione o COE/COA do aeroporto e depois a supervisão; fogo em equipamento, extintor só se for seguro.',
    ],
  },
  {
    dia: 27, titulo: 'AVSEC: acesso à aeronave e objeto suspeito',
    mgo: '8.28–8.31.1 · p. 779–782',
    pontos: [
      'Perto da aeronave só fica quem tem função ali; o agente de segurança controla e registra os acessos.',
      'Pessoa estranha perto da aeronave ou do carregamento: avise na hora o líder e a segurança.',
      'Objeto suspeito ou abandonado: não toque, afaste as pessoas, isole e acione o COE/COA ou a polícia.',
    ],
  },
  {
    dia: 28, titulo: 'Reporte de incidente e quase-acidente',
    mgo: '6.5.2 e 6.5.4 (reporte) · p. 742–743, 745',
    pontos: [
      'Incidente ou acidente: pare a atividade, afaste as pessoas e avise na hora o líder e quem foi afetado.',
      'Isole a área e siga as instruções dos serviços de emergência.',
      'Todo incidente, acidente e quase-acidente é reportado no PULSE (aplicativo no celular).',
    ],
  },
  {
    dia: 29, titulo: 'QTU: serviço de dejetos',
    mgo: '3.5 · p. 374–379',
    pontos: [
      'EPI completo: luva nitrílica, máscara PFF2, protetor facial, avental e bota de PVC, protetor auricular.',
      'Mangueira acoplada: o veículo não se move; olhe se há vazamento no painel antes e depois do serviço.',
      'Derramou dejeto: isole a área e avise o líder na hora.',
    ],
  },
  {
    dia: 30, titulo: 'QTA: água potável',
    mgo: '3.6.1.1, 3.6.2 e 3.6.3.3 · p. 400–404, 418',
    pontos: [
      'Mãos lavadas, roupa limpa e EPI; quem fez QTU não faz QTA no mesmo dia.',
      'Higienize o bico da mangueira e a entrada da aeronave antes de conectar; a ponta da mangueira nunca no chão.',
      'QTA e QTU a 30 m um do outro e nunca juntos na aeronave; chegaram juntos, o QTA vai primeiro.',
    ],
  },
  {
    dia: 31, titulo: 'Reboque de aeronaves',
    mgo: '4.9 · p. 651–667',
    pontos: [
      'Antes de rebocar: walkaround, operador de freio ou tripulação na cabine e comunicação testada.',
      'Barra só conecta com freio da aeronave acionado e pino de bypass instalado; primeiro na aeronave, depois no trator.',
      'Reboque na menor velocidade; vazamento, dano ou falha: avise o operador de freio e a manutenção.',
    ],
  },
];

// O tema da data do relatório ('AAAA-MM-DD', o formato do `formDate`).
// Lê o dia direto do texto, sem passar por `Date`: `new Date('2026-10-01')`
// é meia-noite em UTC, que em Manaus ainda é dia 30 de setembro.
export const temaDoDia = (data: string): TemaMgo | null => {
  const dia = Number((data || '').slice(8, 10));
  return TEMAS_MGO.find(t => t.dia === dia) || null;
};

// A confirmação só vale para o tema que está na tela agora.
export const temaConfirmadoValido = (data: string, confirmado: TemaConfirmado | null): boolean => {
  const tema = temaDoDia(data);
  return !!tema && !!confirmado && confirmado.dia === tema.dia;
};

// A cópia que vai pro banco. Null quando o tema não foi confirmado: nesse caso
// o envio nem chega aqui, porque o "Finalizar" segura antes.
export const temaParaGravar = (data: string, confirmado: TemaConfirmado | null): TemaGravado | null => {
  const tema = temaDoDia(data);
  if (!tema || !confirmado || confirmado.dia !== tema.dia) return null;
  return {
    dia: tema.dia,
    titulo: tema.titulo,
    mgo: tema.mgo,
    pontos: [...tema.pontos],
    revisao: REVISAO_MGO,
    confirmado_em: confirmado.em,
  };
};
