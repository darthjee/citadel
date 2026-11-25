#!/usr/bin/env bash
#
# sync-code-sample.sh — copia os arquivos referenciados em orgs/code-sample-*.md
# do projeto ward para orgs/code_sample/, preservando o layout original.
#
# Requer bash 4+.

set -euo pipefail

WARD_ROOT=""
ORGS_DIR=""
CLEAN=0
DRY_RUN=0

usage() {
  cat <<'USAGE'
Uso: sync-code-sample.sh [OPÇÕES] <ward-root> [orgs-dir]

  <ward-root>    Raiz do projeto ward (diretório que contém backend/ e frontend/).
  [orgs-dir]     Pasta orgs. Padrão: <dir-do-script>/orgs

Opções:
  -c, --clean      Apaga orgs/code_sample/ antes de copiar.
  -n, --dry-run    Mostra o que seria copiado, sem tocar no disco.
  -h, --help       Esta ajuda.

O script lê os links no formato ./code_sample/<caminho> dentro de
orgs/code-sample-*.md, recria a árvore de diretórios em orgs/ e copia cada
arquivo a partir da raiz do ward.
USAGE
}

# ---------------------------------------------------------------- argumentos
while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help)    usage; exit 0 ;;
    -c|--clean)   CLEAN=1; shift ;;
    -n|--dry-run) DRY_RUN=1; shift ;;
    --)           shift; break ;;
    -*)           echo "Opção desconhecida: $1" >&2; usage >&2; exit 2 ;;
    *)
      if   [ -z "$WARD_ROOT" ]; then WARD_ROOT="$1"
      elif [ -z "$ORGS_DIR" ];  then ORGS_DIR="$1"
      else echo "Argumentos demais: $1" >&2; exit 2
      fi
      shift ;;
  esac
done

# ---------------------------------------------------------------- validação
[ -n "$WARD_ROOT" ] || { usage >&2; exit 2; }
[ -d "$WARD_ROOT" ] || { echo "ERRO: raiz do ward não encontrada: $WARD_ROOT" >&2; exit 2; }

if [ -z "$ORGS_DIR" ]; then
  SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
  ORGS_DIR="$SCRIPT_DIR/orgs"
fi
[ -d "$ORGS_DIR" ] || { echo "ERRO: pasta orgs não encontrada: $ORGS_DIR" >&2; exit 2; }

WARD_ROOT="$(cd -- "$WARD_ROOT" && pwd)"
ORGS_DIR="$(cd -- "$ORGS_DIR"  && pwd)"

shopt -s nullglob
MD_FILES=("$ORGS_DIR"/code-sample-*.md)
shopt -u nullglob

if [ ${#MD_FILES[@]} -eq 0 ]; then
  echo "ERRO: nenhum code-sample-*.md em $ORGS_DIR" >&2
  exit 2
fi

echo "ward  : $WARD_ROOT"
echo "orgs  : $ORGS_DIR"
echo "fontes: ${#MD_FILES[@]} arquivo(s) markdown"
echo

# ---------------------------------------------------------------- extração
# Captura ./code_sample/<caminho> dentro dos links markdown.
PATTERN='\./code_sample/[A-Za-z0-9._/@+-]+'

mapfile -t PATHS < <(
  grep -ohE "$PATTERN" "${MD_FILES[@]}" 2>/dev/null \
    | sed 's|^\./||' \
    | sed 's|[.,;:]*$||' \
    | sort -u
)

if [ ${#PATHS[@]} -eq 0 ]; then
  echo "ERRO: nenhum caminho ./code_sample/... encontrado nos markdown." >&2
  exit 2
fi

echo "Caminhos únicos encontrados: ${#PATHS[@]}"
echo

if [ "$CLEAN" -eq 1 ] && [ "$DRY_RUN" -eq 0 ]; then
  echo "Limpando $ORGS_DIR/code_sample ..."
  rm -rf -- "$ORGS_DIR/code_sample"
  echo
fi

# ---------------------------------------------------------------- cópia
COPIED=0
DIRS=0
MISSING=()

for P in "${PATHS[@]}"; do
  REL="${P#code_sample/}"          # caminho dentro do repo ward
  SRC="$WARD_ROOT/$REL"
  DST="$ORGS_DIR/$P"               # destino sob orgs/code_sample/...

  # Diretório (links terminam em "/")
  if [ -d "$SRC" ]; then
    if [ "$DRY_RUN" -eq 1 ]; then
      printf '[dry] dir   %s\n' "$REL"
    else
      mkdir -p -- "$DST"
      cp -a -- "$SRC"/. "$DST"/
      printf 'dir   %s\n' "$REL"
    fi
    DIRS=$((DIRS + 1))
    continue
  fi

  # Arquivo inexistente no ward
  if [ ! -f "$SRC" ]; then
    MISSING+=("$REL")
    printf 'FALTA %s\n' "$REL" >&2
    continue
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry] file  %s\n' "$REL"
  else
    mkdir -p -- "$(dirname -- "$DST")"
    cp -a -- "$SRC" "$DST"
    printf 'file  %s\n' "$REL"
  fi
  COPIED=$((COPIED + 1))
done

# ---------------------------------------------------------------- resumo
echo
echo "-----------------------------------------------"
echo "Arquivos copiados   : $COPIED"
echo "Diretórios copiados : $DIRS"
echo "Ausentes no ward    : ${#MISSING[@]}"

if [ "$DRY_RUN" -eq 0 ] && [ -d "$ORGS_DIR/code_sample" ]; then
  TOTAL=$(find "$ORGS_DIR/code_sample" -type f | wc -l | tr -d ' ')
  echo "Total no espelho    : $TOTAL arquivo(s)"
fi

if [ ${#MISSING[@]} -gt 0 ]; then
  echo
  echo "Caminhos linkados mas inexistentes no ward:"
  printf '  - %s\n' "${MISSING[@]}"
  echo
  echo "Isso indica link errado no markdown — o script funciona como validador."
  exit 1
fi

exit 0
