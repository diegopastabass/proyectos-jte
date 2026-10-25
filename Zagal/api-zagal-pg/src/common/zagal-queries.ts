// SQL compartido por las parcelas 18, 57 y 82.
// Los nombres de tabla y el prefijo vienen de constantes del código (nunca del
// request), por eso se interpolan; los valores van siempre como parámetros.
//
// Todas las consultas sobre parc_XX_zagal dependen de los índices
// (mt_name, mt_time_2 DESC) INCLUDE (mt_value) y (mt_time_2 DESC):
// ver sql/001_indices_mt_time_2.sql

export interface ZagalTables {
  /** Tabla cruda de telemetría, ej. parc_18_zagal */
  raw: string;
  /** Log de riegos (lo llena el trigger update_zagal_XX_interval), ej. zagal_18_irrigation_log */
  log: string;
  /** Prefijo de las variables, ej. PARC_18_ZAGAL--slave */
  prefix: string;
}

// Último valor de cada variable en $1 (text[]). Un "LIMIT 1" por variable
// sobre el índice, en vez de un DISTINCT ON que recorre todo el historial.
export const latestValuesSql = (raw: string) => `
  SELECT n.mt_name, l.mt_value
  FROM unnest($1::text[]) AS n(mt_name)
  CROSS JOIN LATERAL (
    SELECT p.mt_value
    FROM ${raw} p
    WHERE p.mt_name = n.mt_name
    ORDER BY p.mt_time_2 DESC
    LIMIT 1
  ) l
`;

// Último valor de todas las variables existentes. Recorre los nombres
// distintos saltando por el índice (loose index scan) en vez de leer la tabla.
export const latestAllValuesSql = (raw: string) => `
  WITH RECURSIVE nombres AS (
    (SELECT mt_name FROM ${raw} ORDER BY mt_name LIMIT 1)
    UNION ALL
    SELECT (
      SELECT p.mt_name FROM ${raw} p
      WHERE p.mt_name > n.mt_name
      ORDER BY p.mt_name
      LIMIT 1
    )
    FROM nombres n
    WHERE n.mt_name IS NOT NULL
  )
  SELECT n.mt_name, l.mt_value
  FROM nombres n
  CROSS JOIN LATERAL (
    SELECT p.mt_value
    FROM ${raw} p
    WHERE p.mt_name = n.mt_name
    ORDER BY p.mt_time_2 DESC
    LIMIT 1
  ) l
  WHERE n.mt_name IS NOT NULL
`;

