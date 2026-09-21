-- ─── Prova do briefing e do debriefing: lista de presença assinada + foto ────
-- Criado em 14/09/2026, a pedido dele: "para enviar a informação de briefing e
-- de debriefing, o líder envia lista de presença de quem estava presente e uma
-- foto dos participantes, e esse registro fica atrelado a cada input".
--
-- O modelo é o mesmo do Radar (o líder busca a pessoa e ela assina na tela do
-- celular), com UMA diferença que muda tudo: no Radar a lista de gente vem do
-- sistema de Escala, que o RampControll não tem. Por isso a tabela de
-- funcionários nasce AQUI, com a relação que ele mandou em 14/09.
--
-- ⚠️ O QUE A ASSINATURA PROVA, E O QUE NÃO PROVA. Guarda matrícula, nome, hora
-- e o traço desenhado. NÃO prova que foi aquela pessoa: quem testemunha é o
-- líder que passou o celular na mão, exatamente como no papel, onde qualquer um
-- pode rabiscar por qualquer um. Empata com o papel em prova, e ganha em não se
-- perder, em não molhar e em ser encontrável depois.
--
-- 🔴 RODAR ANTES DE SUBIR A VERSÃO NOVA DO APP. Sem as colunas novas, o insert
-- do relatório manda campo que a tabela não tem e o PostgREST RECUSA A GRAVAÇÃO
-- INTEIRA. Quem perde é o líder, que fica sem entregar o turno. Mesma armadilha
-- do Km do SPIN e do OBS.
--
-- ⚠️ Este banco é o MESMO de desenvolvimento e de produção. Rodar isto muda a
-- produção na hora. Tudo o que nasce aqui é novo e nulável: nenhum relatório
-- que já existe se altera, e os antigos seguem válidos, sem prova.
--
-- COMO RODAR: Supabase > SQL Editor > cole tudo > Run.


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Os funcionários
--
-- 🔑 É a lista de QUEM PODE ASSINAR, e só isso. Não é login, não é escala e não
-- substitui a tabela `lideres`, que continua sendo quem entrega turno.
--
-- A matrícula é a chave porque é o que a empresa usa para identificar pessoa, e
-- é o que vai ficar gravado na assinatura: nome muda (casamento, correção de
-- cadastro), matrícula não.
--
-- 📌 `ativo` existe para quem sai da empresa: desmarcar tira a pessoa da busca
-- do líder SEM apagar as assinaturas que ela já deu, que continuam valendo como
-- prova do dia em que foram colhidas.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists "ramp-control".funcionarios (
  matricula   text primary key,
  nome        text not null,
  funcao      text,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

alter table "ramp-control".funcionarios disable row level security;

-- A relação que ele mandou em 14/09/2026: 34 pessoas. O CPF saiu em 14/09 (ver
-- `funcionarios_escala.sql`, que também traz os outros 51 da escala da rampa).
-- `on conflict do nothing` de propósito: rodar este arquivo duas vezes não pode
-- desfazer correção de cadastro feita no banco depois.
insert into "ramp-control".funcionarios (matricula, nome, funcao) values
  ('31896', 'ADERBAL SANTIAGO DE LIMA',          'OPERADOR DE EQUIPAMENTOS I/RAMPA'),
  ('24384', 'ALEXANDRE PASSOS BEZERRA',          'OPERADOR DE EQUIPAMENTOS I/RAMPA'),
  ('17955', 'ANTONIO CESAR SARAIVA ROSA',        'CONDUTOR DE ONIBUS/RAMPA'),
  ('23725', 'ARMANDO ALEXANDRE DOS SANTOS',      'OPERADOR DE EQUIPAMENTOS I/RAMPA'),
  ('37587', 'BRUNO ANDRE DE OLIVEIRA PEREIRA',   'OPERADOR DE EQUIPAMENTOS I/RAMPA'),
  ('19592', 'CLEMILTON ROSAS DE SOUZA',          'CONDUTOR DE ONIBUS/RAMPA'),
  ('27555', 'DARLON SIQUEIRA BRAGA',             'OPERADOR DE EQUIPAMENTOS I/RAMPA'),
  ('30860', 'DEYKSON DA SILVA FARIAS',           'OPERADOR DE EQUIPAMENTOS I/RAMPA'),
  ('17957', 'EDEN ARAUJO BATISTA',               'CONDUTOR DE ONIBUS/RAMPA'),
  ('19728', 'ED WILSON PESSOA LIMA',             'OPERADOR DE EQUIPAMENTOS I/RAMPA'),
  ('96786', 'ELIAS NASCIMENTO DE OLIVEIRA',      'OPERADOR DE EQUIPAMENTOS I/RAMPA'),
  ('17958', 'EMANUEL BARBOSA DE SOUZA',          'CONDUTOR DE ONIBUS/RAMPA'),
  ('17959', 'ENEILTON COSTA RODRIGUES',          'CONDUTOR DE ONIBUS/RAMPA'),
  ('17960', 'EWERTON JOSE COSTA DE ALENCAR',     'CONDUTOR DE ONIBUS/RAMPA'),
  ('13744', 'FABIO CUNHA DE OLIVEIRA',           'OPERADOR DE EQUIPAMENTOS I/RAMPA'),
  ('13745', 'FRANCINEY JACQUIMINOUTH FERREIRA',  'OPERADOR DE EQUIPAMENTOS I/RAMPA'),
  ('96788', 'FRANCISCO DE OLIVEIRA SILVA',       'OPERADOR DE EQUIPAMENTOS I/RAMPA'),
  ('27561', 'FRANCISCO EDJECSON MONTEIRO BRAGA', 'OPERADOR DE EQUIPAMENTOS I/RAMPA'),
  ('32142', 'GIL MARCOS ALBUQUERQUE FIDELES',    'CONDUTOR DE ONIBUS/RAMPA'),
  ('35736', 'HAROLDO SIQUEIRA MACHADO',          'CONDUTOR DE ONIBUS/RAMPA'),
  ('17963', 'JOAO ENES MAIA',                    'CONDUTOR DE ONIBUS/RAMPA'),
  ('10912', 'JOEL DA SILVA DOS SANTOS',          'LIDER DE RAMPA I'),
  ('93466', 'JORGE TADEU DA SILVA',              'OPERADOR DE EQUIPAMENTOS I/RAMPA'),
  ('31897', 'JOSE DANIEL DOS SANTOS LIVRAMENTO', 'CONDUTOR DE ONIBUS/RAMPA'),
  ('93470', 'JOSE EDUARDO MENDES NUNES',         'OPERADOR DE EQUIPAMENTOS I/RAMPA'),
  ('26259', 'JOSE FRANCISCO ALVES DA COSTA',     'OPERADOR DE EQUIPAMENTOS'),
  ('13224', 'JOSE INALDO NOGUEIRA FERREIRA',     'OPERADOR DE EQUIPAMENTOS I/RAMPA'),
  ('19594', 'LUIS CORREA DE FREITAS',            'CONDUTOR DE ONIBUS/RAMPA'),
  ('32449', 'MARK DAVID MONTENEGRO E SOUZA',     'LIDER DE RAMPA I'),
  ('99876', 'MAURO SERGIO OLIVEIRA DE SENA',     'LIDER DE RAMPA I'),
  ('93479', 'NILTON DE SOUZA BARBOSA',           'LIDER DE RAMPA'),
  ('17966', 'ONILTON BRELAZ PEREIRA',            'CONDUTOR DE ONIBUS/RAMPA'),
  ('98166', 'RAUL SARAIVA MONTEIRO',             'LIDER DE RAMPA I'),
  ('30861', 'REINALDO SERRAO DE CARVALHO',       'OPERADOR DE EQUIPAMENTOS I/RAMPA')
on conflict (matricula) do nothing;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. As assinaturas
--
-- 📌 A assinatura pertence à PROVA, e não ao relatório: briefing e debriefing
-- são duas listas diferentes, do mesmo turno, com gente que pode não ser a
-- mesma (quem entrou depois não estava no briefing).
--
-- 🔑 A `prova_id` nasce NO CELULAR, no momento em que o líder abre a lista, e
-- não no banco. Tem que ser assim porque o relatório só é gravado lá no fim,
-- na confirmação da prévia, e as assinaturas são colhidas durante o turno
-- inteiro: esperar o relatório existir seria esperar todo mundo já ter ido
-- embora. O relatório guarda essa id nas colunas do item 3.
--
-- 🔑 Nome e função ficam GRAVADOS na assinatura, e não são lidos da tabela de
-- funcionários na hora de exibir. É o mesmo motivo do preço da locação: a prova
-- tem que dizer o que valia NO DIA. Se a pessoa mudar de função depois, a lista
-- de março continua mostrando a função de março.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists "ramp-control".presencas (
  id            text primary key,
  prova_id      text not null,

  matricula     text not null,
  nome          text not null,
  funcao        text,

  -- O caminho do PNG do traço dentro do balde `ramp-provas`.
  arquivo       text not null,

  assinado_em   timestamptz not null default now(),
  -- Quem estava com o celular na mão. É o único testemunho que existe.
  coletada_por  text not null
);

alter table "ramp-control".presencas disable row level security;

-- A mesma pessoa não assina duas vezes a mesma lista. Sem isto, passar o
-- celular duas vezes para alguém distraído inflaria a presença.
create unique index if not exists presencas_por_pessoa
  on "ramp-control".presencas (prova_id, matricula);

create index if not exists presencas_prova_idx
  on "ramp-control".presencas (prova_id, assinado_em);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. A prova no relatório
--
-- Quatro colunas nuláveis. Nulo quer dizer "turno entregue sem prova", que é o
-- estado de TODOS os relatórios que já existem e continua sendo estado legítimo
-- para briefing que não aconteceu.
-- ─────────────────────────────────────────────────────────────────────────────
alter table "ramp-control".relatorios_consolidados
  add column if not exists briefing_prova_id text,
  add column if not exists briefing_foto text,
  add column if not exists debriefing_prova_id text,
  add column if not exists debriefing_foto text;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. O balde das imagens
--
-- 🔴 TEM QUE NASCER AQUI, e não pelo app. Conferido em 14/09/2026: a chave
-- anônima que o app usa recebe `403 new row violates row-level security policy`
-- ao tentar criar balde. Criar pelo SQL é o único caminho.
--
-- Público de propósito: a foto e a assinatura aparecem como imagem comum na
-- tela do painel. Balde privado obrigaria cada miniatura a pedir uma assinatura
-- de URL ao servidor, e o painel abre dezenas de uma vez.
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('ramp-provas', 'ramp-provas', true)
on conflict (id) do nothing;

-- Inserir e ler, nada mais. Não existe apagar: assinatura recolhida é prova, e
-- prova que o próprio app pode apagar não é prova. Corrigir é colher de novo.
drop policy if exists ramp_provas_inserir on storage.objects;
create policy ramp_provas_inserir on storage.objects
  for insert to anon with check (bucket_id = 'ramp-provas');

drop policy if exists ramp_provas_ler on storage.objects;
create policy ramp_provas_ler on storage.objects
  for select to anon using (bucket_id = 'ramp-provas');


-- O PostgREST guarda o desenho do banco em cache: sem isto as tabelas e as
-- colunas novas só aparecem para o app depois de um tempo.
notify pgrst, 'reload schema';


-- ─── Conferência depois de rodar ─────────────────────────────────────────────
-- As quatro consultas têm que devolver linha.
--
-- select count(*) from "ramp-control".funcionarios;            -- 34
-- select table_name from information_schema.tables
--  where table_schema = 'ramp-control' and table_name = 'presencas';
-- select column_name from information_schema.columns
--  where table_schema = 'ramp-control'
--    and table_name = 'relatorios_consolidados'
--    and column_name like '%prova%';                           -- 2 linhas
-- select id, public from storage.buckets where id = 'ramp-provas';
