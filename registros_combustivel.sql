-- ============================================================================
-- Registro manual de abastecimento.
-- Diferente de tudo que o dashboard mostra hoje: não vem do relatório do
-- líder, é digitado direto na tela da Gerência.
--
-- COMO RODAR: Supabase > SQL Editor > cole tudo > Run.
-- ============================================================================

create table if not exists "ramp-control".registros_combustivel (
  id            uuid primary key default gen_random_uuid(),
  data          date not null,
  tipo          text not null check (tipo in ('GASOLINA', 'DIESEL')),
  litros        numeric(10,2) not null check (litros > 0),
  -- Reservado: o formulário ainda não pede valor, porque o pedido foi só data,
  -- tipo e litros. Fica aqui pronto para o dia em que o combustível precisar
  -- entrar na soma de Custos, e aí é mexer só na tela, sem novo SQL.
  valor_total   numeric(10,2),
  registrado_em timestamptz not null default now()
);

-- O painel sempre filtra por período, então a busca é sempre por data.
create index if not exists registros_combustivel_data_idx
  on "ramp-control".registros_combustivel (data);

-- Mesmo padrão das outras tabelas do schema, que não usam RLS.
alter table "ramp-control".registros_combustivel disable row level security;

-- O PostgREST guarda o desenho do banco em cache: sem isto a tabela nova
-- só aparece para o app depois de um tempo.
notify pgrst, 'reload schema';

-- Conferência:
-- select data, tipo, litros from "ramp-control".registros_combustivel order by data desc;
