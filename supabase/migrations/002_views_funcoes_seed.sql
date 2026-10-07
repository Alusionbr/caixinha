-- Entrada dos dois sócios: exige código de convite e limita a 2 sócios
create or replace function caixinha.entrar_como_socio(p_nome text, p_codigo text)
returns uuid
language plpgsql security definer set search_path = caixinha, pg_temp as $$
declare v_id uuid; v_codigo text;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro'; end if;
  if exists (select 1 from caixinha.socios where user_id = auth.uid()) then
    raise exception 'Você já é sócio';
  end if;
  select valor into v_codigo from caixinha.config where chave = 'codigo_convite';
  if v_codigo is null or p_codigo is distinct from v_codigo then
    raise exception 'Código de convite inválido';
  end if;
  if (select count(*) from caixinha.socios) >= 2 then
    raise exception 'A caixinha já tem 2 sócios';
  end if;
  insert into caixinha.socios (user_id, nome) values (auth.uid(), trim(p_nome)) returning id into v_id;
  return v_id;
end $$;
revoke all on function caixinha.entrar_como_socio(text, text) from public, anon;
grant execute on function caixinha.entrar_como_socio(text, text) to authenticated;

-- Movimentações com valores assinados (base de todos os cálculos)
create or replace view caixinha.v_mov_calc with (security_invoker = true) as
select m.id, m.data, m.tipo, m.sentido, m.valor, m.conta_id, m.investimento_id, m.socio_id,
  case m.sentido when 'entrada' then m.valor else -m.valor end as caixa,
  case when m.tipo in ('compra_mercadoria','frete','emprestimo_saida','outro_investimento')
    then case m.sentido when 'saida' then m.valor else -m.valor end else 0 end as aplicado,
  case when m.tipo in ('venda','emprestimo_recebimento','outro_retorno')
    then case m.sentido when 'entrada' then m.valor else -m.valor end else 0 end as retorno_principal,
  case when m.tipo in ('juros','multa')
    then case m.sentido when 'entrada' then m.valor else -m.valor end else 0 end as lucro_juros
from caixinha.movimentacoes m;

create or replace view caixinha.v_saldo_contas with (security_invoker = true) as
select c.id, c.nome, c.tipo, coalesce(sum(v.caixa),0)::numeric(12,2) as saldo
from caixinha.contas c left join caixinha.v_mov_calc v on v.conta_id = c.id
group by c.id, c.nome, c.tipo;

create or replace view caixinha.v_resultado_investimento with (security_invoker = true) as
with tot as (
  select investimento_id, sum(aplicado) as aplicado, sum(retorno_principal) as retornado_principal,
         sum(lucro_juros) as juros, min(data) filter (where aplicado > 0) as primeira_saida
  from caixinha.v_mov_calc where investimento_id is not null group by investimento_id
), cum as (
  select investimento_id, data, sum(retorno_principal + lucro_juros) over (partition by investimento_id order by data) as acumulado
  from caixinha.v_mov_calc where investimento_id is not null
), pay as (
  select c.investimento_id, min(c.data) as data_payback
  from cum c join tot t using (investimento_id)
  where t.aplicado > 0 and c.acumulado >= t.aplicado group by c.investimento_id
)
select i.id, i.tipo, i.nome, i.status, i.aplicado_em,
  coalesce(t.aplicado,0) as aplicado,
  coalesce(t.retornado_principal,0) as retornado_principal,
  coalesce(t.juros,0) as juros_recebidos,
  (coalesce(t.retornado_principal,0) + coalesce(t.juros,0) - coalesce(t.aplicado,0)) as lucro,
  case when coalesce(t.aplicado,0) > 0
    then round((coalesce(t.retornado_principal,0) + coalesce(t.juros,0) - t.aplicado) / t.aplicado, 4) end as roi,
  case when coalesce(t.aplicado,0) > 0
    then round(least(1, (coalesce(t.retornado_principal,0) + coalesce(t.juros,0)) / t.aplicado), 4) end as recuperado_pct,
  (p.data_payback - t.primeira_saida) as payback_dias,
  (p.data_payback is null and coalesce(t.aplicado,0) > 0) as em_recuperacao,
  greatest(0, coalesce(t.aplicado,0) - coalesce(t.retornado_principal,0)) as capital_aberto
