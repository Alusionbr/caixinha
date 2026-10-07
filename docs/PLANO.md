# Plano do app

Resumo das regras do negócio, da arquitetura e das fórmulas. O plano completo e ilustrado foi escrito no documento "Plano do App — Caixinha de Investimento".

## Regras atuais

| Regra | Valor |
| --- | --- |
| Sócios | 2 |
| Aporte semanal | R$ 200 por sócio (R$ 400 no total), de quarta a sexta |
| Atraso de aporte | Acumula para a semana seguinte, sem multa |
| Participação | Proporcional ao total aportado por cada sócio |
| Lucro | Fica na caixinha para reinvestir (regra pode mudar) |
| Lote de mercadoria | Custo de R$ 580, dividido em até 4 partes, cada uma vendida por preço livre |
| Empréstimos | Para terceiros e sócios; juros compostos de média 30% ao mês |
| Pagar só os juros | Permitido; o ciclo recomeça sobre o principal |
| Atraso de empréstimo | Mora de 2% ao dia, perdoável com justificativa registrada |

Todas as regras ficam na tabela `regras` com vigência (`vigente_de`, `vigente_ate`) e podem mudar sem alterar o código.

## Princípios

1. **Livro-caixa único.** Toda entrada e saída é uma linha em `movimentacoes`. Saldos e relatórios são calculados, nunca digitados.
2. **Sem apagar.** Correção é estorno: uma linha inversa com `estorno_de` apontando para a original, do mesmo tipo.
3. **Regras versionadas.** Regra nova encerra a antiga com `vigente_ate`.
4. **Investimentos plugáveis.** Mercadoria, empréstimo e outros compartilham a tabela `investimentos`; cada tipo acrescenta campos próprios. Negócio novo começa em `campos_extras`.

## Modelo de dados (schema `caixinha`)

| Tabela | Guarda |
| --- | --- |
| `socios` | Os sócios, ligados ao login do Supabase |
| `contas` | Onde o dinheiro está |
| `regras` | Regras com vigência |
| `semanas` | Ciclos de aporte (quarta a sexta) |
| `aportes` | Aporte de cada sócio |
| `investimentos` | Base de todo investimento |
| `mercadoria_lotes`, `mercadoria_fracoes` | Lote comprado e suas partes vendáveis |
| `emprestimos`, `emprestimo_parcelas` | Empréstimos, parcelas, mora e perdão |
| `movimentacoes` | Livro-caixa |
| `config` | Código de convite (inacessível pela API) |

Views de cálculo: `v_mov_calc`, `v_saldo_contas`, `v_resultado_investimento`, `v_composicao_patrimonio`, `v_patrimonio_atual`, `v_patrimonio_semanal`, `v_participacao_socios`.

## Fórmulas

- Patrimônio = caixa + capital ainda não recuperado em cada investimento aberto.
- Lucro do lote = soma das vendas − (custo + frete).
- Juros compostos: M = P × (1 + i)^n. Ao pagar os juros, n volta a zero.
- Mora = parcela × 0,02 × dias de atraso.
- ROI = (retornos − aplicado) / aplicado.
- Payback = dias entre a primeira saída de dinheiro e a data em que as entradas acumuladas igualam o valor aplicado.
- Rentabilidade mensal = (1 + ROI)^(30 / dias) − 1.

## Tipos de movimentação

`aporte`, `compra_mercadoria`, `frete`, `venda`, `emprestimo_saida`, `emprestimo_recebimento`, `juros`, `multa`, `retirada`, `ajuste`, `estorno`, `outro_investimento`, `outro_retorno`.

O saldo inicial anterior ao app entra como `ajuste` de entrada na data de início.
