-- ─── Trava de relatório duplicado ───────────────────────────────────────────
-- Um turno passa a ter UM relatório: quando o mesmo líder reenvia a mesma
-- data e o mesmo turno, o registro existente é ATUALIZADO em vez de nascer
-- outro. Para o líder isso é invisível, que foi o pedido.
--
-- 🔑 A coluna abaixo guarda o que havia antes da substituição. Ela não aparece
-- em tela nenhuma e não muda nenhuma consulta: existe porque um reenvio pode
-- PERDER dado sem ninguém ver. Aconteceu de verdade em 21/08/2026, quando a
-- segunda versão do relatório do Joel veio sem o GSE LM00168 que a primeira
-- registrava. Com o histórico aqui, dá pra recuperar; sem ele, o envio some.
--
-- Rodar uma vez no banco (schema "ramp-control").

alter table "ramp-control".relatorios_consolidados
  add column if not exists versoes jsonb not null default '[]'::jsonb;

comment on column "ramp-control".relatorios_consolidados.versoes is
  'Versões anteriores deste relatório, do mais antigo para o mais novo. Cada item é o conteúdo inteiro que foi substituído, com substituido_em. Preenchido pelo app quando o líder reenvia o mesmo turno.';

-- ⚠️ NÃO existe índice único em (data, turno, lider) de propósito.
-- O histórico tem 9 turnos com mais de um relatório, de janeiro a agosto de
-- 2026, e ele foi mantido como está por decisão dele. Um índice único não
-- seria criado com esses registros no lugar, e apagá-los pra conseguir criar
-- o índice jogaria fora dois turnos que NÃO são duplicata, e sim turnos
-- diferentes lançados com o mesmo nome (27/05 e 10/08).
--
-- Quando o histórico for resolvido, este é o índice que fecha a porta no
-- banco, e não só no app:
--
--   create unique index if not exists relatorios_um_por_turno
--     on "ramp-control".relatorios_consolidados (data, turno, lider);

-- Conferência: quais turnos ainda têm mais de um relatório.
-- select data, turno, lider, count(*)
--   from "ramp-control".relatorios_consolidados
--  group by data, turno, lider
-- having count(*) > 1
--  order by data desc;
