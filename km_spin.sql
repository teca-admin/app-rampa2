-- ─── Km do SPIN no relatório de turno ──────────────────────────────────────
-- Criado em 10/09/2026, a pedido do coordenador, que quer acompanhar o uso do
-- carro: quanto roda por turno, qual turno usa mais e em que dias.
--
-- 🔴 RODAR ANTES DE SUBIR A VERSÃO NOVA DO APP. Sem estas colunas, o insert do
-- relatório passa a mandar dois campos que a tabela não tem e o PostgREST
-- RECUSA A GRAVAÇÃO INTEIRA. Quem perde é o líder, que fica sem conseguir
-- entregar o turno.
--
-- 🔑 As duas colunas nascem NULAS e continuam aceitando nulo de propósito: o
-- preenchimento é opcional (decisão dele em 10/09), e turno sem Km precisa ser
-- distinguível de turno com Km zero. O painel da Coordenação conta quantos
-- turnos vieram sem preencher.
--
-- ⚠️ Este banco é o MESMO de desenvolvimento e de produção. Rodar isto muda a
-- produção na hora. Como as colunas são novas e nulas, nada que já existe se
-- altera: os relatórios antigos seguem válidos, com Km vazio.
--
-- ⚠️ `integer` e não `numeric`: o odômetro do carro não tem casa decimal.

alter table "ramp-control".relatorios_consolidados
  add column if not exists km_spin_inicial integer,
  add column if not exists km_spin_final integer;

-- Conferência depois de rodar: as duas colunas têm que aparecer aqui.
-- select column_name, data_type, is_nullable
--   from information_schema.columns
--  where table_schema = 'ramp-control'
--    and table_name = 'relatorios_consolidados'
--    and column_name like 'km_spin%';
