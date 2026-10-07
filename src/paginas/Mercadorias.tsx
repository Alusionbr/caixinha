import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { brl, dataBR, diasEntre, hojeISO, msgErro, pct } from '../util'

type Fracao = {
  id: string; descricao: string | null; preco_desejado: number | null; preco_venda: number | null
  comprador: string | null; vendido_em: string | null
}
type Lote = {
  investimento_id: string; fornecedor: string | null; custo: number; frete: number; pago_em: string
  previsao_entrega: string | null; recebido_em: string | null; qtd_fracoes: number
  mercadoria_fracoes: Fracao[]
}
type Inv = { id: string; nome: string; status: string; mercadoria_lotes: Lote | null }
type Resultado = { id: string; lucro: number; roi: number | null; payback_dias: number | null; em_recuperacao: boolean; recuperado_pct: number | null }

async function contaPadrao() {
  const r = await supabase.from('contas').select('id').eq('ativa', true).order('nome').limit(1).single()
  if (r.error) throw r.error
  return (r.data as { id: string }).id
}

function FormLote({ aoSalvar }: { aoSalvar: () => void }) {
  const [nome, setNome] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [custo, setCusto] = useState('580')
  const [frete, setFrete] = useState('0')
  const [pagoEm, setPagoEm] = useState(hojeISO())
  const [previsao, setPrevisao] = useState('')
  const [partes, setPartes] = useState('4')
  const [desejado, setDesejado] = useState('')
  const [erro, setErro] = useState('')

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    try {
      const c = Number(custo.replace(',', '.'))
      const f = Number(frete.replace(',', '.') || 0)
      const n = Number(partes)
      const d = desejado ? Number(desejado.replace(',', '.')) : null
      if (!(c > 0)) throw new Error('Informe o custo do lote')
      const conta = await contaPadrao()
      const inv = await supabase.from('investimentos')
        .insert({ tipo: 'mercadoria', nome, status: 'pago', valor_aplicado: c + f, aplicado_em: pagoEm })
        .select('id').single()
      if (inv.error) throw inv.error
      const id = (inv.data as { id: string }).id
      const lote = await supabase.from('mercadoria_lotes').insert({
        investimento_id: id, fornecedor: fornecedor || null, custo: c, frete: f, pago_em: pagoEm,
        previsao_entrega: previsao || null, qtd_fracoes: n,
      })
      if (lote.error) throw lote.error
      const fr = await supabase.from('mercadoria_fracoes').insert(
        Array.from({ length: n }, (_, i) => ({ lote_id: id, descricao: `Parte ${i + 1}`, preco_desejado: d })),
      )
      if (fr.error) throw fr.error
      const movs = [{ data: pagoEm, tipo: 'compra_mercadoria', sentido: 'saida', valor: c, conta_id: conta, investimento_id: id, descricao: `Compra: ${nome}` }]
      if (f > 0) movs.push({ data: pagoEm, tipo: 'frete', sentido: 'saida', valor: f, conta_id: conta, investimento_id: id, descricao: `Frete: ${nome}` })
      const mv = await supabase.from('movimentacoes').insert(movs)
      if (mv.error) throw mv.error
      setNome(''); setFornecedor(''); setPrevisao(''); setDesejado('')
      aoSalvar()
    } catch (err) {
      setErro(msgErro(err))
    }
  }

  return (
    <form className="bloco coluna" onSubmit={salvar}>
      <h2 style={{ margin: 0 }}>Nova mercadoria comprada</h2>
      <label>Produto<input value={nome} onChange={e => setNome(e.target.value)} required /></label>
      <label>Fornecedor<input value={fornecedor} onChange={e => setFornecedor(e.target.value)} /></label>
      <div className="duas">
        <label>Custo (R$)<input inputMode="decimal" value={custo} onChange={e => setCusto(e.target.value)} required /></label>
        <label>Frete (R$)<input inputMode="decimal" value={frete} onChange={e => setFrete(e.target.value)} /></label>
      </div>
      <div className="duas">
        <label>Pago em<input type="date" value={pagoEm} onChange={e => setPagoEm(e.target.value)} required /></label>
        <label>Previsão de entrega<input type="date" value={previsao} onChange={e => setPrevisao(e.target.value)} /></label>
      </div>
      <div className="duas">
        <label>Dividir em quantas partes<input type="number" min={1} max={50} value={partes} onChange={e => setPartes(e.target.value)} required /></label>
        <label>Preço desejado por parte<input inputMode="decimal" value={desejado} onChange={e => setDesejado(e.target.value)} /></label>
      </div>
      {erro && <p className="erro">{erro}</p>}
      <button>Salvar compra</button>
    </form>
  )
}

