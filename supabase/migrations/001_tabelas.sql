-- Caixinha de investimento: schema isolado, não toca em public
create schema if not exists caixinha;

create table caixinha.socios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  nome text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table caixinha.config (
  chave text primary key,
  valor text not null
);

create table caixinha.contas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  tipo text not null default 'caixa' check (tipo in ('caixa','banco','carteira')),
  ativa boolean not null default true
);

create table caixinha.regras (
  id uuid primary key default gen_random_uuid(),
  chave text not null,
  parametros jsonb not null,
  vigente_de date not null,
  vigente_ate date,
  descricao text,
  check (vigente_ate is null or vigente_ate >= vigente_de)
);
create index on caixinha.regras (chave, vigente_de);

create table caixinha.semanas (
  id uuid primary key default gen_random_uuid(),
  inicio date not null unique,
  fim date not null,
  valor_esperado numeric(12,2) not null check (valor_esperado >= 0),
  acumulado_anterior numeric(12,2) not null default 0,
  check (fim >= inicio)
);

create table caixinha.investimentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('mercadoria','emprestimo','outro')),
  nome text not null,
  status text not null default 'ativo',
  valor_aplicado numeric(12,2) not null check (valor_aplicado >= 0),
  aplicado_em date not null,
  campos_extras jsonb not null default '{}'::jsonb,
  observacao text,
  criado_por uuid references auth.users(id) default auth.uid(),
  criado_em timestamptz not null default now()
);
create index on caixinha.investimentos (tipo, status);

create table caixinha.aportes (
  id uuid primary key default gen_random_uuid(),
  semana_id uuid references caixinha.semanas(id),
  socio_id uuid not null references caixinha.socios(id),
  valor numeric(12,2) not null check (valor > 0),
  pago_em date not null,
  extra boolean not null default false,
  criado_em timestamptz not null default now()
);
create index on caixinha.aportes (socio_id, pago_em);

create table caixinha.mercadoria_lotes (
  investimento_id uuid primary key references caixinha.investimentos(id) on delete restrict,
  fornecedor text,
  custo numeric(12,2) not null check (custo >= 0),
  frete numeric(12,2) not null default 0 check (frete >= 0),
  pago_em date not null,
  previsao_entrega date,
  recebido_em date,
  qtd_fracoes int not null default 4 check (qtd_fracoes between 1 and 50)
);

create table caixinha.mercadoria_fracoes (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references caixinha.mercadoria_lotes(investimento_id) on delete restrict,
  descricao text,
  preco_desejado numeric(12,2) check (preco_desejado >= 0),
  preco_venda numeric(12,2) check (preco_venda >= 0),
  comprador text,
  vendido_em date,
  recebido boolean not null default false,
  recebido_em date
);
create index on caixinha.mercadoria_fracoes (lote_id);

create table caixinha.emprestimos (
  investimento_id uuid primary key references caixinha.investimentos(id) on delete restrict,
  tomador text not null,
  tomador_socio_id uuid references caixinha.socios(id),
  tipo_juros text not null default 'composto' check (tipo_juros in ('simples','composto','fixo')),
  taxa numeric(8,4) not null check (taxa >= 0),
  periodo text not null default 'mes' check (periodo in ('dia','semana','mes')),
  prazo_dias int,
  multa numeric(8,4) not null default 0,
  mora_diaria numeric(8,4) not null default 0.02,
  ciclo_atual_inicio date not null
);

create table caixinha.emprestimo_parcelas (
  id uuid primary key default gen_random_uuid(),
  emprestimo_id uuid not null references caixinha.emprestimos(investimento_id) on delete restrict,
  vencimento date not null,
  valor numeric(12,2) not null check (valor >= 0),
  pago_valor numeric(12,2) not null default 0,
  pago_em date,
  mora_calculada numeric(12,2) not null default 0,
  mora_perdoada boolean not null default false,
  justificativa_perdao text,
  perdoado_por uuid references auth.users(id),
  check (not mora_perdoada or coalesce(length(trim(justificativa_perdao)),0) > 0)
);
create index on caixinha.emprestimo_parcelas (emprestimo_id, vencimento);

-- Livro-caixa: fonte de todos os saldos. Nunca editar nem apagar; correção = estorno.
create table caixinha.movimentacoes (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  tipo text not null check (tipo in (
    'aporte','compra_mercadoria','frete','venda','emprestimo_saida',
    'emprestimo_recebimento','juros','multa','retirada','ajuste','estorno',
    'outro_investimento','outro_retorno')),
  sentido text not null check (sentido in ('entrada','saida')),
  valor numeric(12,2) not null check (valor > 0),
  conta_id uuid not null references caixinha.contas(id),
  investimento_id uuid references caixinha.investimentos(id),
  socio_id uuid references caixinha.socios(id),
  descricao text,
  estorno_de uuid references caixinha.movimentacoes(id),
  criado_por uuid references auth.users(id) default auth.uid(),
  criado_em timestamptz not null default now()
);
create index on caixinha.movimentacoes (data);
create index on caixinha.movimentacoes (investimento_id);
create unique index on caixinha.movimentacoes (estorno_de) where estorno_de is not null;

-- Segurança: só sócios ativos acessam
create or replace function caixinha.is_socio() returns boolean
language sql stable security definer set search_path = caixinha, pg_temp as $$
  select exists (select 1 from caixinha.socios s where s.user_id = auth.uid() and s.ativo);
$$;
revoke all on function caixinha.is_socio() from public, anon;
grant execute on function caixinha.is_socio() to authenticated;

do $$
declare t text;
begin
  for t in select unnest(array['socios','contas','regras','semanas','investimentos','aportes',
    'mercadoria_lotes','mercadoria_fracoes','emprestimos','emprestimo_parcelas','movimentacoes','config'])
  loop
    execute format('alter table caixinha.%I enable row level security', t);
  end loop;
end $$;

-- config: sem políticas = inacessível pela API (só funções internas leem)

create policy socios_ler on caixinha.socios for select to authenticated using (caixinha.is_socio());
create policy socios_editar on caixinha.socios for update to authenticated using (caixinha.is_socio()) with check (caixinha.is_socio());

do $$
declare t text;
begin
  for t in select unnest(array['contas','regras','semanas','investimentos','aportes',
    'mercadoria_lotes','mercadoria_fracoes','emprestimos','emprestimo_parcelas'])
  loop
    execute format('create policy %I on caixinha.%I for all to authenticated using (caixinha.is_socio()) with check (caixinha.is_socio())', t||'_socios', t);
  end loop;
end $$;

create policy mov_ler on caixinha.movimentacoes for select to authenticated using (caixinha.is_socio());
create policy mov_inserir on caixinha.movimentacoes for insert to authenticated with check (caixinha.is_socio());

revoke all on all tables in schema caixinha from anon, authenticated, public;
grant usage on schema caixinha to authenticated;
grant select, update on caixinha.socios to authenticated;
grant select, insert, update, delete on caixinha.contas, caixinha.regras, caixinha.semanas,
  caixinha.investimentos, caixinha.aportes, caixinha.mercadoria_lotes,
  caixinha.mercadoria_fracoes, caixinha.emprestimos, caixinha.emprestimo_parcelas to authenticated;
grant select, insert on caixinha.movimentacoes to authenticated;
