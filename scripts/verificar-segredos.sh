#!/usr/bin/env bash
# Procura chaves, senhas e dados sensíveis nos arquivos que vão para o git.
# Uso manual:   scripts/verificar-segredos.sh          (arquivos preparados para commit)
#               scripts/verificar-segredos.sh --tudo   (todos os arquivos rastreados)
# É chamado automaticamente pelo hook .githooks/pre-commit.
set -u

if [ "${1:-}" = "--tudo" ]; then
  arquivos=$(git ls-files)
else
  arquivos=$(git diff --cached --name-only --diff-filter=ACM)
fi

[ -z "$arquivos" ] && exit 0

# Arquivos que nunca devem ser versionados
proibidos=$(echo "$arquivos" | grep -E '(^|/)\.env($|\.)|\.pem$|\.key$|\.p12$|\.pfx$|id_rsa|credentials|serviceAccount' | grep -v '\.env\.example$')
if [ -n "$proibidos" ]; then
  echo "BLOQUEADO: arquivo sensível não pode ser versionado:"
  echo "$proibidos"
  exit 1
fi

padroes='sb_secret_[A-Za-z0-9_-]{10,}|sb_publishable_[A-Za-z0-9_-]{10,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}|postgres(ql)?://[^ :]+:[^ @]+@|service_role[^A-Za-z_]{1,6}(eyJ|sb_)|(api[_-]?key|secret|token|senha|password)["'"'"' ]*[:=]["'"'"' ]*[A-Za-z0-9/+_-]{16,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|[a-z]{20}\.supabase\.co'

achou=0
for f in $arquivos; do
  [ -f "$f" ] || continue
  case "$f" in package-lock.json|scripts/verificar-segredos.sh) continue ;; esac
  if grep -InE "$padroes" "$f" >/tmp/achados.$$ 2>/dev/null; then
    echo "BLOQUEADO: possível segredo em $f"
    sed 's/^/   /' /tmp/achados.$$ | cut -c1-140
    achou=1
  fi
done
rm -f /tmp/achados.$$

if [ "$achou" -eq 1 ]; then
  echo
  echo "Se for falso positivo, revise o trecho. Se for segredo real, remova e troque a chave no Supabase."
  exit 1
fi
exit 0
