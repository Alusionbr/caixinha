import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { brl, dataBR, hojeISO, msgErro, rotuloTipo, sentidoPadrao } from '../util'
import type { Tipo } from '../util'

type Mov = {
  id: string; data: string; tipo: Tipo; sentido: 'entrada' | 'saida'; valor: number
  conta_id: string; investimento_id: string | null; socio_id: string | null; descricao: string | null; estorno_de: string | null
}

// Tipos que o usuário pode lançar à mão (compras e vendas de mercadoria têm tela própria)
const tiposManuais: Tipo[] = ['aporte', 'retirada', 'ajuste', 'juros', 'multa', 'emprestimo_saida', 'emprestimo_recebimento', 'outro_investimento', 'outro_retorno']

export default function LivroCaixa() {
  const [movs, setMovs] = useState<Mov[]>([])
  const [saldo, setSaldo] = useState(0)
  const [tipo, setTipo] = useState<Tipo>('ajuste')
  const [sentido, setSentido] = useState<'entrada' | 'saida'>('entrada')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(hojeISO())
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    try {
      const [m, s] = await Promise.all([
        supabase.from('movimentacoes').select('*').order('data', { ascending: false }).order('criado_em', { ascending: false }).limit(100),
        supabase.from('v_saldo_contas').select('saldo'),
      ])
      if (m.error) throw m.error
      if (s.error) throw s.error
      setMovs((m.data ?? []) as Mov[])
      setSaldo((s.data ?? []).reduce((t, x) => t + Number((x as { saldo: number }).saldo), 0))
    } catch (e) {
      setErro(msgErro(e))
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { const p = sentidoPadrao[tipo]; if (p) setSentido(p) }, [tipo])

  async function conta() {
    const r = await supabase.from('contas').select('id').eq('ativa', true).order('nome').limit(1).single()
    if (r.error) throw r.error
    return (r.data as { id: string }).id
  }

  async function lancar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    try {
      const v = Number(valor.replace(',', '.'))
      if (!(v > 0)) throw new Error('Informe um valor maior que zero')
      const r = await supabase.from('movimentacoes').insert({ data, tipo, sentido, valor: v, conta_id: await conta(), descricao: descricao || null })
      if (r.error) throw r.error
      setValor(''); setDescricao('')
      carregar()
    } catch (err) {
      setErro(msgErro(err))
    }
  }

  // Lançamentos nunca são apagados: a correção é um lançamento inverso ligado ao original
  async function estornar(m: Mov) {
    if (!confirm(`Estornar "${rotuloTipo[m.tipo]}" de ${brl(m.valor)}?`)) return
    try {
      const r = await supabase.from('movimentacoes').insert({
        data: hojeISO(), tipo: m.tipo, sentido: m.sentido === 'entrada' ? 'saida' : 'entrada', valor: m.valor,
        conta_id: m.conta_id, investimento_id: m.investimento_id, socio_id: m.socio_id,
        descricao: `Estorno de ${dataBR(m.data)}${m.descricao ? ': ' + m.descricao : ''}`, estorno_de: m.id,
      })
      if (r.error) throw r.error
      carregar()
    } catch (err) {
      setErro(msgErro(err))
    }
  }

  const estornados = new Set(movs.filter(m => m.estorno_de).map(m => m.estorno_de))

  return (
    <div className="coluna">
      {erro && <p className="erro">{erro}</p>}
      <div className="bloco">
        <div className="rotulo">Saldo em caixa</div>
        <div className="numero">{brl(saldo)}</div>
        <p className="rotulo">Para registrar o valor que a caixinha já tinha antes do app, lance um <strong>Ajuste</strong> de entrada na data de início.</p>
      </div>

      <form className="bloco coluna" onSubmit={lancar}>
        <h2 style={{ margin: 0 }}>Novo lançamento</h2>
        <div className="duas">
          <label>Tipo
            <select value={tipo} onChange={e => setTipo(e.target.value as Tipo)}>
              {tiposManuais.map(t => <option key={t} value={t}>{rotuloTipo[t]}</option>)}
            </select>
          </label>
          <label>Sentido
            <select value={sentido} onChange={e => setSentido(e.target.value as 'entrada' | 'saida')} disabled={Boolean(sentidoPadrao[tipo])}>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
          </label>
        </div>
        <div className="duas">
          <label>Valor (R$)<input inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} required /></label>
          <label>Data<input type="date" value={data} onChange={e => setData(e.target.value)} required /></label>
        </div>
        <label>Descrição<input value={descricao} onChange={e => setDescricao(e.target.value)} /></label>
        <button>Lançar</button>
      </form>

      <div className="bloco">
        <h2 style={{ marginTop: 0 }}>Últimos lançamentos</h2>
        {movs.map(m => (
          <div className="linha" key={m.id}>
            <div>
              <div>{rotuloTipo[m.tipo]}{m.estorno_de ? ' (estorno)' : ''}</div>
              <div className="rotulo">{dataBR(m.data)}{m.descricao ? ` · ${m.descricao}` : ''}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className={m.sentido === 'entrada' ? 'ok' : 'erro'}>{m.sentido === 'entrada' ? '+' : '−'}{brl(m.valor)}</div>
              {!m.estorno_de && !estornados.has(m.id) && <button className="link pequeno" onClick={() => estornar(m)}>Estornar</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