function Fracao({ f, invId, aoMudar }: { f: Fracao; invId: string; aoMudar: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [preco, setPreco] = useState(f.preco_desejado ? String(f.preco_desejado) : '')
  const [comprador, setComprador] = useState('')
  const [erro, setErro] = useState('')

  async function vender(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    try {
      const p = Number(preco.replace(',', '.'))
      if (!(p > 0)) throw new Error('Informe o preço da venda')
      const hoje = hojeISO()
      const up = await supabase.from('mercadoria_fracoes')
        .update({ preco_venda: p, comprador: comprador || null, vendido_em: hoje, recebido: true, recebido_em: hoje })
        .eq('id', f.id)
      if (up.error) throw up.error
      const mv = await supabase.from('movimentacoes').insert({
        data: hoje, tipo: 'venda', sentido: 'entrada', valor: p, conta_id: await contaPadrao(),
        investimento_id: invId, descricao: `Venda: ${f.descricao ?? 'parte'}${comprador ? ' para ' + comprador : ''}`,
      })
      if (mv.error) throw mv.error
      aoMudar()
    } catch (err) {
      setErro(msgErro(err))
    }
  }

  if (f.vendido_em) {
    return (
      <div className="linha">
        <span>{f.descricao} · {dataBR(f.vendido_em)}{f.comprador ? ` · ${f.comprador}` : ''}</span>
        <span className="etiqueta">vendida {brl(f.preco_venda)}</span>
      </div>
    )
  }
  return (
    <div className="linha" style={{ display: 'block' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{f.descricao}{f.preco_desejado ? ` · desejado ${brl(f.preco_desejado)}` : ''}</span>
        <button className="sec pequeno" onClick={() => setAberto(!aberto)}>{aberto ? 'Fechar' : 'Vender'}</button>
      </div>
      {aberto && (
        <form className="coluna" style={{ marginTop: 8 }} onSubmit={vender}>
          <div className="duas">
            <label>Preço (R$)<input inputMode="decimal" value={preco} onChange={e => setPreco(e.target.value)} required /></label>
            <label>Comprador<input value={comprador} onChange={e => setComprador(e.target.value)} /></label>
          </div>
          {erro && <p className="erro">{erro}</p>}
          <button>Confirmar venda</button>
        </form>
      )}
    </div>
  )
}

export default function Mercadorias() {
  const [itens, setItens] = useState<Inv[]>([])
  const [res, setRes] = useState<Record<string, Resultado>>({})
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    try {
      const [i, r] = await Promise.all([
        supabase.from('investimentos')
          .select('id,nome,status,mercadoria_lotes(*,mercadoria_fracoes(*))')
          .eq('tipo', 'mercadoria').order('aplicado_em', { ascending: false }),
        supabase.from('v_resultado_investimento').select('id,lucro,roi,payback_dias,em_recuperacao,recuperado_pct').eq('tipo', 'mercadoria'),
      ])
      if (i.error) throw i.error
      if (r.error) throw r.error
      setItens((i.data ?? []) as unknown as Inv[])
      setRes(Object.fromEntries(((r.data ?? []) as Resultado[]).map(x => [x.id, x])))
    } catch (e) {
      setErro(msgErro(e))
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function receber(inv: Inv) {
    try {
      const a = await supabase.from('mercadoria_lotes').update({ recebido_em: hojeISO() }).eq('investimento_id', inv.id)
      if (a.error) throw a.error
      const b = await supabase.from('investimentos').update({ status: 'em venda' }).eq('id', inv.id)
      if (b.error) throw b.error
      carregar()
    } catch (e) {
      setErro(msgErro(e))
    }
  }

  async function aposVenda(inv: Inv) {
    // Marca o lote como vendido quando todas as partes foram vendidas
    const fr = await supabase.from('mercadoria_fracoes').select('vendido_em').eq('lote_id', inv.id)
    if (!fr.error && (fr.data ?? []).every(x => (x as { vendido_em: string | null }).vendido_em)) {
      await supabase.from('investimentos').update({ status: 'vendido' }).eq('id', inv.id)
    }
    carregar()
  }

  return (
    <div className="coluna">
      {erro && <p className="erro">{erro}</p>}
      <FormLote aoSalvar={carregar} />
      {itens.map(inv => {
        const l = inv.mercadoria_lotes
        const r = res[inv.id]
        const atraso = l && !l.recebido_em && l.previsao_entrega ? diasEntre(l.previsao_entrega, hojeISO()) : 0
        const vendidas = l?.mercadoria_fracoes.filter(f => f.vendido_em).length ?? 0
        return (
          <div className="bloco" key={inv.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <strong>{inv.nome}</strong>
                <div className="rotulo">
                  {l ? `Custo ${brl(Number(l.custo) + Number(l.frete))} · paga em ${dataBR(l.pago_em)}` : ''}
                </div>
              </div>
              <span className={`etiqueta ${atraso > 0 ? 'atraso' : !l?.recebido_em ? 'espera' : ''}`}>
                {!l?.recebido_em ? (atraso > 0 ? `${atraso} dia(s) de atraso` : 'em trânsito') : `${vendidas}/${l.mercadoria_fracoes.length} vendidas`}
              </span>
            </div>
            {r && (
              <p className="rotulo">
                Lucro {brl(r.lucro)} · ROI {r.roi === null ? '—' : pct(r.roi)} ·{' '}
                {r.em_recuperacao ? `recuperado ${pct(r.recuperado_pct)}` : `dinheiro voltou em ${r.payback_dias ?? 0} dia(s)`}
              </p>
            )}
            {l && !l.recebido_em && <button className="sec" onClick={() => receber(inv)}>Marcar como recebida</button>}
            {l?.recebido_em && l.mercadoria_fracoes.map(f => <Fracao key={f.id} f={f} invId={inv.id} aoMudar={() => aposVenda(inv)} />)}
          </div>
        )
      })}
    </div>
  )
}
