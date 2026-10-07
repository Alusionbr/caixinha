import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { brl, dataBR, diasEntre, hojeISO, msgErro, pct } from '../util'

type Comp = { componente: string; valor: number }
type Sem = { semana_inicio: string; caixa: number; capital_aplicado: number; patrimonio: number }
type Part = { id: string; nome: string; total_aportado: number; participacao: number | null }
type LotePendente = {
  investimento_id: string
  previsao_entrega: string | null
  pago_em: string
  investimentos: { nome: string } | null
}

const nomeComp: Record<string, string> = {
  caixa: 'Dinheiro em caixa',
  mercadoria: 'Mercadoria (a custo)',
  emprestimo: 'Empréstimos a receber',
  outro: 'Outros negócios',
}

export default function Painel() {
  const [patrimonio, setPatrimonio] = useState(0)
  const [comp, setComp] = useState<Comp[]>([])
  const [semanas, setSemanas] = useState<Sem[]>([])
  const [socios, setSocios] = useState<Part[]>([])
  const [pendentes, setPendentes] = useState<LotePendente[]>([])
  const [erro, setErro] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const [a, b, c, d, e] = await Promise.all([
          supabase.from('v_patrimonio_atual').select('patrimonio').maybeSingle(),
          supabase.from('v_composicao_patrimonio').select('componente,valor'),
          supabase.from('v_patrimonio_semanal').select('*').order('semana_inicio'),
          supabase.from('v_participacao_socios').select('*'),
          supabase.from('mercadoria_lotes').select('investimento_id,previsao_entrega,pago_em,investimentos(nome)').is('recebido_em', null),
        ])
        for (const r of [a, b, c, d, e]) if (r.error) throw r.error
        setPatrimonio(Number((a.data as { patrimonio: number } | null)?.patrimonio ?? 0))
        setComp((b.data ?? []) as Comp[])
        setSemanas((c.data ?? []) as Sem[])
        setSocios((d.data ?? []) as Part[])
        setPendentes((e.data ?? []) as unknown as LotePendente[])
      } catch (err) {
        setErro(msgErro(err))
      }
    })()
  }, [])

  const maximo = Math.max(1, ...semanas.map(s => Number(s.patrimonio)))
  const ultimas = semanas.slice(-8)

  return (
    <div className="coluna">
      {erro && <p className="erro">{erro}</p>}
      <div className="bloco">
        <div className="rotulo">Patrimônio da caixinha</div>
        <div className="numero">{brl(patrimonio)}</div>
        <p className="rotulo">Mercadoria e empréstimos entram pelo valor investido; o lucro aparece quando o dinheiro volta.</p>
      </div>

      <div className="grade">
        {comp.map(c => (
          <div className="bloco" key={c.componente}>
            <div className="rotulo">{nomeComp[c.componente] ?? c.componente}</div>
            <div className="numero" style={{ fontSize: '1.2rem' }}>{brl(c.valor)}</div>
          </div>
        ))}
      </div>

      {pendentes.length > 0 && (
        <div className="bloco">
          <h2 style={{ marginTop: 0 }}>Mercadorias pagas que ainda não chegaram</h2>
          {pendentes.map(l => {
            const atraso = l.previsao_entrega ? diasEntre(l.previsao_entrega, hojeISO()) : null
            return (
              <div className="linha" key={l.investimento_id}>
                <div>
                  <div>{l.investimentos?.nome ?? 'Lote'}</div>
                  <div className="rotulo">Paga em {dataBR(l.pago_em)} · previsão {dataBR(l.previsao_entrega)}</div>
                </div>
                {atraso !== null && atraso > 0
                  ? <span className="etiqueta atraso">{atraso} dia(s) de atraso</span>
                  : <span className="etiqueta espera">em trânsito</span>}
              </div>
            )
          })}
        </div>
      )}

      <div className="bloco">
        <h2 style={{ marginTop: 0 }}>Crescimento semanal</h2>
        {ultimas.length === 0 && <p className="suave">Ainda não há lançamentos.</p>}
        <div className="barras">
          {ultimas.map(s => (
            <div className="barra" key={s.semana_inicio}>
              <span>{dataBR(s.semana_inicio).slice(0, 5)}</span>
              <div className="trilho"><div className="preenche" style={{ width: `${(Number(s.patrimonio) / maximo) * 100}%` }} /></div>
              <span>{brl(s.patrimonio)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bloco">
        <h2 style={{ marginTop: 0 }}>Participação dos sócios</h2>
        {socios.map(s => (
          <div className="linha" key={s.id}>
            <span>{s.nome}</span>
            <span>{brl(s.total_aportado)} · {pct(s.participacao)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
