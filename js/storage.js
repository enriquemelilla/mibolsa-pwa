const DB_KEY = "mibolsa_v5_data";

const defaultData = {
  movimientos: [],
  cotizaciones: {},
  ajustes: {
    provider: "manual",
    googleUrl: "",
    apiKey: "",
    actualizarAlAbrir: false,
    ventaPct: 0.25,
    ventaMin: 5,
    moneda: "EUR",
    impuestoPct: 0,
    promptIA: "Analiza mi cartera personal de acciones con un criterio prudente.\n\nDebes valorar cada acción según:\n- precio medio de compra\n- precio actual introducido\n- beneficio o pérdida aproximada\n- fuerza relativa entre los valores\n- conveniencia de vender, mantener, comprar o no entrar\n- posibles compras en retrocesos\n- posibles ventas parciales por tramos\n\nDevuélveme SOLO JSON válido, sin markdown ni texto adicional.\n\nPor cada acción quiero:\n- recomendación: VENDER, MANTENER, COMPRAR o NO_ENTRAR\n- comentario profesional breve\n- situación actual\n- 3 tramos de venta con precio, porcentaje y descripción\n- 2 tramos de compra con precio, importe aproximado y descripción\n- riesgo\n- prioridad\n\nNo inventes datos que no estén en el JSON. Si falta información, indícalo dentro del comentario."
  },
  recomendacionesIA: null
};

function loadDB(){
  const raw = localStorage.getItem(DB_KEY);
  if(!raw) return structuredClone(defaultData);
  try{
    const parsed = JSON.parse(raw);
    return {
      movimientos: parsed.movimientos || [],
      cotizaciones: parsed.cotizaciones || {},
      ajustes: {...defaultData.ajustes, ...(parsed.ajustes || {})},
      recomendacionesIA: parsed.recomendacionesIA || null
    };
  }catch(e){
    console.error(e);
    return structuredClone(defaultData);
  }
}

function saveDB(db){
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function uid(){
  return "id_" + Date.now() + "_" + Math.random().toString(16).slice(2);
}

function today(){
  return new Date().toISOString().slice(0,10);
}

function money(n, moneda){
  const value = Number(n || 0);
  return value.toLocaleString("es-ES", {style:"currency", currency: moneda || "EUR"});
}

function num(n, decimals=2){
  return Number(n || 0).toLocaleString("es-ES", {minimumFractionDigits:decimals, maximumFractionDigits:decimals});
}

function downloadFile(filename, content, type="application/json"){
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
