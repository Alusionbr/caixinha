-- 003: endurecimento de segurança do schema caixinha
-- Aplicar depois de 001 e 002. Ainda NÃO aplicada no banco (ver docs/ESTADO.md).

-- 1) Sócios só podem editar o próprio nome (não podem trocar user_id nem desativar o outro)
drop policy if exists socios_editar on caixinha.socios;
revoke update on caixinha.socios from authenticated;
grant update (nome) on caixinha.socios to authenticated;
create policy socios_editar_proprio on caixinha.socios for update to authenticated
  using (user_id = auth.uid() and caixinha.is_socio())
  with check (user_id = auth.uid() and caixinha.is_socio());

-- 2) Autoria não pode ser forjada no livro-caixa
drop policy if exists mov_inserir on caixinha.movimentacoes;
create policy mov_inserir on caixinha.movimentacoes for insert to authenticated
  with check (caixinha.is_socio() and criado_por = auth.uid());

-- 3) Livro-caixa imutável mesmo para quem tiver permissão de administrador
create or replace function caixinha.bloquear_alteracao_livro() returns trigger
language plpgsql set search_path = caixinha, pg_temp as $$
begin
  raise exception 'O livro-caixa não pode ser alterado nem apagado; corrija com um estorno';
end $$;
drop trigger if exists trg_livro_imutavel on caixinha.movimentacoes;
create trigger trg_livro_imutavel before update or delete on caixinha.movimentacoes
  for each row execute function caixinha.bloquear_alteracao_livro();
drop trigger if exists trg_livro_sem_truncate on caixinha.movimentacoes;
create trigger trg_livro_sem_truncate before truncate on caixinha.movimentacoes
  for each statement execute function caixinha.bloquear_alteracao_livro();

-- 4) Convite: limite de tentativas (por usuário e global) e código apagado após o 2º sócio
create table if not exists caixinha.tentativas_convite (
  id bigint generated always as identity primary key,
  user_id uuid,
  em timestamptz not null default now()
);
alter table caixinha.tentativas_convite enable row level security;
revoke all on caixinha.tentativas_convite from anon, authenticated, public;

drop function if exists caixinha.entrar_como_socio(text, text);
create or replace function caixinha.entrar_como_socio(p_nome text, p_codigo text)
returns jsonb
language plpgsql security definer set search_path = caixinha, pg_temp as $$
declare v_codigo text; v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'erro', 'Faça login primeiro'); end if;
  if length(trim(coalesce(p_nome,''))) = 0 then return jsonb_build_object('ok', false, 'erro', 'Informe seu nome'); end if;
  if exists (select 1 from caixinha.socios where user_id = v_uid) then
    return jsonb_build_object('ok', true);
  end if;

  delete from caixinha.tentativas_convite where em < now() - interval '1 day';
  if (select count(*) from caixinha.tentativas_convite where user_id = v_uid and em > now() - interval '1 hour') >= 5
     or (select count(*) from caixinha.tentativas_convite where em > now() - interval '1 hour') >= 20 then
    return jsonb_build_object('ok', false, 'erro', 'Muitas tentativas. Tente novamente mais tarde');
  end if;

  select valor into v_codigo from caixinha.config where chave = 'codigo_convite';
  if v_codigo is null or p_codigo is distinct from v_codigo then
    insert into caixinha.tentativas_convite (user_id) values (v_uid);
    return jsonb_build_object('ok', false, 'erro', 'Código de convite inválido');
  end if;

  if (select count(*) from caixinha.socios) >= 2 then
    return jsonb_build_object('ok', false, 'erro', 'A caixinha já tem 2 sócios');
  end if;

  insert into caixinha.socios (user_id, nome) values (v_uid, left(trim(p_nome), 80));
  if (select count(*) from caixinha.socios) >= 2 then
    delete from caixinha.config where chave = 'codigo_convite';  -- convite encerrado
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function caixinha.entrar_como_socio(text, text) from public, anon;
grant execute on function caixinha.entrar_como_socio(text, text) to authenticated;

-- Novo código de convite, mais longo (16 caracteres)
insert into caixinha.config (chave, valor)
values ('codigo_convite', substr(md5(random()::text || clock_timestamp()::text), 1, 8) || substr(md5(random()::text || clock_timestamp()::text), 1, 8))
on conflict (chave) do update set valor = excluded.valor;