from caixinha.investimentos i
left join tot t on t.investimento_id = i.id
left join pay p on p.investimento_id = i.id;

create or replace view caixinha.v_composicao_patrimonio with (security_invoker = true) as
select 'caixa'::text as componente, coalesce(sum(saldo),0)::numeric(12,2) as valor from caixinha.v_saldo_contas
union all
select tipo, coalesce(sum(capital_aberto),0)::numeric(12,2) from caixinha.v_resultado_investimento group by tipo;

create or replace view caixinha.v_patrimonio_atual with (security_invoker = true) as
select coalesce(sum(valor),0)::numeric(12,2) as patrimonio from caixinha.v_composicao_patrimonio;

create or replace view caixinha.v_patrimonio_semanal with (security_invoker = true) as
with limites as (select date_trunc('week', min(data))::date as ini from caixinha.movimentacoes),
semanas as (
  select gs::date as semana_inicio, least((gs + interval '6 days')::date, current_date) as semana_fim
  from limites, generate_series(limites.ini, date_trunc('week', current_date)::date, interval '1 week') gs
  where limites.ini is not null
)
select s.semana_inicio,
  coalesce((select sum(caixa) from caixinha.v_mov_calc where data <= s.semana_fim),0)::numeric(12,2) as caixa,
  coalesce((select sum(greatest(0, a - r)) from (
     select sum(aplicado) a, sum(retorno_principal) r from caixinha.v_mov_calc
     where data <= s.semana_fim and investimento_id is not null group by investimento_id) x),0)::numeric(12,2) as capital_aplicado,
  (coalesce((select sum(caixa) from caixinha.v_mov_calc where data <= s.semana_fim),0)
   + coalesce((select sum(greatest(0, a - r)) from (
     select sum(aplicado) a, sum(retorno_principal) r from caixinha.v_mov_calc
     where data <= s.semana_fim and investimento_id is not null group by investimento_id) y),0))::numeric(12,2) as patrimonio
from semanas s;

create or replace view caixinha.v_participacao_socios with (security_invoker = true) as
select s.id, s.nome, coalesce(sum(a.valor),0)::numeric(12,2) as total_aportado,
  round(coalesce(sum(a.valor),0) / nullif(sum(coalesce(sum(a.valor),0)) over (),0), 4) as participacao
from caixinha.socios s left join caixinha.aportes a on a.socio_id = s.id
group by s.id, s.nome;

grant select on caixinha.v_mov_calc, caixinha.v_saldo_contas, caixinha.v_resultado_investimento,
  caixinha.v_composicao_patrimonio, caixinha.v_patrimonio_atual, caixinha.v_patrimonio_semanal,
  caixinha.v_participacao_socios to authenticated;

-- Dados iniciais (regras editáveis, com vigência)
insert into caixinha.contas (nome, tipo) values ('Caixa da caixinha','caixa');

insert into caixinha.regras (chave, parametros, vigente_de, descricao) values
 ('aporte_semanal','{"valor_por_socio":200,"dia_inicio":3,"dia_fim":5,"acumula_atraso":true,"multa_atraso":0}', current_date,'R$ 200 por sócio por semana, de quarta a sexta; atraso acumula'),
 ('juros_emprestimo','{"tipo":"composto","taxa":0.30,"periodo":"mes","permite_pagar_juros_e_reiniciar":true}', current_date,'Juros compostos de média 30% ao mês'),
 ('mora_emprestimo','{"taxa_diaria":0.02,"perdoavel":true,"exige_justificativa":true}', current_date,'Atraso: 2% ao dia, perdoável com justificativa'),
 ('destino_lucro','{"modo":"reinvestir"}', current_date,'Lucro fica na caixinha para reinvestir'),
 ('participacao','{"modo":"proporcional_ao_aportado"}', current_date,'Participação proporcional ao total aportado'),
 ('lote_mercadoria_padrao','{"custo":580,"qtd_fracoes":4}', current_date,'Lote padrão de R$ 580 dividido em até 4 frações');

-- Código de convite aleatório (consulte em: select valor from caixinha.config where chave = 'codigo_convite';)
insert into caixinha.config (chave, valor)
values ('codigo_convite', substr(md5(random()::text || clock_timestamp()::text), 1, 10));
