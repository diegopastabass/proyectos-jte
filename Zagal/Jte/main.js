// main.js
const PARCELS = {
  18: { key: "parc_18_zagal", json: "./zagal18.json" },
  57: { key: "parc_57_zagal", json: "./zagal57.json" },
  82: { key: "parc_82_zagal", json: "./zagal82.json" },
};

const mapInstances = {};
const summaryIntervals = {};
const parcelState = {};

// --- Utilidades ---
function formatTime(seconds) {
  if (seconds === undefined || seconds === null) return "--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = (seconds % 60).toFixed(2);
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0) parts.push(`${m}m`);;
  return parts.join(" ");
}

const navigateTo = (url) => (window.location.href = url);


async function initDashboard() {
  const urlActive = "https://app.jteanalytics.cl/zagal/active";

  try {
    const promises = [
      fetch(urlActive).then((r) => r.json()),
      fetch(PARCELS[18].json).then((r) => r.json()),
      fetch(PARCELS[57].json).then((r) => r.json()),
      fetch(PARCELS[82].json).then((r) => r.json()),
    ];

    const [activeData, geo18, geo57, geo82] = await Promise.all(promises);

    const geoDataMap = { 18: geo18, 57: geo57, 82: geo82 };

    Object.keys(PARCELS).forEach((id) => {
      const parcelKey = PARCELS[id].key;
      const rawActiveList = activeData[parcelKey] || [];
      const geoJson = geoDataMap[id];

      const dataMap = {};
      rawActiveList.forEach((item) => {
        dataMap[item.mt_name] = {
          ...item,
          loading: true, 
        };
      });

      parcelState[id] = { geoJson, dataMap };
      updateUI(id);

      fetchParcelDetails(id);
    });
  } catch (error) {
    console.error("Error inicializando dashboard:", error);
    Object.keys(PARCELS).forEach((id) => {
      document.getElementById(
        `info-${id}`
      ).innerHTML = `<span class="text-danger">Error de conexión</span>`;
    });
  }
}

async function fetchParcelDetails(parcelId) {
  const urlInterval = `https://app.jteanalytics.cl/zagal/${parcelId}/interval`;

  try {
    const detailData = await fetch(urlInterval).then((r) => r.json());

    const currentState = parcelState[parcelId];
    if (!currentState) return;

    detailData.forEach((item) => {
      currentState.dataMap[item.mt_name] = {
        ...item,
        loading: false,
      };
    });

    updateUI(parcelId);
  } catch (error) {
    console.error(`Error cargando detalles parcela ${parcelId}:`, error);
  }
}

function updateUI(parcelId) {
  const { geoJson, dataMap } = parcelState[parcelId];
  const container = document.getElementById(`info-${parcelId}`);
  const mapId = `map-${parcelId}`;

  const dataArray = Object.values(dataMap);

  renderSummary(parcelId, dataArray, container);
  initLeafletMap(mapId, geoJson, dataMap);
}

function renderSummary(parcelId, data, container) {
  if (summaryIntervals[parcelId]) clearInterval(summaryIntervals[parcelId]);

  const activeSectors = data.filter((s) => s.is_active === 1);

  if (activeSectors.length === 0) {
    container.innerHTML = `<span class="text-muted">Sin riego activo</span>`;
    return;
  }

  let currentIndex = 0;
  const render = () => {
    const sector = activeSectors[currentIndex];
    const timeVal = sector.loading
      ? "--"
      : formatTime(sector.tiempo_riego_segundos);

    let totalVal = 0
    if(parcelId==82){
      totalVal = sector.loading ? "--" : `${sector.totalizador} m³`;
    }
    else {
      totalVal = sector.loading ? "--" : `${sector.totalizador / 10} m³`;
    }

    const html = `
      <div class="fade-in w-100 text-start">
        <div class="fw-bold text-success mb-1">${sector.mt_name} 
          <span class="badge bg-success float-end">Activo</span>
        </div>
        <div class="d-flex justify-content-between">
          <span>Tiempo:</span> <strong>${timeVal}</strong>
        </div>
        <div class="d-flex justify-content-between">
          <span>Totalizador:</span> <strong>${totalVal}</strong>
        </div>
         ${
           activeSectors.length > 1
             ? `<small class="text-muted d-block text-center mt-1" style="font-size:0.7rem">Sector ${
                 currentIndex + 1
               } de ${activeSectors.length}</small>`
             : ""
         }
      </div>
    `;
    container.innerHTML = html;
  };

  render();

  if (activeSectors.length > 1) {
    summaryIntervals[parcelId] = setInterval(() => {
      currentIndex = (currentIndex + 1) % activeSectors.length;
      render();
    }, 3000);
  }
}

