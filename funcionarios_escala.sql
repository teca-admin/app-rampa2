-- ─── Funcionários: a escala completa da rampa, e o fim do CPF ────────────────
-- Criado em 14/09/2026, a pedido dele: "não precisa de CPF, apenas o nome e
-- matrícula". O CPF nunca foi lido pelo app (o App.tsx pede só matricula, nome,
-- funcao e ativo), então a coluna sai sem quebrar nada, nem o espelho offline.
--
-- A escala que ele mandou tem 73 pessoas. 22 já estavam na tabela, 51 entram
-- aqui. Os 12 condutores de ônibus que estão na tabela e NÃO estão nesta escala
-- continuam como estão: a escala é da rampa, e ninguém é desligado por não
-- aparecer numa lista que não é a dele.
--
-- ⚠️ Este banco é o MESMO de desenvolvimento e de produção. Rodar isto muda a
-- produção na hora. Pode rodar mais de uma vez: o insert ignora quem já existe
-- e o drop só age se a coluna ainda estiver lá.
--
-- 📌 `funcao` fica nula nos 51 novos: a escala não traz a função. Preencher
-- depois, se quiser, com update por matrícula.
--
-- COMO RODAR: Supabase > SQL Editor > cole tudo > Run.

-- 1. Quem falta (51). `on conflict do nothing` de propósito: rodar duas vezes
--    não desfaz correção de cadastro feita no banco depois.
insert into "ramp-control".funcionarios (matricula, nome) values
  ('96787', 'EUDO JOSE TAVARES NEVES'),
  ('97361', 'JERSEY DIDAS M. CAVALCANTE'),
  ('94195', 'RONALDO DA SILVA MARQUES'),
  ('21946', 'RUI SERRA DE CARVALHO NETO'),
  ('25513', 'ARILSON GARCIA MOREIRA'),
  ('30859', 'THIAGO SAMIAS ROCHA'),
  ('19666', 'GUSTAVO FERRREIRA RODRIGUES'),
  ('93440', 'LUCIANO DE OLIVEIRA DA SILVA'),
  ('98342', 'ALDICLEI DIAS DA SILVA'),
  ('26181', 'ELIAS COELHO DE LIMA'),
  ('39548', 'MATHEUS HENRIQUE MIRANDA MELO'),
  ('93464', 'JOELSON ALMEIDA DE MOURA'),
  ('93465', 'JAIME MARQUES DOS SANTOS'),
  ('40070', 'DANIEL DE FREITAS PEREIRA'),
  ('31928', 'VICTOR RHOLH DE LIMA'),
  ('24547', 'ELISEU CAVALCANTE L. DA SILVA'),
  ('22060', 'VINICIUS RODRIGUES DA SILVA'),
  ('19704', 'ALISSON DA SILVA LIMA'),
  ('14788', 'MATEUS LIMA DE FREITAS'),
  ('17830', 'LEONARDO CASTRO V. JUNOR'),
  ('20687', 'JOSE ROBERTO DA CRUZ REIS'),
  ('93484', 'DELMO ANDRADE DE SOUZA'),
  ('16284', 'ALEXANDRE H. G. RODREGUES'),
  ('30455', 'THIAGO LIMA GONCALVES'),
  ('40071', 'FELIPE ARAUJO DA ROCHA'),
  ('38786', 'CARLOS VINICIO DOS SANTOS HONORATO'),
  ('34072', 'DHERALDH CRISTIANO LOPES MORAES'),
  ('35099', 'NIKOLAS HAICLEN VILHENA LIMA'),
  ('31264', 'JULIO CESAR DE ALMEIDA DIEB'),
  ('37586', 'JHONATA GENESES PIMENTEL OLIVEIRA'),
  ('38551', 'THIAGO DA SILVA E SILVA'),
  ('39614', 'RUBENS SALOMAO C. GOMES FILHO'),
  ('39607', 'MATHEUS MESQUITA RODRIGUES'),
  ('38552', 'ADRIEL BERNARDOSODRE'),
  ('28005', 'DAVI CAUA AZEVEDO VIANA'),
  ('36564', 'EVERTON FELIPE FILGUEIRAS GOMES'),
  ('36565', 'WESLLEY CAUA PERRONE DA SILVA'),
  ('36563', 'ZIANN HECTOR SILVA DE OLIVEIRA'),
  ('40023', 'ISSAC GUIMARAES DA SILVA'),
  ('93481', 'ANA RITA ROCHA DE SOUZA'),
  ('30864', 'JOSE VINICIUS DA R, MARQUES'),
  ('13754', 'NILTON CEZAR FERREIRA DIEB'),
  ('10999', 'JACKSON PORTILHO SILVA'),
  ('27714', 'VICTOR HUGO PESSOA LEAL'),
  ('30024', 'LAUDENILSE DE SOUSA REIS'),
  ('27500', 'LUCIENE FERNANDES DOS SANTOS'),
  ('30780', 'ADRIANA BASILIO DA SILVA'),
  ('95699', 'JOSE RAILSON VIEIRA SIQUEIRA'),
  ('13082', 'JOSE AMANCIO DE S. HOLANDA'),
  ('34149', 'JOSE MARIA DA COSTA MEDEIROS'),
  ('31635', 'LUIZ GABRIEL BASTOS MOURA')
on conflict (matricula) do nothing;

-- 2. O CPF vai embora.
alter table "ramp-control".funcionarios drop column if exists cpf;

-- O PostgREST guarda o desenho do banco em cache.
notify pgrst, 'reload schema';


-- ─── Conferência depois de rodar ─────────────────────────────────────────────
-- select count(*) from "ramp-control".funcionarios;             -- 85
-- select column_name from information_schema.columns
--  where table_schema = 'ramp-control' and table_name = 'funcionarios';
--                                            -- matricula, nome, funcao, ativo, criado_em (sem cpf)
