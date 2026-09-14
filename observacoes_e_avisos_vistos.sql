-- ─── Observações do turno + "Vi a notificação" do painel ───────────────────
-- Criado em 11/09/2026, depois da locação de 08/09 que cobrava R$ 4.320 por
-- causa de início e fim trocados (19:23 → 18:26 contava 24 horas). Duas
-- coisas nascem aqui, e as duas são independentes uma da outra:
--
-- 1. A coluna `observacoes` em relatorios_consolidados: o campo OBS de texto
--    livre da seção 10 do app do líder.
--
-- 2. A tabela `avisos_vistos`: o painel da Gerência passa a apontar lançamento
--    com horário que não fecha (locação acima de 4h, voo acima de 6h) e o
--    botão "Vi a notificação" grava aqui. Fica no BANCO e não no navegador
--    porque o gerente e o coordenador olham de computadores diferentes: visto
--    num, some nos dois.
--
-- 🔴 RODAR ANTES DE SUBIR A VERSÃO NOVA DO APP. Sem a coluna, o insert do
-- relatório manda um campo que a tabela não tem e o PostgREST RECUSA A
-- GRAVAÇÃO INTEIRA. Quem perde é o líder, que fica sem entregar o turno.
-- Mesma armadilha do Km do SPIN.
--
-- ⚠️ Este banco é o MESMO de desenvolvimento e de produção. Rodar isto muda a
-- produção na hora. Como a coluna é nova e nula e a tabela nasce vazia, nada
-- que já existe se altera: os relatórios antigos seguem válidos, sem OBS.
--
-- COMO RODAR: Supabase > SQL Editor > cole tudo > Run.

-- 1. OBS do turno. Texto livre, opcional: vazio grava NULL.
alter table "ramp-control".relatorios_consolidados
  add column if not exists observacoes text;

-- 2. Quem já viu qual aviso do painel.
-- 🔑 A `chave` identifica o LANÇAMENTO, não o relatório: é o id do relatório
-- mais o tipo (locação ou voo), a posição na lista e os próprios horários.
-- Se o horário for corrigido no banco, a chave muda e o aviso some sozinho,
-- porque o lançamento corrigido não é mais suspeito.
create table if not exists "ramp-control".avisos_vistos (
  chave         text primary key,
  relatorio_id  uuid not null,
  descricao     text not null,
  visto_em      timestamptz not null default now()
);

-- Mesmo padrão das outras tabelas do schema, que não usam RLS.
alter table "ramp-control".avisos_vistos disable row level security;

-- O PostgREST guarda o desenho do banco em cache: sem isto a coluna e a
-- tabela novas só aparecem para o app depois de um tempo.
notify pgrst, 'reload schema';

-- Conferência depois de rodar: as duas consultas têm que devolver linha.
-- select column_name, data_type, is_nullable
--   from information_schema.columns
--  where table_schema = 'ramp-control'
--    and table_name = 'relatorios_consolidados'
--    and column_name = 'observacoes';
-- select table_name from information_schema.tables
--  where table_schema = 'ramp-control' and table_name = 'avisos_vistos';
