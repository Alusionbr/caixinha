# Estado do projeto

Atualize este arquivo ao final de cada sessão de trabalho. Quem for continuar deve ler primeiro `README.md`, depois `docs/PLANO.md` e por fim este arquivo.

Última atualização: 07/10/2026

## Decisões tomadas

- Hospedagem dos dados: schema `caixinha` dentro do projeto Supabase `quant-futebol`, porque o plano gratuito só permite 2 projetos. As tabelas do outro projeto não foram alteradas.
- Front-end: React + Vite + TypeScript, PWA, mobile primeiro.
- Aporte: R$ 200 por sócio por semana (R$ 400 no total), quarta a sexta. Atraso acumula, sem multa.
- Participação no patrimônio: proporcional ao total aportado por cada sócio.
- Lucro: fica na caixinha para reinvestir (regra editável, tabela `regras`, chave `destino_lucro`).
- Empréstimos: para terceiros e para os sócios; juros compostos de média 30% ao mês; o tomador pode pagar os juros e reiniciar a cobrança sobre o principal; mora de 2% ao dia, perdoável com justificativa registrada.
- Patrimônio: critério conservador. Mercadoria e empréstimos entram pelo valor ainda não recuperado; o lucro só aparece quando o dinheiro volta.

## Feito

- [x] Banco: tabelas, RLS, views de cálculo, função de entrada dos sócios, regras iniciais (`supabase/migrations/001` e `002`).
- [x] Cálculos validados com o exemplo do lote de R$ 580 dividido em 4 partes de R$ 190: lucro R$ 180, ROI 31%, dinheiro volta em 4 dias, patrimônio fecha certo semana a semana.
- [x] Telas: login, entrada dos sócios, Início, Aportes, Mercadorias, Livro-caixa.
- [x] Build de produção sem erros.

## Pendente

- [ ] Liberar o schema `caixinha` em *Settings → API → Exposed schemas* no Supabase (ação manual, obrigatória).
- [ ] Os dois sócios criarem conta e informarem o código de convite.
- [ ] Informar o valor já arrecadado e a data de início da caixinha, e lançar como `Ajuste` de entrada no livro-caixa.
- [ ] Publicar o app (Vercel, Netlify ou GitHub Pages) com as variáveis de ambiente.
- [ ] Fase 2: tela de empréstimos (cadastro, juros compostos, pagar só os juros e reiniciar, mora de 2% ao dia, perdão com justificativa), payback e ROI por tipo.
- [ ] Fase 3: lembretes (quarta de manhã e sexta à tarde), alertas de parcela vencendo, exportação em PDF e planilha.
- [ ] Fase 4: tipo "Outro negócio" com campos personalizados e edição das regras pela tela.

## Pontos de atenção

- O plano gratuito do Supabase pausa projetos sem uso por um período. Se o app parar de responder, reative o projeto no painel.
- Os alertas de segurança do Supabase mostram um aviso sobre a função `public.fin_account_overview`. Ela pertence ao outro projeto e não tem relação com a caixinha.
- A função `entrar_como_socio` vive no schema `caixinha` e só funciona depois que o schema for exposto na API.
- Para trocar o código de convite: `update caixinha.config set valor = 'novo-codigo' where chave = 'codigo_convite';`

## Como retomar com outra ferramenta

Ao abrir uma nova sessão, forneça: este repositório, o `docs/PLANO.md` e o acesso ao projeto Supabase. Diga qual fase seguir (a próxima é a Fase 2) e peça para respeitar as "Regras de ouro" do README. Todo texto do app, comentários e documentação ficam em português.
