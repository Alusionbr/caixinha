# Segurança

Este app guarda dados financeiros de dois sócios. Esta página explica como o projeto se protege e o que fazer em caso de problema.

## Como a proteção funciona

- **A segurança está no banco, não no navegador.** O app usa apenas a chave pública do Supabase (`anon`/`publishable`), que por desenho aparece no código que vai para o navegador. O que impede alguém de ler ou alterar os dados são as políticas RLS: só um usuário que é sócio ativo enxerga qualquer tabela do schema `caixinha`.
- **Nenhuma chave secreta no projeto.** A chave `service_role`, senhas do banco e tokens nunca devem entrar neste repositório nem no app.
- **Arquivos sensíveis fora do git.** `.env` e similares estão no `.gitignore`. O hook `.githooks/pre-commit` e o fluxo `Segurança` do GitHub bloqueiam chaves, senhas e arquivos de credencial.
- **Livro-caixa imutável.** Lançamentos não são editados nem apagados; correção é estorno.
- **Acesso restrito a dois sócios.** O cadastro exige um código de convite e aceita no máximo 2 sócios.
- **Política de segurança do navegador (CSP).** O build só permite scripts do próprio app e conexões com o Supabase.

## Antes de começar a desenvolver

Ative o hook de verificação (uma vez por clone):

```bash
git config core.hooksPath .githooks
```

Para varrer tudo manualmente: `scripts/verificar-segredos.sh --tudo`.

## O que nunca fazer

- Commitar `.env`, chaves `service_role`, senhas, tokens ou exportações de dados reais.
- Colocar a chave `service_role` em variáveis `VITE_*`, pois tudo que começa com `VITE_` vai para o navegador.
- Desativar o RLS de qualquer tabela do schema `caixinha`.
- Colar dados reais (valores, nomes de devedores) em issues, commits ou documentação.

## Se uma chave vazar

1. No Supabase, em *Project Settings → API*, gere uma nova chave e desative a antiga.
2. Atualize os segredos do GitHub (`VITE_SUPABASE_ANON_KEY`) e o arquivo `.env` local.
3. Remova a chave do histórico do git se ela foi commitada (reescrita de histórico) e considere o repositório comprometido até lá.
4. Se for o código de convite: `update caixinha.config set valor = '<novo>' where chave = 'codigo_convite';`

## Configurações do GitHub recomendadas

Em *Settings* do repositório:

- **General → Danger Zone → Change visibility:** deixar o repositório **privado**.
- **Code security:** ativar *Secret scanning*, *Push protection*, *Dependabot alerts* e *Dependabot security updates*.
- **Branches:** proteger a `main` (exigir pull request e que o fluxo `Segurança` passe).
- **Autenticação em dois fatores** ativada na conta.

## Configurações do Supabase recomendadas

- *Authentication → Policies (Password security):* ativar a proteção contra senhas vazadas e exigir senha de no mínimo 8 caracteres.
- *Authentication → Providers → Email:* manter a confirmação de e-mail ligada.
- *Authentication → Rate limits:* manter os limites padrão.
- Ativar autenticação em dois fatores na conta do Supabase.
