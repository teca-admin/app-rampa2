-- ─── O tema do dia do briefing (31 temas do MGO) ────────────────────────────
-- Criado em 28/10/2026, a pedido dele, a partir do documento que o Edson
-- mandou ("Programa de Briefing da Rampa, 31 temas do MGO"). O registro do
-- briefing já tinha horário, foto e lista assinada; faltava DO QUE se falou.
--
-- Uma coluna só, em jsonb, com a CÓPIA do tema que o líder leu: dia, título,
-- os 3 pontos, a referência do MGO, a revisão e a hora em que ele marcou "li
-- os 3 pontos para a equipe". Cópia, e não só o número: se o MGO mudar de
-- revisão, o registro antigo continua dizendo o que foi dito naquele dia.
--
-- 🔴 RODAR ANTES DE QUALQUER ENVIO PELA VERSÃO NOVA DO APP. Sem a coluna, o
-- insert do relatório manda um campo que a tabela não tem e o PostgREST RECUSA
-- A GRAVAÇÃO INTEIRA: o líder fica sem entregar o turno. Mesma armadilha do
-- Km do SPIN, do OBS e da prova.
--
-- ⚠️ Este banco é o MESMO de desenvolvimento e de produção. A coluna nasce
-- nula em todos os relatórios que já existem, que é o estado certo: nenhum
-- deles teve tema registrado. O app que está no ar hoje não manda o campo e
-- continua gravando como sempre.
--
-- COMO RODAR: Supabase > SQL Editor > cole tudo > Run.

alter table "ramp-control".relatorios_consolidados
  add column if not exists briefing_tema jsonb;

comment on column "ramp-control".relatorios_consolidados.briefing_tema is
  'Tema do dia do MGO lido no briefing (copia gravada no envio): dia, titulo, pontos, mgo, revisao, confirmado_em. Nulo = briefing sem tema registrado (todos os anteriores a 28/10/2026).';

-- O PostgREST guarda o desenho do banco em cache: sem isto a coluna nova só
-- aparece para o app depois de um tempo.
notify pgrst, 'reload schema';


-- ─── Conferência depois de rodar ─────────────────────────────────────────────
-- Tem que devolver uma linha, com data_type = jsonb:
--
-- select column_name, data_type from information_schema.columns
--  where table_schema = 'ramp-control'
--    and table_name = 'relatorios_consolidados'
--    and column_name = 'briefing_tema';
