const mysql = require("mysql2/promise");

class DBLoader {
  constructor(config) {
    this.pool = mysql.createPool(config);

    this.data = {
      falla: 0,
      bomba: 0,
      automatico: 0,
      estanque: 0,
      estanque_2: 0,
      caudal: 0,
      freatico: 0,
      presion: 0,
      horometro_total: 0,
      horometro_diario: 0,
      totalizador_total: 0,
      totalizador_diario: 0,
      lastUpdate: null,
    };
  }

  async query(sql, params = []) {
    let connection;
    try {
      connection = await this.pool.getConnection();
      const [rows] = await connection.query(sql, params);
      return rows;
    } finally {
      if (connection) connection.release();
    }
  }

  formatDateRange(date) {
    return [`${date} 00:00:00`, `${date} 23:59:59`];
  }

  async getLastSnapshot() {
    const sql = `
      SELECT mt_name, mt_value, mt_time_2
      FROM (
        SELECT *,
               ROW_NUMBER() OVER (PARTITION BY mt_name ORDER BY mt_time_2 DESC) AS rn
        FROM ssr_zuniga
      ) AS x
      WHERE rn = 1;
    `;

    try {
      const rows = await this.query(sql);
      if (!rows.length) throw new Error("La tabla ssr_zuniga está vacía.");

      Object.keys(this.data).forEach((k) => {
        if (!k.includes("diario") && k !== "lastUpdate") this.data[k] = 0;
      });

      let newestTime = null;

      for (const { mt_name, mt_value, mt_time_2 } of rows) {
        const key = mt_name.split(".").pop();

        switch (key) {
          case "horometro":
            this.data.horometro_total = Number(mt_value);
            break;
          case "totalizador":
            this.data.totalizador_total = Number(mt_value);
            break;
          default:
            if (key in this.data) this.data[key] = Number(mt_value);
            break;
        }

        if (!newestTime || mt_time_2 > newestTime) {
          newestTime = mt_time_2;
        }
      }

      this.data.lastUpdate = newestTime;
      const fecha = newestTime.toLocaleDateString("sv-SE");

      this.data.horometro_diario = await this.computeDailyValue(
        "SSR_ZUNIGA--slave.horometro",
        fecha,
        this.data.horometro_total,
        "horómetro"
      );
      this.data.totalizador_diario = await this.computeDailyValue(
        "SSR_ZUNIGA--slave.totalizador",
        fecha,
        this.data.totalizador_total,
        "totalizador"
      );

      return this.data;
    } catch (err) {
      console.error("Error en getLastSnapshot:", err.message);
      throw new Error("Error al consultar la base de datos");
    }
  }

  async computeDailyValue(mtName, fecha, totalActual, label) {
    const sql = `
      SELECT mt_value
      FROM ssr_zuniga
      WHERE mt_name = ?
        AND mt_time_2 BETWEEN ? AND ?
      ORDER BY mt_time_2 ASC
      LIMIT 1;
    `;

    const [inicio, fin] = this.formatDateRange(fecha);
    const rows = await this.query(sql, [mtName, inicio, fin]);
    if (!rows.length)
      throw new Error(`Sin lecturas de ${label} para ${fecha}.`);

    const inicial = Number(rows[0].mt_value);
    return totalActual - inicial;
  }

  async computeGraphData(mtName, fechaInicio, fechaFin, labelError) {
    const sql = `
      SELECT mt_value, mt_time_2
      FROM ssr_zuniga
      WHERE mt_name = ?
        AND mt_time_2 BETWEEN ? AND ?
      ORDER BY mt_time_2 ASC;
    `;

    const [inicio, fin] = this.formatDateRange(fechaInicio);
    const rows = await this.query(sql, [mtName, inicio, fin]);

    if (!rows.length) throw new Error(labelError);

    return rows.map(({ mt_value, mt_time_2 }) => ({
      value: Number(mt_value),
      time: mt_time_2,
    }));
  }

