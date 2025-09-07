const express = require("express");
const router = express.Router();
const DBLoader = require("../db/dbLoader");

const db = new DBLoader({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

function validarFechas(req, res, next) {
  const { fechaInicio, fechaFin } = req.query;
  if (!fechaInicio || !fechaFin) {
    return res.status(400).json({
      error: "Debes proporcionar fechaInicio y fechaFin (YYYY-MM-DD).",
    });
  }
  next();
}

router.get("/snapshot", async (req, res) => {
  try {
    const data = await db.getLastSnapshot();
    res.json(data);
  } catch (error) {
    console.error("Error en /snapshot:", error.message);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

router.get("/caudal", validarFechas, async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const data = await db.getCaudalData(fechaInicio, fechaFin);
    res.json(data);
  } catch (error) {
    console.error("Error en /caudal:", error.message);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

router.get("/nivelestanque1", validarFechas, async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const data = await db.getNivelEstanqueData(fechaInicio, fechaFin);
    res.json(data);
  } catch (error) {
    console.error("Error en /nivelestanque1:", error.message);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

router.get("/nivelestanque2", validarFechas, async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const data = await db.getNivelEstanque2Data(fechaInicio, fechaFin);
    res.json(data);
  } catch (error) {
    console.error("Error en /nivelestanque2:", error.message);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

router.get("/horometro", validarFechas, async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const data = await db.getHorometroData(fechaInicio, fechaFin);
    res.json(data);
  } catch (error) {
    console.error("Error en /horometro:", error.message);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

router.get("/totalizador", validarFechas, async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const data = await db.getTotalizadorData(fechaInicio, fechaFin);
    res.json(data);
  } catch (error) {
    console.error("Error en /totalizador:", error.message);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

router.get("/estanque", async (req, res) => {
  try {
    const tiempoEstimado = await db.getEmptyingTimeEstanque();

    if (isNaN(tiempoEstimado)) {
      return res
        .status(404)
        .json({ error: "No se pudo estimar el tiempo de vaciado." });
    }

    res.json({
      tiempoVaciadoSegundos: tiempoEstimado,
      tiempoVaciado: formatSecondsToHHMMSS(tiempoEstimado),
    });
  } catch (error) {
    console.error("Error en /estanque:", error.message);

    const errores = {
      INSUFICIENT_DATA: {
        status: 404,
        msg: "Datos insuficientes. Se requieren al menos 2 mediciones.",
      },
      INVALID_MEASUREMENTS: {
        status: 400,
        msg: "Mediciones inválidas. Los valores deben ser numéricos.",
      },
      DATABASE_ERROR: {
        status: 500,
        msg: "Error al consultar la base de datos",
      },
    };

    const errResp = errores[error.message] || {
      status: 500,
      msg: "Error interno del servidor",
    };

    res.status(errResp.status).json({ error: errResp.msg });
  }
});

router.get("/dashboard", validarFechas, async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;

    const [snapshot, caudal, nivel1, nivel2, horometro, totalizador, estanque] =
      await Promise.all([
        db.getLastSnapshot(),
        db.getCaudalData(fechaInicio, fechaFin),
        db.getNivelEstanqueData(fechaInicio, fechaFin),
        db.getNivelEstanque2Data(fechaInicio, fechaFin),
        db.getHorometroData(fechaInicio, fechaFin),
        db.getTotalizadorData(fechaInicio, fechaFin),
        db.getEmptyingTimeEstanque(),
      ]);

    res.json({
      snapshot,
      caudal,
      nivel1,
      nivel2,
      horometro,
      totalizador,
      estanque: {
        tiempoVaciadoSegundos: estanque,
        tiempoVaciado: formatSecondsToHHMMSS(estanque),
      },
    });
  } catch (error) {
    console.error("Error en /dashboard:", error.message);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

function formatSecondsToHHMMSS(seconds) {
  if (seconds === 0) return "00:00:00";
  if (isNaN(seconds) || !isFinite(seconds)) return "N/A";

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const pad = (n) => n.toString().padStart(2, "0");
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

module.exports = router;
