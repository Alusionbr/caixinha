import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { configurado, supabase } from './supabase'
import { msgErro } from './util'
import Painel from './paginas/Painel'
import Aportes from './paginas/Aportes'
import Mercadorias from './paginas/Mercadorias'
import LivroCaixa from './paginas/LivroCaixa'

export type Socio = { id: string; nome: string; user_id: string }

type Aba = 'painel' | 'aportes' | 'mercadorias' | 'livro'
const abas: { id: Aba; nome: string }[] = [
  { id: 'painel', nome: 'Início' },
  { id: 'aportes', nome: 'Aportes' },
  { id: 'mercadorias', nome: 'Mercadorias' },
  { id: 'livro', nome: 'Livro-caixa' },
]

function Acesso() {
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setAviso(''); setCarregando(true)
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password: senha })
        if (error) throw error
        if (!data.session) setAviso('Conta criada. Confirme o e-mail que você recebeu e depois entre.')
      }
    } catch (err) {
      setErro(msgErro(err))
    } finally {
      setCarregando(false)
    }
  }

  return (
    <main className="centro">
      <form className="cartao" onSubmit={enviar}>
        <h1>Caixinha</h1>
        <p className="suave">{modo === 'entrar' ? 'Entre com seu e-mail e senha.' : 'Crie seu acesso de sócio.'}</p>
        <label>E-mail<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></label>
        <label>Senha<input type="password" value={senha} onChange={e => setSenha(e.target.value)} required minLength={6} autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} /></label>
        {erro && <p className="erro">{erro}</p>}
        {aviso && <p className="ok">{aviso}</p>}
        <button disabled={carregando}>{modo === 'entrar' ? 'Entrar' : 'Criar conta'}</button>
        <button type="button" className="link" onClick={() => { setModo(modo === 'entrar' ? 'criar' : 'entrar'); setErro(''); setAviso('') }}>
          {modo === 'entrar' ? 'Primeiro acesso? Criar conta' : 'Já tenho conta'}
        </button>
      </form>
    </main>
  )
}

function EntrarComoSocio({ aoEntrar }: { aoEntrar: () => void }) {
  const [nome, setNome] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    const { data, error } = await supabase.rpc('entrar_como_socio', { p_nome: nome, p_codigo: codigo.trim() })
    // A função devolve { ok, erro }; erros inesperados vêm em "error"
    const resposta = data as { ok?: boolean; erro?: string } | null
    if (error) setErro(error.message)
    else if (resposta && resposta.ok === false) setErro(resposta.erro ?? 'Não foi possível entrar')
    else aoEntrar()
  }

  return (
    <main className="centro">
      <form className="cartao" onSubmit={enviar}>
        <h1>Quase lá</h1>
        <p className="suave">Informe seu nome e o código de convite da caixinha. Só os dois sócios têm acesso.</p>
        <label>Seu nome<input value={nome} onChange={e => setNome(e.target.value)} required /></label>
        <label>Código de convite<input value={codigo} onChange={e => setCodigo(e.target.value)} required /></label>
        {erro && <p className="erro">{erro}</p>}
        <button>Confirmar</button>
        <button type="button" className="link" onClick={() => supabase.auth.signOut()}>Sair</button>
      </form>
    </main>
  )
}

export default function App() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined)
  const [socio, setSocio] = useState<Socio | null | undefined>(undefined)
  const [aba, setAba] = useState<Aba>('painel')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data } = supabase.auth.onAuthStateChange((_ev, s) => setSessao(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const carregarSocio = useCallback(async () => {
    const { data } = await supabase.from('socios').select('id,nome,user_id').maybeSingle()
    setSocio((data as Socio | null) ?? null)
  }, [])

  useEffect(() => {
    if (sessao) carregarSocio()
    else setSocio(undefined)
  }, [sessao, carregarSocio])

  if (!configurado) {
    return (
      <main className="centro">
        <div className="cartao">
          <h1>Configuração pendente</h1>
          <p>Crie o arquivo <code>.env</code> com <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>. Veja o README.</p>
        </div>
      </main>
    )
  }

  if (sessao === undefined) return <main className="centro"><p className="suave">Carregando…</p></main>
  if (!sessao) return <Acesso />
  if (socio === undefined) return <main className="centro"><p className="suave">Carregando…</p></main>
  if (!socio) return <EntrarComoSocio aoEntrar={carregarSocio} />

  return (
    <div className="app">
      <header className="topo">
        <strong>Caixinha</strong>
        <span className="suave">Olá, {socio.nome}</span>
        <button className="link" onClick={() => supabase.auth.signOut()}>Sair</button>
      </header>
      <main className="conteudo">
        {aba === 'painel' && <Painel />}
        {aba === 'aportes' && <Aportes socio={socio} />}
        {aba === 'mercadorias' && <Mercadorias />}
        {aba === 'livro' && <LivroCaixa />}
      </main>
      <nav className="abas">
        {abas.map(a => (
          <button key={a.id} className={aba === a.id ? 'ativa' : ''} onClick={() => setAba(a.id)}>{a.nome}</button>
        ))}
      </nav>
    </div>
  )
}