  getNivelEstanqueData(fi, ff) {
    return this.computeGraphData(
      "SSR_ZUNIGA--slave.estanque",
      fi,
      ff,
      `No hay datos de nivel de estanque entre ${fi} y ${ff}.`
    );
  }

  getNivelEstanque2Data(fi, ff) {
    return this.computeGraphData(
      "SSR_ZUNIGA--slave.estanque_2",
      fi,
      ff,
      `No hay datos de nivel de estanque 2 entre ${fi} y ${ff}.`
    );
  }

  getCaudalData(fi, ff) {
    return this.computeGraphData(
      "SSR_ZUNIGA--slave.caudal",
      fi,
      ff,
      `No hay datos de caudal entre ${fi} y ${ff}.`
    );
  }

  async computeDailyDiff(mtName, fechaInicio, fechaFin) {
    const sql = `
    WITH datos_con_orden AS (
      SELECT
        CAST(mt_time_2 AS DATE) AS fecha,
        mt_value,
        ROW_NUMBER() OVER (
          PARTITION BY CAST(mt_time_2 AS DATE)
          ORDER BY mt_time_2 ASC
        ) AS rn_asc,
        ROW_NUMBER() OVER (
          PARTITION BY CAST(mt_time_2 AS DATE)
          ORDER BY mt_time_2 DESC
        ) AS rn_desc
      FROM
        ssr_zuniga
      WHERE
        mt_name = ?
        AND mt_time_2 BETWEEN ? AND ?
    )
    SELECT
      p.fecha,
      ABS(u.mt_value - p.mt_value) AS diferencia_absoluta
    FROM
      datos_con_orden p
    JOIN datos_con_orden u 
      ON p.fecha = u.fecha
    WHERE
      p.rn_asc = 1
      AND u.rn_desc = 1
    ORDER BY
      p.fecha;
  `;

    const inicio = new Date(fechaInicio);
    inicio.setHours(0, 0, 0, 0);

    const fin = new Date(fechaFin);
    fin.setHours(23, 59, 59, 999);

    const formatDateTime = (date) =>
      date.toISOString().slice(0, 19).replace("T", " ");

    const inicioStr = formatDateTime(inicio);
    const finStr = formatDateTime(fin);

    const rows = await this.query(sql, [mtName, inicioStr, finStr]);

    return rows.map((row) => ({
      key: row.fecha.toISOString().split("T")[0],
      value: parseFloat(row.diferencia_absoluta.toFixed(2)),
    }));
  }

  getHorometroData(fi, ff) {
    return this.computeDailyDiff("SSR_ZUNIGA--slave.horometro", fi, ff);
  }

  getTotalizadorData(fi, ff) {
    return this.computeDailyDiff("SSR_ZUNIGA--slave.totalizador", fi, ff);
  }

  async getEmptyingTimeEstanque() {
    const sql = `
      SELECT mt_value, mt_time_2
      FROM ssr_zuniga
      WHERE mt_name = 'SSR_ZUNIGA--slave.estanque'
      ORDER BY mt_time_2 DESC
      LIMIT 2;
    `;

    const rows = await this.query(sql);
    if (rows.length < 2) throw new Error("INSUFICIENT_DATA");

    const [prev, curr] = [rows[1], rows[0]];
    const nivel1 = parseFloat(prev.mt_value);
    const nivel2 = parseFloat(curr.mt_value);

    if (isNaN(nivel1) || isNaN(nivel2)) throw new Error("INVALID_MEASUREMENTS");

    return this.estimateEmptyingTime(
      nivel1,
      prev.mt_time_2,
      nivel2,
      curr.mt_time_2
    );
  }

  estimateEmptyingTime(level1, timestamp1, level2, timestamp2) {
    if (level1 <= level2) return 0;

    const deltaTimeSeconds = Math.abs(
      (new Date(timestamp2) - new Date(timestamp1)) / 1000
    );
    if (deltaTimeSeconds === 0) return NaN;

    const lossRate = (level1 - level2) / deltaTimeSeconds;
    return level2 / lossRate;
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = DBLoader;
