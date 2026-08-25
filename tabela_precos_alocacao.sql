-- ============================================================================
-- Preço por hora do equipamento NOSSO alugado para terceiros (alocação).
-- Espelha a tabela_precos_locacao, que guarda o preço do equipamento de
-- terceiro que nós alugamos. Uma é receita, a outra é custo.
--
-- Valores levantados pelo Rick em 24/08/2026.
-- Tudo em BRL: a moeda estrangeira só aparece na locação, com a Gol.
--
-- COMO RODAR: Supabase > SQL Editor > cole tudo > Run.
-- ============================================================================

create table if not exists "ramp-control".tabela_precos_alocacao (
  id            uuid primary key default gen_random_uuid(),
  equipamento   text not null unique,
  valor_hora    numeric(10,2) not null,
  atualizado_em timestamptz not null default now()
);

-- Mesmo padrão das outras tabelas do schema, que não usam RLS.
alter table "ramp-control".tabela_precos_alocacao disable row level security;

-- ----------------------------------------------------------------------------
-- O nome tem que bater EXATO com equipamentos.nome, que é por onde o painel
-- procura o preço. Conferido em 24/08: os quatro nomes abaixo existem na frota.
--
--   equipamento          unidades   já alocado   horas cobradas
--   PUSHBACK                2x          74x           74h
--   TRATOR DE CARGAS        5x          10x           26h
--   LOADER                  3x           5x            7h
--   GPU                     2x           2x            4h
--
-- Sobre o LOADER: 600,00 e o preco do LOADER MDL, e o LDL custa 350,00, quase
-- metade. A tabela equipamentos NAO guarda o modelo, entao isso nao da pra
-- descobrir pelo sistema: o Rick confirmou na mao, em 24/08/2026, que o loader
-- da frota e MDL mesmo. Se um dia entrar um LDL na frota, este preco unico
-- passa a mentir.
-- ----------------------------------------------------------------------------

insert into "ramp-control".tabela_precos_alocacao (equipamento, valor_hora) values
  ('PUSHBACK',         180.00),
  ('TRATOR DE CARGAS', 100.00),
  ('LOADER',           600.00),
  ('GPU',              240.00)
on conflict (equipamento) do update
  set valor_hora = excluded.valor_hora,
      atualizado_em = now();

-- ----------------------------------------------------------------------------
-- FALTAM DOIS, e ficam FORA de propósito: '(CONVEYOR) ESTEIRA' e 'SPIN'.
-- Nenhum fornecedor tem preço para eles na tabela_precos_locacao, então não há
-- de onde tirar referência. Cadastrar com 0,00 seria pior do que não cadastrar:
-- o painel trataria zero como preço real e mostraria receita incompleta como se
-- fosse completa. Sem a linha, ele avisa na tela que falta preço.
--
-- Quando tiver o valor, e so rodar a linha abaixo TROCANDO O 0.00 PELO VALOR.
-- Rodar com 0.00 e PIOR do que nao rodar: zero vira preco de verdade, o aviso
-- amarelo some da tela e o equipamento passa a somar R$ 0,00 calado.
-- Aconteceu com o SPIN em 24/08, e foi desfeito com:
--   delete from "ramp-control".tabela_precos_alocacao where equipamento = 'SPIN';
--
--   insert into "ramp-control".tabela_precos_alocacao (equipamento, valor_hora)
--   values ('(CONVEYOR) ESTEIRA', 0.00), ('SPIN', 0.00)
--   on conflict (equipamento) do update
--     set valor_hora = excluded.valor_hora, atualizado_em = now();
-- ----------------------------------------------------------------------------

-- O PostgREST guarda o desenho do banco em cache: sem isto a tabela nova
-- só aparece para o app depois de um tempo.
notify pgrst, 'reload schema';

-- Conferência:
-- select equipamento, valor_hora from "ramp-control".tabela_precos_alocacao order by equipamento;
