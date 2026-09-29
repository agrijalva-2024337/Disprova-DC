#!/bin/sh
# Restaura un respaldo de Disprova y PRUEBA que el archivo esté bueno.
#
# Un respaldo que nunca se restauró no es un respaldo: puede estar truncado o
# completo y aun así ser inútil. Este script restaura de verdad en una base
# temporal y cuenta filas, para que quede constancia de que el último archivo
# se pudo recuperar.
#
# No depende de Python ni de nada instalado fuera de Docker.
#
# Uso:
#   sh scripts/verify_backup.sh                       # lista los respaldos
#   sh scripts/verify_backup.sh <archivo.sql.gz>      # restaura y verifica
#
# Nunca toca la base real: crea `disprova_restore_check`, restaura ahí,
# cuenta filas y la elimina. Para restaurar sobre producción hay que hacerlo
# a mano, con el servicio de respaldo detenido.

set -e

CONTENEDOR=disprova-postgres
USUARIO=disprova
BASE_PRUEBA=disprova_restore_check
CARPETA_BACKUPS=backups

# Tablas cuyo conteo demuestra que los datos financiero e de inventario están.
# Si estas vuelven con filas, el respaldo sirve.
TABLAS="clients orders order_items account_movements payments inventory_movements stock cash_sessions"

listar() {
  if [ ! -d "$CARPETA_BACKUPS" ]; then
    echo "No existe la carpeta $CARPETA_BACKUPS"
    exit 1
  fi
  total=$(ls -1 "$CARPETA_BACKUPS"/disprova-*.sql.gz 2>/dev/null | wc -l)
  if [ "$total" -eq 0 ]; then
    echo "No hay respaldos en $CARPETA_BACKUPS"
    echo "Levantá el servicio de respaldo con: docker compose up -d backup"
    exit 1
  fi
  echo "Respaldos en $CARPETA_BACKUPS:"
  ls -lht "$CARPETA_BACKUPS"/disprova-*.sql.gz
}

verificar() {
  archivo=$1
  if [ ! -f "$archivo" ]; then
    echo "No existe el archivo $archivo"
    exit 1
  fi

  echo ""
  echo "1. Recreando la base de prueba $BASE_PRUEBA…"
  docker exec "$CONTENEDOR" dropdb -U "$USUARIO" --if-exists --force "$BASE_PRUEBA"
  docker exec "$CONTENEDOR" createdb -U "$USUARIO" "$BASE_PRUEBA"

  echo "2. Restaurando $(basename "$archivo")…"
  # Se copia adentro del contenedor y se descomprime ahí. Redireccionar el
  # gunzip desde PowerShell rompe el UTF-8 y la restauración falla con
  # "invalid byte sequence for encoding UTF8".
  docker cp "$archivo" "$CONTENEDOR:/tmp/verificar.sql.gz"
  docker exec "$CONTENEDOR" sh -c \
    "gunzip -c /tmp/verificar.sql.gz | psql -U $USUARIO -d $BASE_PRUEBA -q -v ON_ERROR_STOP=1"

  echo "3. Contando filas…"
  echo ""
  for tabla in $TABLAS; do
    conteo=$(docker exec "$CONTENEDOR" psql -U "$USUARIO" -d "$BASE_PRUEBA" -t -A \
      -c "SELECT count(*) FROM $tabla;")
    printf "  %-22s %10s\n" "$tabla" "$conteo"
    TOTAL_FILAS=$((TOTAL_FILAS + conteo))
  done

  echo ""
  echo "4. Eliminando la base de prueba…"
  docker exec "$CONTENEDOR" dropdb -U "$USUARIO" --if-exists --force "$BASE_PRUEBA"
  docker exec "$CONTENEDOR" rm -f /tmp/verificar.sql.gz

  if [ "$TOTAL_FILAS" -eq 0 ]; then
    echo ""
    echo "FALLO: la base restaurada no tiene ninguna fila. Revisá el respaldo."
    exit 1
  fi

  echo ""
  echo "OK: respaldo restaurable. $TOTAL_FILAS filas en total."
  echo "La base real NO se tocó."
}

TOTAL_FILAS=0

if [ -z "$1" ]; then
  listar
else
  verificar "$1"
fi
