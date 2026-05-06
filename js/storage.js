const DB_KEY = "mibolsa_v5_data";

const defaultData = {
  movimientos: [],
  cotizaciones: {},
  ajustes: {
    provider: "manual",
    apiKey: "",
    ventaPct: 0.25,
    ventaMin: 5,
    moneda: "EUR",
    impuestoPct: 0
  }
};

function loadDB(){
  const raw = localStorage.getItem(DB_KEY);
  if(!raw) return structuredClone(defaultData);
  try{
    const parsed = JSON.parse(raw);
    return {
      movimientos: parsed.movimientos || [],
      cotizaciones: parsed.cotizaciones || {},
      ajustes: {...defaultData.ajustes, ...(parsed.ajustes || {})}
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
