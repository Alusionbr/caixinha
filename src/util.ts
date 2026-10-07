export const brl = (n: number | string | null | undefined) =>
  Number(n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const pct = (n: number | string | null | undefined) =>
  (Number(n ?? 0) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%'

export const hojeISO = () => {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${dia}`
}

// Datas ISO (AAAA-MM-DD) tratadas ao meio-dia para evitar erro de fuso horário
const paraData = (iso: string) => new Date(iso + 'T12:00:00')
const paraISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const dataBR = (iso: string | null | undefined) =>
  iso ? paraData(iso).toLocaleDateString('pt-BR') : '—'

export const somaDias = (iso: string, dias: number) => {
  const d = paraData(iso)
  d.setDate(d.getDate() + dias)
  return paraISO(d)
}

export const diasEntre = (de: string, ate: string) =>
  Math.round((paraData(ate).getTime() - paraData(de).getTime()) / 86400000)

// A semana da caixinha começa na quarta-feira e o prazo do aporte é a sexta.
export const inicioSemana = (iso: string) => {
  const dow = paraData(iso).getDay() // 0 = domingo ... 3 = quarta
  return somaDias(iso, -((dow - 3 + 7) % 7))
}

export type Tipo =
  | 'aporte' | 'compra_mercadoria' | 'frete' | 'venda' | 'emprestimo_saida'
  | 'emprestimo_recebimento' | 'juros' | 'multa' | 'retirada' | 'ajuste'
  | 'estorno' | 'outro_investimento' | 'outro_retorno'

export const rotuloTipo: Record<Tipo, string> = {
  aporte: 'Aporte',
  compra_mercadoria: 'Compra de mercadoria',
  frete: 'Frete',
  venda: 'Venda',
  emprestimo_saida: 'Empréstimo concedido',
  emprestimo_recebimento: 'Recebimento de empréstimo',
  juros: 'Juros',
  multa: 'Multa/mora',
  retirada: 'Retirada',
  ajuste: 'Ajuste',
  estorno: 'Estorno',
  outro_investimento: 'Outro investimento',
  outro_retorno: 'Retorno de outro investimento',
}

// Sentido padrão de cada tipo (ajuste e estorno são escolhidos na hora)
export const sentidoPadrao: Partial<Record<Tipo, 'entrada' | 'saida'>> = {
  aporte: 'entrada', venda: 'entrada', emprestimo_recebimento: 'entrada',
  juros: 'entrada', multa: 'entrada', outro_retorno: 'entrada',
  compra_mercadoria: 'saida', frete: 'saida', emprestimo_saida: 'saida',
  outro_investimento: 'saida', retirada: 'saida',
}

export const msgErro = (e: unknown) =>
  e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Erro inesperado'