function initLeafletMap(elementId, geoJsonData, apiDataMap) {
  if (!document.getElementById(elementId)) return;

  if (mapInstances[elementId]) {
    mapInstances[elementId].remove();
  }

  const map = L.map(elementId, {
    center: [-34.492, -70.974],
    zoom: 15,
    zoomControl: false,
    scrollWheelZoom: false,
    dragging: false,
  });

  mapInstances[elementId] = map;

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);

  function style(feature) {
    let isActive = false;
    const featureId = feature.properties.identifier || "";

    // Búsqueda simple por inclusión de nombre
    for (const apiName in apiDataMap) {
      if (featureId === apiName && apiDataMap[apiName].is_active === 1) {
        isActive = true;
        break;
      }
    }

    return {
      color: isActive ? "#2e7d32" : "#d32f2f",
      weight: 2,
      opacity: 1,
      fillColor: isActive ? "#81c784" : "#f44336",
      fillOpacity: 0.5,
    };
  }

  function onEachFeature(feature, layer) {
    if (feature.geometry.type === "Polygon") {
      layer.on("click", (e) => {
        L.DomEvent.stopPropagation(e);

        let matchedData = null;
        // Nombre en el modal
        const featureName = feature.properties.name || "";

        for (const apiName in apiDataMap) {
          if (featureName.includes(apiName)) {
            matchedData = apiDataMap[apiName];
            break;
          }
        }

        const isActive = matchedData ? matchedData.is_active === 1 : false;
        const isLoading = matchedData ? matchedData.loading : false;

        const time = isLoading
          ? "--"
          : matchedData
          ? formatTime(matchedData.tiempo_riego_segundos)
          : "0s";
        const total = isLoading
          ? "--"
          : matchedData
          ? matchedData.totalizador
          : 0;

        layer
          .bindPopup(
            `
                  <div style="text-align:center">
                    <strong>${featureName}</strong><br>
                    <span class="badge ${
                      isActive ? "bg-success" : "bg-danger"
                    } mb-1">
                      ${isActive ? "Riego Activo" : "Inactivo"}
                    </span><br>
                    <small>Tiempo: ${time}</small><br>
                    <small>Total: ${total} m³</small>
                  </div>
              `
          )
          .openPopup();
      });
    }
  }

  const geoJsonLayer = L.geoJSON(geoJsonData, {
    style: style,
    onEachFeature: onEachFeature,
  }).addTo(map);

  if (geoJsonData.features && geoJsonData.features.length > 0) {
    map.fitBounds(geoJsonLayer.getBounds());
  }
}

// Event Listeners
document.getElementById("card57").onclick = (e) => {
  if (!e.target.closest(".leaflet-container"))
    navigateTo("https://jteanalytics.cl/zagal/57");
};
document.getElementById("card18").onclick = (e) => {
  if (!e.target.closest(".leaflet-container"))
    navigateTo("https://jteanalytics.cl/zagal/18");
};
document.getElementById("card82").onclick = (e) => {
  if (!e.target.closest(".leaflet-container"))
    navigateTo("https://jteanalytics.cl/zagal/82");
};

// Inicialización Global
initDashboard();
