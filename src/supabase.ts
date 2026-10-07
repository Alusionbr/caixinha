import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configurado = Boolean(url && chave)

// Todas as tabelas do app ficam no schema "caixinha", isolado das demais do projeto.
export const supabase = createClient(url ?? 'http://localhost', chave ?? 'sem-chave', {
  db: { schema: 'caixinha' },
})
