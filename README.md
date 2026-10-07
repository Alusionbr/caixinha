# Caixinha

App web (PWA) para controlar uma caixinha de investimento entre dois sócios: aportes semanais, mercadorias compradas e revendidas em partes, empréstimos com juros e evolução do patrimônio.

Os dados ficam no Supabase, num schema próprio chamado `caixinha`, separado das demais tabelas do projeto. O acesso é por e-mail e senha, liberado somente para os dois sócios.

## O que já funciona (Fase 1)

- Login com e-mail e senha e cadastro dos dois sócios com código de convite.
- **Início:** patrimônio total e sua composição, crescimento semanal, participação dos sócios e mercadorias pagas que ainda não chegaram.
- **Aportes:** semana de quarta a sexta, situação de cada sócio (pago, pendente, atrasado), atraso acumulado e histórico.
- **Mercadorias:** compra do lote, previsão e atraso de entrega, divisão em partes, venda de cada parte, lucro, ROI e tempo para o dinheiro voltar.
- **Livro-caixa:** todos os lançamentos, saldo, lançamento manual e estorno (nada é apagado).

Ainda não feito: empréstimos na tela (as tabelas e regras já existem no banco), tipo "Outros negócios", lembretes por WhatsApp, exportação e edição de regras pela tela. Veja `docs/ESTADO.md`.

## Como rodar

Precisa de Node 20 ou superior.

```bash
npm install
cp .env.example .env     # preencha com a URL e a chave pública do Supabase
npm run dev              # abre em http://localhost:5173
npm run build            # gera a pasta dist para publicar
```

A chave usada é a pública (`anon`/`publishable`). Ela pode ir para o navegador porque a segurança vem das políticas RLS do banco. Nunca coloque a chave `service_role` neste projeto.

## Banco de dados

Os scripts estão em `supabase/migrations/` e devem ser aplicados em ordem (`001`, `002`, `003`). Eles criam o schema `caixinha`, as tabelas, as políticas de segurança, as views de cálculo e as regras iniciais.

**Passo obrigatório no painel do Supabase:** em *Project Settings → API → Exposed schemas*, adicione `caixinha`. Sem isso o app não enxerga o schema.

### Primeiro acesso dos sócios

1. Cada sócio abre o app, clica em "Primeiro acesso? Criar conta" e cadastra e-mail e senha (confirme o e-mail se o Supabase pedir).
2. Depois do login, informa o nome e o **código de convite**.
3. O código está na tabela `caixinha.config`. Para consultar, no SQL Editor do Supabase:
   ```sql
   select valor from caixinha.config where chave = 'codigo_convite';
   ```
4. Só os dois primeiros sócios entram. Quem criar conta depois, sem ser sócio, não vê nenhum dado.

## Segurança

Leia `SECURITY.md`. Resumo: o app usa só a chave pública do Supabase e a proteção real são as políticas RLS do banco; nada de segredo vai para o git (hook `.githooks/pre-commit` e fluxo `Segurança` no GitHub). Ative o hook em cada clone:

```bash
git config core.hooksPath .githooks
```

## Publicação

O app é estático. Pode ser publicado na Vercel, Netlify ou GitHub Pages com `npm run build` e a pasta `dist`. Configure as duas variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no serviço de publicação.

## Estrutura

```
src/App.tsx              login, entrada dos sócios e navegação
src/paginas/             Painel, Aportes, Mercadorias, LivroCaixa
src/supabase.ts          cliente do Supabase (schema caixinha)
src/util.ts              formatação, datas e rótulos
supabase/migrations/     banco de dados (SQL em ordem)
docs/PLANO.md            regras do negócio, modelo de dados e fórmulas
docs/ESTADO.md           o que está feito, pendências e como continuar
```

## Regras de ouro do projeto

Quem for continuar o desenvolvimento, pessoa ou ferramenta, deve respeitar estas regras (detalhes em `docs/PLANO.md`):

- Saldo e patrimônio nunca são digitados; sempre calculados a partir de `movimentacoes`.
- Lançamentos não são apagados nem editados. Correção é estorno (`estorno_de` aponta para o original).
- Dinheiro sempre em `numeric(12,2)`, nunca decimal de ponto flutuante.
- Regras do negócio ficam na tabela `regras` com vigência. Regra nova encerra a antiga com `vigente_ate`.
- Tipo de investimento novo usa `investimentos.campos_extras` antes de virar tabela própria.
