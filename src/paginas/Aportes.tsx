import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import type { Socio } from '../App'
import { brl, dataBR, hojeISO, inicioSemana, msgErro, somaDias } from '../util'

type SocioLista = { id: string; nome: string }
type Aporte = { id: string; socio_id: string; valor: number; pago_em: string; extra: boolean; semana_id: string | null }
type Semana = { id: string; inicio: string; fim: string; valor_esperado: number }

export default function Aportes({ socio }: { socio: Socio }) {
  const [socios, setSocios] = useState<SocioLista[]>([])
  const [aportes, setAportes] = useState<Aporte[]>([])
  const [semanas, setSemanas] = useState<Semana[]>([])
  const [valorPadrao, setValorPadrao] = useState(200)
  const [socioForm, setSocioForm] = useState(socio.id)
  const [valor, setValor] = useState('200')
  const [data, setData] = useState(hojeISO())
  const [extra, setExtra] = useState(false)
  const [erro, setErro] = useState('')
  const hoje = hojeISO()

  const carregar = useCallback(async () => {
    try {
      const regra = await supabase.from('regras').select('parametros').eq('chave', 'aporte_semanal').is('vigente_ate', null).maybeSingle()
      const esperado = Number((regra.data as { parametros: { valor_por_socio?: number } } | null)?.parametros?.valor_por_socio ?? 200)
      setValorPadrao(esperado)

      // Garante que existam as semanas desde a primeira registrada até a atual
      const atual = inicioSemana(hoje)
      const existentes = await supabase.from('semanas').select('inicio').order('inicio')
      if (existentes.error) throw existentes.error
      const inicios = new Set((existentes.data ?? []).map(s => (s as { inicio: string }).inicio))
      const primeira = (existentes.data?.[0] as { inicio: string } | undefined)?.inicio ?? atual
      const faltando: { inicio: string; fim: string; valor_esperado: number }[] = []
      for (let i = primeira; i <= atual; i = somaDias(i, 7)) {
        if (!inicios.has(i)) faltando.push({ inicio: i, fim: somaDias(i, 2), valor_esperado: esperado })
      }
      if (faltando.length) {
        const ins = await supabase.from('semanas').insert(faltando)
        if (ins.error) throw ins.error
      }

      const [s, a, w] = await Promise.all([
        supabase.from('socios').select('id,nome').order('criado_em'),
        supabase.from('aportes').select('*').order('pago_em', { ascending: false }),
        supabase.from('semanas').select('*').order('inicio', { ascending: false }),
      ])
      for (const r of [s, a, w]) if (r.error) throw r.error
      setSocios((s.data ?? []) as SocioLista[])
      setAportes((a.data ?? []) as Aporte[])
      setSemanas((w.data ?? []) as Semana[])
    } catch (e) {
      setErro(msgErro(e))
    }
  }, [hoje])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { setValor(String(valorPadrao)) }, [valorPadrao])

  async function registrar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    try {
      const v = Number(valor.replace(',', '.'))
      if (!(v > 0)) throw new Error('Informe um valor maior que zero')
      const sem = semanas.find(s => s.inicio === inicioSemana(data))
      const conta = await supabase.from('contas').select('id').eq('ativa', true).order('nome').limit(1).single()
      if (conta.error) throw conta.error
      const ap = await supabase.from('aportes').insert({
        socio_id: socioForm, valor: v, pago_em: data, extra, semana_id: extra ? null : sem?.id ?? null,
      })
      if (ap.error) throw ap.error
      const mov = await supabase.from('movimentacoes').insert({
        data, tipo: 'aporte', sentido: 'entrada', valor: v, conta_id: (conta.data as { id: string }).id,
        socio_id: socioForm, descricao: extra ? 'Aporte extra' : 'Aporte semanal',
      })
      if (mov.error) throw mov.error
      await carregar()
    } catch (err) {
      setErro(msgErro(err))
    }
  }

  // Situação de cada sócio: aportes regulares recebidos x total devido até a semana atual
  const situacao = socios.map(s => {
    const regulares = aportes.filter(a => a.socio_id === s.id && !a.extra)
    const pago = regulares.reduce((t, a) => t + Number(a.valor), 0)
    const devido = semanas.reduce((t, w) => t + Number(w.valor_esperado), 0)
    const atual = semanas.find(w => w.inicio === inicioSemana(hoje))
    const pagoAtual = atual ? regulares.filter(a => inicioSemana(a.pago_em) === atual.inicio).reduce((t, a) => t + Number(a.valor), 0) : 0
    const prazoPassou = atual ? hoje > atual.fim : false
    const emAberto = Math.max(0, devido - pago - (prazoPassou ? 0 : Number(atual?.valor_esperado ?? 0) - pagoAtual))
    return { s, pago, devido, pagoAtual, esperadoAtual: Number(atual?.valor_esperado ?? valorPadrao), prazoPassou, emAberto }
  })
  const atual = semanas.find(w => w.inicio === inicioSemana(hoje))

  return (
    <div className="coluna">
      {erro && <p className="erro">{erro}</p>}
      <div className="bloco">
        <h2 style={{ marginTop: 0 }}>Semana atual</h2>
        <p className="rotulo">{atual ? `Quarta ${dataBR(atual.inicio)} a sexta ${dataBR(atual.fim)}` : '—'} · {brl(valorPadrao)} por sócio</p>
        {situacao.map(x => {
          const pago = x.pagoAtual >= x.esperadoAtual
          return (
            <div className="linha" key={x.s.id}>
              <div>
                <div>{x.s.nome}</div>
                {x.emAberto > 0 && <div className="rotulo alerta">Em atraso acumulado: {brl(x.emAberto)}</div>}
              </div>
              {pago
                ? <span className="etiqueta">pago</span>
                : x.prazoPassou ? <span className="etiqueta atraso">atrasado</span> : <span className="etiqueta espera">pendente</span>}
            </div>
          )
        })}
      </div>

      <form className="bloco coluna" onSubmit={registrar}>
        <h2 style={{ margin: 0 }}>Registrar aporte</h2>
        <label>Sócio
          <select value={socioForm} onChange={e => setSocioForm(e.target.value)}>
            {socios.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </label>
        <div className="duas">
          <label>Valor (R$)<input inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} required /></label>
          <label>Data<input type="date" value={data} onChange={e => setData(e.target.value)} required /></label>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={extra} onChange={e => setExtra(e.target.checked)} />
          Aporte extra (fora do compromisso semanal)
        </label>
        <button>Registrar</button>
      </form>

      <div className="bloco">
        <h2 style={{ marginTop: 0 }}>Histórico</h2>
        {aportes.length === 0 && <p className="suave">Nenhum aporte registrado.</p>}
        {aportes.slice(0, 30).map(a => (
          <div className="linha" key={a.id}>
            <span>{socios.find(s => s.id === a.socio_id)?.nome ?? '—'} · {dataBR(a.pago_em)}{a.extra ? ' · extra' : ''}</span>
            <span>{brl(a.valor)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