// Resumen diario por sector: segundos de riego, totalizador repartido entre
// los sectores activos y caudal promedio.
//
// En lugar de cruzar cada muestra contra cada intervalo (BETWEEN), se arma por
// sector una línea de tiempo con los bordes de los intervalos (+1 al inicio,
// -1 al fin) y las muestras; una suma acumulada indica si el sector estaba
// regando en cada muestra y el último inicio identifica a qué intervalo (y día)
// pertenece. Los bordes son inclusivos, igual que BETWEEN.
//
// Cada métrica se agrega por (sector, día) antes de unir, de modo que varios
// riegos en el mismo día no multiplican las filas (la versión anterior sumaba
// el tiempo N veces y el totalizador N² veces).
export const dailySummarySql = ({ raw, log, prefix }: ZagalTables) => `
  WITH intervalos AS (
    SELECT mt_name,
           start_time AS inicio,
           COALESCE(end_time, CURRENT_TIMESTAMP) AS fin
    FROM ${log}
    WHERE start_time >= $1::timestamp
      AND start_time < $2::timestamp + INTERVAL '1 day'
  ),
  tiempos AS (
    SELECT mt_name, inicio::date AS date,
           SUM(EXTRACT(EPOCH FROM (fin - inicio))) AS value
    FROM intervalos
    GROUP BY mt_name, inicio::date
  ),
  sectores AS (
    SELECT DISTINCT mt_name FROM intervalos
  ),
  bordes AS (
    SELECT mt_name, inicio AS ts, 0 AS ord, 1 AS paso, inicio AS inicio_evt
    FROM intervalos WHERE fin >= inicio
    UNION ALL
    SELECT mt_name, fin, 2, -1, NULL
    FROM intervalos WHERE fin >= inicio
  ),
  totalizador_increments AS (
    -- Los incrementos en 0 no aportan a la suma: se descartan para aliviar el cruce
    SELECT ROW_NUMBER() OVER () AS inc_id, mt_time_2, delta
    FROM (
      SELECT mt_time_2,
             NULLIF(mt_value, '')::numeric
               - LAG(NULLIF(mt_value, '')::numeric) OVER (ORDER BY mt_time_2) AS delta
      FROM ${raw}
      WHERE mt_name = '${prefix}.totalizador'
        AND mt_time_2 BETWEEN $1::timestamp AND $2::timestamp + INTERVAL '1 day'
    ) s
    WHERE delta > 0
  ),
  tot_estado AS (
    SELECT mt_name, ord, inc_id, delta,
           SUM(paso) OVER w AS abiertos,
           MAX(inicio_evt) OVER w AS ultimo_inicio
    FROM (
      SELECT mt_name, ts, ord, paso, inicio_evt, NULL::bigint AS inc_id, NULL::numeric AS delta
      FROM bordes
      UNION ALL
      SELECT s.mt_name, t.mt_time_2, 1, 0, NULL, t.inc_id, t.delta
      FROM totalizador_increments t CROSS JOIN sectores s
    ) e
    WINDOW w AS (PARTITION BY mt_name ORDER BY ts, ord ROWS UNBOUNDED PRECEDING)
  ),
  tot_por_dia AS (
    SELECT mt_name, date, SUM(delta_por_sector) AS totalizador
    FROM (
      SELECT mt_name, ultimo_inicio::date AS date,
             delta / COUNT(*) OVER (PARTITION BY inc_id) AS delta_por_sector
      FROM tot_estado
      WHERE ord = 1 AND abiertos > 0
    ) a
    GROUP BY mt_name, date
  ),
  caudal_muestras AS (
    SELECT mt_time_2, NULLIF(mt_value, '')::numeric AS caudal
    FROM ${raw}
    WHERE mt_name = '${prefix}.caudal'
      AND mt_time_2 >= (SELECT MIN(inicio) FROM intervalos)
      AND mt_time_2 <= (SELECT MAX(fin) FROM intervalos)::timestamp
  ),
  caudal_estado AS (
    SELECT mt_name, ord, caudal,
           SUM(paso) OVER w AS abiertos,
           MAX(inicio_evt) OVER w AS ultimo_inicio
    FROM (
      SELECT mt_name, ts, ord, paso, inicio_evt, NULL::numeric AS caudal
      FROM bordes
      UNION ALL
      SELECT s.mt_name, c.mt_time_2, 1, 0, NULL, c.caudal
      FROM caudal_muestras c CROSS JOIN sectores s
    ) e
    WINDOW w AS (PARTITION BY mt_name ORDER BY ts, ord ROWS UNBOUNDED PRECEDING)
  ),
  caudal_por_dia AS (
    -- Promedio de los promedios de cada riego del día (mismo criterio que antes)
    SELECT mt_name, ultimo_inicio::date AS date, AVG(caudal) AS caudal
    FROM (
      SELECT mt_name, ultimo_inicio, AVG(caudal) AS caudal
      FROM caudal_estado
      WHERE ord = 1 AND abiertos > 0
      GROUP BY mt_name, ultimo_inicio
    ) i
    GROUP BY mt_name, ultimo_inicio::date
  )
  SELECT t.mt_name, t.date, t.value,
         COALESCE(tt.totalizador, 0) AS totalizador,
         COALESCE(c.caudal, 0) AS caudal
  FROM tiempos t
  LEFT JOIN tot_por_dia tt USING (mt_name, date)
  LEFT JOIN caudal_por_dia c USING (mt_name, date)
  ORDER BY t.mt_name, t.date
`;
