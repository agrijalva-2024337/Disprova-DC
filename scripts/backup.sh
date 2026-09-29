#!/bin/sh
# Respaldo diario de PostgreSQL.
#
# Vive en un archivo aparte y no en el `entrypoint` del compose a propósito:
# Compose interpola las variables `$` del shell antes de pasárselas al
# contenedor, y un `$(date ...)` del script se pierde o se expande en el
# host. Con el script montado, el shell corre dentro del contenedor y las
# variables se comportan como corresponde.
#
# La sección 6 de la planificación pide "pg_dump programado" y "respaldo
# diario fuera del servidor": los archivos se escriben en un bind mount del
# host, no en el contenedor, para que sobrevivan a que éste se borre.

set -u

ARCHIVO_DIR=/backups
RETENCION_DIAS=${RETENCION_DIAS:-30}
HORA=${HORA_BACKUP:-0310}

mkdir -p "$ARCHIVO_DIR"

echo "Respaldo esperando las $HORA (hora de Guatemala, TZ=${TZ:-unset})."

while true; do
  ahora=$(date +%H%M)
  if [ "$ahora" = "$HORA" ]; then
    echo "[$(date -Iseconds)] Iniciando respaldo"
    destino="$ARCHIVO_DIR/disprova-$(date +%Y%m%d-%H%M%S).sql.gz"

    # `pg_dump | gzip` falla si se corta el pipe, y un .gz truncado parece
    # válido hasta que se intenta restaurar. Se usa un temporal y solo se
    # renombra si el dump terminó bien.
    temporal="$destino.parcial"
    if pg_dump --no-owner --no-acl | gzip > "$temporal"; then
      mv "$temporal" "$destino"
      tamano=$(du -h "$destino" | cut -f1)
      echo "[$(date -Iseconds)] OK: $destino ($tamano)"
    else
      echo "[$(date -Iseconds)] ERROR: el respaldo falló; se descarta" >&2
      rm -f "$temporal"
    fi

    # El respaldo de producción se copia a otro lado aparte. Este borrado solo
    # aplica a los archivos del contenedor.
    find "$ARCHIVO_DIR" -name 'disprova-*.sql.gz' -type f -mtime +"$RETENCION_DIAS" -delete
    echo "[$(date -Iseconds)] Respaldos de más de $RETENCION_DIAS días eliminados"
  fi
  sleep 60
done
