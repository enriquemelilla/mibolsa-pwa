let db = loadDB();
let deferredPrompt = null;
let intradiaViewMode = localStorage.getItem("intradiaViewMode") || "detalle";

const el = (id) => document.getElementById(id);

function setStatus(msg){
  const statusEl = el("status");
  if(statusEl) statusEl.textContent = msg;
}

function bind(id, event, handler){
  const node = el(id);
  if(!node){
    console.warn(`Elemento no encontrado: #${id}`);
    return;
  }
  node.addEventListener(event, handler);
}

function togglePanel(id){
  const panel = el(id);
  if(!panel) return;
  panel.classList.toggle("closed");
  panel.classList.toggle("open");
}

function setPanelState(id, isOpen){
  const panel = el(id);
  if(!panel) return;
  panel.classList.toggle("open", isOpen);
  panel.classList.toggle("closed", !isOpen);
  const button = document.querySelector(`[aria-controls="${id}"]`);
  if(button){
    button.textContent = isOpen ? "−" : "+";
    button.setAttribute("aria-expanded", String(isOpen));
  }
}

function togglePanelWithButton(id, button){
  const panel = el(id);
  if(!panel) return;
  const isOpen = !panel.classList.contains("open");
  setPanelState(id, isOpen);
  if(button){
    button.textContent = isOpen ? "−" : "+";
    button.setAttribute("aria-expanded", String(isOpen));
  }
}

function formatFechaHora(value){
  return value ? new Date(value).toLocaleString("es-ES") : "-";
}

function getUltimaActualizacionCotizaciones(){
  const fechas = Object.values(db.cotizaciones || {})
    .map(c=>c && c.updatedAt ? new Date(c.updatedAt).getTime() : 0)
    .filter(Boolean);
  if(!fechas.length) return null;
  return new Date(Math.max(...fechas)).toISOString();
}


function marcarTablasResponsive(){
  document.querySelectorAll(".responsive-table").forEach(table=>{
    const headers = Array.from(table.querySelectorAll("thead th")).map(th=>th.textContent.trim());
    table.querySelectorAll("tbody tr").forEach(tr=>{
      Array.from(tr.children).forEach((td, i)=>{
        if(headers[i]) td.setAttribute("data-label", headers[i]);
      });
    });
  });
}


function abrirVista(view){
  document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
  const tab = document.querySelector(`.tab[data-view="${view}"]`);
  if(tab) tab.classList.add("active");
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  const vista = el("view-" + view);
  if(vista) vista.classList.add("active");
  renderAll();
}

function init(){
  document.querySelectorAll(".tab").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      if(btn.dataset.view === "recomendaciones" && !db.ajustes.avisoRecomendacionesIAAceptado){
        mostrarAvisoRecomendacionesIA();
        return;
      }
      abrirVista(btn.dataset.view);
    });
  });

  el("movFecha").value = today();
  bind("movTipo", "change", toggleTipoMovimiento);
  bind("formMovimiento", "submit", guardarMovimiento);
  bind("btnLimpiarForm", "click", limpiarForm);
  bind("buscarMovimiento", "input", renderMovimientos);

  bind("movCantidad", "input", recalcularTotalOperacion);
  bind("movPrecio", "input", recalcularTotalOperacion);
  bind("movGastos", "input", recalcularTotalOperacion);
  bind("movTotal", "change", calcularGastosDesdeTotal);

  bind("formAjustes", "submit", guardarAjustes);
  bind("btnExportar", "click", exportarDatos);
  bind("inputImportar", "change", importarDatos);
  bind("btnBorrarTodo", "click", borrarTodo);
  bind("btnActualizarTodasApi", "click", actualizarTodasApi);
  bind("btnRefrescarCotizaciones", "click", renderAll);

  bind("btnGenerarJsonIA", "click", generarJsonParaIA);
  bind("btnCopiarJsonIA", "click", copiarJsonIA);
  bind("btnDescargarJsonIA", "click", descargarJsonIA);
  bind("btnCopiarPromptIA", "click", copiarPromptIA);
  bind("btnCargarRespuestaIA", "click", cargarRespuestaIA);
  bind("btnEjemploRespuestaIA", "click", pegarEjemploRespuestaIA);
  bind("btnBorrarRecomendacionesIA", "click", borrarRecomendacionesIA);
  bind("btnAceptarAvisoIA", "click", aceptarAvisoRecomendacionesIA);
  bind("btnIntradiaVistaDetalle", "click", ()=>setIntradiaViewMode("detalle"));
  bind("btnIntradiaVistaGrafica", "click", ()=>setIntradiaViewMode("grafica"));

  window.addEventListener("beforeinstallprompt", (e)=>{
    e.preventDefault();
    deferredPrompt = e;
    el("btnInstall").classList.remove("hidden");
  });
  bind("btnInstall", "click", async ()=>{
    if(deferredPrompt){
      deferredPrompt.prompt();
      deferredPrompt = null;
      el("btnInstall").classList.add("hidden");
    }
  });

  cargarAjustesForm();
  toggleTipoMovimiento();
  renderAll();
  configurarAutoActualizacionCotizaciones();

  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("sw.js");
  }
}

function debeActualizarAlVisualizar(){
  return Boolean(db?.ajustes?.actualizarAlAbrir);
}

function configurarAutoActualizacionCotizaciones(){
  const intentarActualizar = ()=>{
    if(!debeActualizarAlVisualizar()) return;
    if(document.visibilityState !== "visible") return;
    actualizarTodasApi(true);
  };

  document.addEventListener("visibilitychange", intentarActualizar);
  window.addEventListener("focus", intentarActualizar);
  setTimeout(intentarActualizar, 0);
}

function mostrarAvisoRecomendacionesIA(){
  const modal = el("modalAvisoIA");
  const checkbox = el("chkNoMostrarAvisoIA");
  if(checkbox) checkbox.checked = false;
  if(modal) modal.classList.remove("hidden");
}

function aceptarAvisoRecomendacionesIA(){
  const modal = el("modalAvisoIA");
  const checkbox = el("chkNoMostrarAvisoIA");
  if(modal) modal.classList.add("hidden");
  db.ajustes.avisoRecomendacionesIAAceptado = Boolean(checkbox && checkbox.checked);
  saveDB(db);
  abrirVista("recomendaciones");
}

function extraerJsonValido(raw){
  const texto = (raw || "").trim();
  const inicioObjeto = texto.indexOf("{");
  const inicioArray = texto.indexOf("[");
  const inicios = [inicioObjeto, inicioArray].filter(i=>i !== -1);
  const inicio = inicios.length ? Math.min(...inicios) : -1;
  if(inicio === -1){
    throw new Error("No se encontró JSON válido.");
  }

  const cierre = texto[inicio] === "[" ? "]" : "}";
  const fin = texto.lastIndexOf(cierre);
  if(fin === -1 || fin <= inicio){
    throw new Error("No se encontró JSON válido completo.");
  }
  return texto.slice(inicio, fin + 1);
}

function getGastosOperacion(valor){
  return Math.abs(Number(valor || 0));
}

function calcularImporteOperacion(tipo, cantidad, precio, gastos){
  const gasto = getGastosOperacion(gastos);
  if(tipo === "DIVIDENDO"){
    return Math.max(Number(precio || 0) - gasto, 0);
  }
  const bruto = Number(cantidad || 0) * Number(precio || 0);
  return tipo === "VENTA" ? bruto - gasto : bruto + gasto;
}

function getTotalMovimiento(m){
  return calcularImporteOperacion(m.tipo, m.cantidad, m.precio, m.gastos);
}

function actualizarLabelsOperacion(tipo){
  const esDividendo = tipo === "DIVIDENDO";
  const labels = {
    labelMovCantidad: esDividendo ? "Acciones con derecho a dividendo" : "Cantidad acciones",
    labelMovPrecio: esDividendo ? "Cantidad dividendo bruto" : "Precio cotización operación",
    labelMovGastos: esDividendo ? "Retención" : "Gastos operación",
    labelMovTotal: esDividendo ? "Neto recibido" : "Total operación"
  };
  Object.entries(labels).forEach(([id, texto])=>{
    if(el(id)) el(id).textContent = texto;
  });
  if(el("hintOperacion")){
    el("hintOperacion").textContent = esDividendo
      ? "Indica las acciones que generan el dividendo, la cantidad bruta y la retención. El neto recibido suma como beneficio real."
      : "Puedes rellenar cantidad + precio + gastos, o cantidad + precio + total para calcular gastos.";
  }
}

function toggleTipoMovimiento(){
  const tipo = el("movTipo").value;
  const bloque = el("bloqueOperacion");
  actualizarLabelsOperacion(tipo);
  bloque.style.display = tipo === "SEGUIMIENTO" ? "none" : "block";
  if(tipo === "SEGUIMIENTO"){
    el("movCantidad").value = "";
    el("movPrecio").value = "";
    el("movGastos").value = "";
    el("movTotal").value = "";
  } else {
    recalcularTotalOperacion();
  }
}

function recalcularTotalOperacion(){
  const tipo = el("movTipo").value;
  if(tipo === "SEGUIMIENTO") return;
  const cantidad = Number(el("movCantidad").value || 0);
  const precio = Number(el("movPrecio").value || 0);
  const gastos = getGastosOperacion(el("movGastos").value);
  if((tipo === "DIVIDENDO" && precio) || (cantidad && precio)){
    el("movGastos").value = gastos ? gastos.toFixed(2) : "";
    el("movTotal").value = calcularImporteOperacion(tipo, cantidad, precio, gastos).toFixed(2);
  }
}

function calcularGastosDesdeTotal(){
  const tipo = el("movTipo").value;
  const cantidad = Number(el("movCantidad").value || 0);
  const precio = Number(el("movPrecio").value || 0);
  const total = Number(el("movTotal").value || 0);
  if(precio && total){
    const bruto = tipo === "DIVIDENDO" ? precio : cantidad * precio;
    if(tipo !== "DIVIDENDO" && !cantidad) return;
    const gastos = ["VENTA", "DIVIDENDO"].includes(tipo) ? bruto - total : total - bruto;
    el("movGastos").value = getGastosOperacion(gastos).toFixed(2);
  }
}

function guardarMovimiento(e){
  e.preventDefault();
  const tipo = el("movTipo").value;
  const id = el("movId").value || uid();

  const cantidad = tipo === "SEGUIMIENTO" ? 0 : Number(el("movCantidad").value || 0);
  const precio = tipo === "SEGUIMIENTO" ? 0 : Number(el("movPrecio").value || 0);
  const gastos = tipo === "SEGUIMIENTO" ? 0 : getGastosOperacion(el("movGastos").value);

  const movimiento = {
    id,
    tipo,
    nombre: el("movNombre").value.trim(),
    ticker: el("movTicker").value.trim().toUpperCase(),
    apiSymbol: el("movApiSymbol").value.trim().toUpperCase(),
    exchange: el("movExchange").value.trim().toUpperCase(),
    cantidad,
    precio,
    gastos,
    total: tipo === "SEGUIMIENTO" ? 0 : calcularImporteOperacion(tipo, cantidad, precio, gastos),
    fecha: el("movFecha").value || today(),
    mercado: el("movMercado").value.trim(),
    notas: el("movNotas").value.trim(),
    createdAt: new Date().toISOString()
  };

  if(!movimiento.nombre || !movimiento.ticker){
    alert("Debes indicar nombre y ticker.");
    return;
  }

  if(["COMPRA", "VENTA"].includes(tipo) && (!movimiento.cantidad || !movimiento.precio)){
    alert("En compra/venta debes indicar cantidad y precio.");
    return;
  }

  if(tipo === "DIVIDENDO" && (!movimiento.cantidad || !movimiento.precio)){
    alert("En dividendos debes indicar acciones que generan el dividendo y cantidad bruta.");
    return;
  }

  const ix = db.movimientos.findIndex(m=>m.id === id);
  if(ix >= 0) db.movimientos[ix] = movimiento;
  else db.movimientos.push(movimiento);

  saveDB(db);
  limpiarForm();
  renderAll();
  setStatus("Movimiento guardado.");
}

function limpiarForm(){
  el("formTitulo").textContent = "Nuevo movimiento";
  el("movId").value = "";
  el("formMovimiento").reset();
  el("movFecha").value = today();
  toggleTipoMovimiento();
}

function editarMovimiento(id){
  const m = db.movimientos.find(x=>x.id === id);
  if(!m) return;
  el("formTitulo").textContent = "Modificar movimiento";
  el("movId").value = m.id;
  el("movTipo").value = m.tipo;
  el("movNombre").value = m.nombre;
  el("movTicker").value = m.ticker;
  el("movApiSymbol").value = m.apiSymbol || "";
  el("movExchange").value = m.exchange || "";
  el("movCantidad").value = m.cantidad || "";
  el("movPrecio").value = m.precio || "";
  el("movGastos").value = m.tipo === "SEGUIMIENTO" ? "" : getGastosOperacion(m.gastos) || "";
  el("movTotal").value = m.tipo === "SEGUIMIENTO" ? "" : getTotalMovimiento(m).toFixed(2);
  el("movFecha").value = m.fecha || today();
  el("movMercado").value = m.mercado || "";
  el("movNotas").value = m.notas || "";
  toggleTipoMovimiento();
  document.querySelector('[data-view="movimientos"]').click();
  setPanelState("panelNuevoMovimiento", true);
}

function borrarMovimiento(id){
  if(!confirm("¿Eliminar movimiento?")) return;
  db.movimientos = db.movimientos.filter(m=>m.id !== id);
  saveDB(db);
  renderAll();
  setStatus("Movimiento eliminado.");
}

function getCotizacion(ticker){
  return db.cotizaciones[ticker] || null;
}

function setCotizacion(ticker, price, source="manual"){
  if(!ticker || !price) return;
  db.cotizaciones[ticker] = {
    price: Number(price),
    source,
    updatedAt: new Date().toISOString()
  };
  saveDB(db);
}

function compararMovimientosCronologicos(a, b){
  const fechaA = a.fecha || "";
  const fechaB = b.fecha || "";
  if(fechaA !== fechaB) return fechaA.localeCompare(fechaB);

  const creadoA = a.createdAt || "";
  const creadoB = b.createdAt || "";
  if(creadoA !== creadoB) return creadoA.localeCompare(creadoB);

  return (a.id || "").localeCompare(b.id || "");
}

function crearGrupoCartera(m){
  return {
    ticker:m.ticker,
    nombre:m.nombre,
    apiSymbol:m.apiSymbol,
    exchange:m.exchange,
    cantidadComprada:0,
    cantidadVendida:0,
    invertidoCompras:0,
    importeVentas:0,
    gastosCompra:0,
    gastosVenta:0,
    costeAccionesVendidas:0,
    beneficioVentasBruto:0,
    dividendosBrutos:0,
    retencionesDividendos:0,
    dividendosNetos:0,
    capitalRealUsado:0,
    capitalDiasReal:0,
    movimientos:[],
    lotesAbiertos:[]
  };
}

function diasEntreFechas(inicio, fin){
  const tInicio = new Date(inicio || today()).getTime();
  const tFin = new Date(fin || today()).getTime();
  if(!Number.isFinite(tInicio) || !Number.isFinite(tFin)) return 1;
  return Math.max(Math.ceil((tFin - tInicio) / 86400000), 1);
}

function crearMetricasInteres(beneficio, capital, capitalDias){
  const capitalUsado = Number(capital || 0);
  const dias = capitalUsado > 0 ? Math.max(Number(capitalDias || 0) / capitalUsado, 1) : 0;
  const actualPct = capitalUsado > 0 ? (Number(beneficio || 0) / capitalUsado) * 100 : 0;
  const anualPct = dias > 0 ? actualPct * (365 / dias) : 0;
  return { generado: Number(beneficio || 0), capitalUsado, dias, actualPct, anualPct };
}

function formatearInteres(metricas){
  if(!metricas || !metricas.capitalUsado) return "Generado - · interés actual - · anual - · días - · capital -";
  return `Generado ${money(metricas.generado, db.ajustes.moneda)} · interés actual ${num(metricas.actualPct,2)} % · anual ${num(metricas.anualPct,2)} % · ${num(metricas.dias,0)} días · capital ${money(metricas.capitalUsado, db.ajustes.moneda)}`;
}

function registrarCompraEnCartera(g, m, gastos){
  const cantidad = Number(m.cantidad || 0);
  const costeTotal = cantidad * Number(m.precio || 0) + gastos;

  g.cantidadComprada += cantidad;
  g.invertidoCompras += costeTotal;
  g.gastosCompra += gastos;

  if(cantidad > 0){
    g.lotesAbiertos.push({
      cantidad,
      costeTotal,
      precio: Number(m.precio || 0),
      gastos,
      fecha: m.fecha || today()
    });
  }
}

function registrarVentaEnCartera(g, m, gastos){
  let cantidadPendiente = Number(m.cantidad || 0);
  let costeVenta = 0;

  g.cantidadVendida += cantidadPendiente;
  g.importeVentas += cantidadPendiente * Number(m.precio || 0) - gastos;
  g.gastosVenta += gastos;

  while(cantidadPendiente > 0 && g.lotesAbiertos.length){
    const lote = g.lotesAbiertos[0];
    const cantidadConsumida = Math.min(cantidadPendiente, lote.cantidad);
    const costeProporcional = lote.costeTotal * (cantidadConsumida / lote.cantidad);

    const dias = diasEntreFechas(lote.fecha, m.fecha);
    g.capitalRealUsado += costeProporcional;
    g.capitalDiasReal += costeProporcional * dias;

    costeVenta += costeProporcional;
    lote.cantidad -= cantidadConsumida;
    lote.costeTotal -= costeProporcional;
    cantidadPendiente -= cantidadConsumida;

    if(lote.cantidad <= 0.00000001){
      g.lotesAbiertos.shift();
    }
  }

  g.costeAccionesVendidas += costeVenta;
  g.beneficioVentasBruto += getTotalMovimiento(m) - costeVenta;
}

function agruparCartera(movimientos = db.movimientos){
  const map = {};
  const movimientosOrdenados = [...movimientos]
    .filter(m=>m.tipo !== "SEGUIMIENTO")
    .sort(compararMovimientosCronologicos);

  movimientosOrdenados.forEach(m=>{
    if(!map[m.ticker]){
      map[m.ticker] = crearGrupoCartera(m);
    }
    const g = map[m.ticker];
    const gastos = getGastosOperacion(m.gastos);
    g.movimientos.push(m);

    if(m.tipo === "COMPRA"){
      registrarCompraEnCartera(g, m, gastos);
    }
    if(m.tipo === "VENTA"){
      registrarVentaEnCartera(g, m, gastos);
    }
    if(m.tipo === "DIVIDENDO"){
      const cantidadDividendo = Number(m.cantidad || 0);
      let cantidadPendiente = cantidadDividendo;
      g.lotesAbiertos.forEach(lote=>{
        if(cantidadPendiente <= 0) return;
        const cantidadUsada = Math.min(cantidadPendiente, lote.cantidad);
        const costeProporcional = lote.costeTotal * (cantidadUsada / lote.cantidad);
        const dias = diasEntreFechas(lote.fecha, m.fecha);
        g.capitalRealUsado += costeProporcional;
        g.capitalDiasReal += costeProporcional * dias;
        cantidadPendiente -= cantidadUsada;
      });
      g.dividendosBrutos += Number(m.precio || 0);
      g.retencionesDividendos += gastos;
      g.dividendosNetos += getTotalMovimiento(m);
    }
    if(m.apiSymbol) g.apiSymbol = m.apiSymbol;
    if(m.exchange) g.exchange = m.exchange;
    if(m.nombre) g.nombre = m.nombre;
  });

  return Object.values(map).map(g=>{
    g.cantidadNeta = g.cantidadComprada - g.cantidadVendida;
    g.invertidoNeto = g.cantidadNeta > 0 ? g.lotesAbiertos.reduce((sum, lote)=>sum + lote.costeTotal, 0) : 0;
    g.precioMedioCompra = g.cantidadComprada > 0 ? g.invertidoCompras / g.cantidadComprada : 0;
    g.precioMedio = g.cantidadNeta > 0 ? g.invertidoNeto / g.cantidadNeta : 0;
    return g;
  }).filter(g=>g.cantidadNeta !== 0 || g.movimientos.length > 0);
}

function getSeguimiento(){
  const carteraTickers = new Set(db.movimientos.filter(m=>m.tipo !== "SEGUIMIENTO").map(m=>m.ticker));
  return db.movimientos
    .filter(m=>m.tipo === "SEGUIMIENTO")
    .filter(m=>!carteraTickers.has(m.ticker));
}

function getTodosValoresCotizables(){
  const values = {};
  agruparCartera().forEach(g=>{
    values[g.ticker] = {
      tipo:"Cartera",
      nombre:g.nombre,
      ticker:g.ticker,
      apiSymbol:g.apiSymbol || "",
      exchange:g.exchange || ""
    };
  });
  getSeguimiento().forEach(s=>{
    values[s.ticker] = {
      tipo:"Seguimiento",
      nombre:s.nombre,
      ticker:s.ticker,
      apiSymbol:s.apiSymbol || "",
      exchange:s.exchange || ""
    };
  });
  return Object.values(values);
}

function estimarGastosVenta(valorActual){
  const pct = Number(db.ajustes.ventaPct || 0) / 100;
  const min = Number(db.ajustes.ventaMin || 0);
  return Math.max(valorActual * pct, min);
}


function calcularResultadoReal(g){
  const impuestoPct = Number(db.ajustes.impuestoPct || 0) / 100;
  const beneficioVentasBruto = Number(g.beneficioVentasBruto || 0);
  const dividendosBrutos = Number(g.dividendosBrutos || 0);
  const retencionesDividendos = Number(g.retencionesDividendos || 0);
  const dividendosNetos = Number(g.dividendosNetos || 0);
  const impuestoVentas = beneficioVentasBruto > 0 ? beneficioVentasBruto * impuestoPct : 0;
  const bruto = beneficioVentasBruto + dividendosBrutos;
  const impuestosRetenciones = impuestoVentas + retencionesDividendos;
  const neto = beneficioVentasBruto - impuestoVentas + dividendosNetos;
  const interes = crearMetricasInteres(neto, g.capitalRealUsado, g.capitalDiasReal);
  return {
    beneficioVentasBruto,
    dividendosBrutos,
    retencionesDividendos,
    dividendosNetos,
    impuestoVentas,
    impuestosRetenciones,
    bruto,
    neto,
    interes
  };
}

function calcularResultadoLatente(g){
  const cot = getCotizacion(g.ticker);
  const valorActual = cot && g.cantidadNeta > 0 ? cot.price * g.cantidadNeta : 0;
  const gastosVenta = valorActual > 0 ? estimarGastosVenta(valorActual) : 0;
  const bruto = cot && g.cantidadNeta > 0 ? valorActual - g.invertidoNeto : 0;
  const impuesto = bruto > 0 ? bruto * (Number(db.ajustes.impuestoPct || 0) / 100) : 0;
  const neto = cot && g.cantidadNeta > 0 ? bruto - gastosVenta - impuesto : 0;
  const capitalDias = (g.lotesAbiertos || []).reduce((sum, lote)=>sum + Number(lote.costeTotal || 0) * diasEntreFechas(lote.fecha, today()), 0);
  const interes = crearMetricasInteres(neto, g.invertidoNeto, capitalDias);
  const rentabilidad = interes.actualPct;
  return { cot, valorActual, gastosVenta, bruto, impuesto, neto, rentabilidad, interes };
}

function calcularBeneficios(cartera){
  const beneficios = cartera.reduce((acc, g)=>{
    const real = calcularResultadoReal(g);
    const latente = calcularResultadoLatente(g);

    acc.gastosCompra += Number(g.gastosCompra || 0);
    acc.gastosVenta += Number(g.gastosVenta || 0);
    acc.dividendosBrutos += real.dividendosBrutos;
    acc.retencionesDividendos += real.retencionesDividendos;
    acc.dividendosNetos += real.dividendosNetos;
    acc.realizadoBruto += real.bruto;
    acc.impuestoRealizado += real.impuestosRetenciones;
    acc.realizadoNeto += real.neto;
    acc.capitalRealUsado += real.interes.capitalUsado;
    acc.capitalDiasReal += real.interes.capitalUsado * real.interes.dias;
    if(g.cantidadNeta > 0){
      acc.invertidoAbierto += Number(g.invertidoNeto || 0);
    }

    if(latente.cot && g.cantidadNeta > 0){
      acc.valorActual += latente.valorActual;
      acc.gastosVentaEstimados += latente.gastosVenta;
      acc.latenteBruto += latente.bruto;
      acc.impuestoLatente += latente.impuesto;
      acc.latenteNeto += latente.neto;
      acc.capitalDiasLatente += latente.interes.capitalUsado * latente.interes.dias;
    }
    return acc;
  }, {
    gastosCompra: 0,
    gastosVenta: 0,
    dividendosBrutos: 0,
    retencionesDividendos: 0,
    dividendosNetos: 0,
    realizadoBruto: 0,
    impuestoRealizado: 0,
    realizadoNeto: 0,
    capitalRealUsado: 0,
    capitalDiasReal: 0,
    invertidoAbierto: 0,
    valorActual: 0,
    gastosVentaEstimados: 0,
    latenteBruto: 0,
    impuestoLatente: 0,
    latenteNeto: 0,
    capitalDiasLatente: 0
  });
  beneficios.interesReal = crearMetricasInteres(beneficios.realizadoNeto, beneficios.capitalRealUsado, beneficios.capitalDiasReal);
  beneficios.interesLatente = crearMetricasInteres(beneficios.latenteNeto, beneficios.invertidoAbierto, beneficios.capitalDiasLatente);
  return beneficios;
}

function calcularResultadosRealizados(cartera){
  const beneficios = calcularBeneficios(cartera);
  return {
    gastosCompra: beneficios.gastosCompra,
    gastosVenta: beneficios.gastosVenta,
    beneficioBruto: beneficios.realizadoBruto,
    impuesto: beneficios.impuestoRealizado,
    beneficioNeto: beneficios.realizadoNeto
  };
}

function renderAll(){
  renderDashboard();
  renderMovimientos();
  renderCartera();
  renderSeguimiento();
  renderCotizaciones();
  renderComparativa();
  renderRecomendacionesIA();
  renderOperacionesIntradia();
  cargarAjustesForm();
  marcarTablasResponsive();
}

function renderDashboard(){
  const cartera = agruparCartera();
  const beneficios = calcularBeneficios(cartera);

  el("dashValorCartera").textContent = money(beneficios.valorActual, db.ajustes.moneda);
  el("dashInvertido").textContent = money(beneficios.invertidoAbierto, db.ajustes.moneda);
  el("dashBeneficio").textContent = money(beneficios.latenteNeto, db.ajustes.moneda);
  el("dashBeneficio").className = beneficios.latenteNeto >= 0 ? "good" : "bad";
  el("dashRealizado").textContent = money(beneficios.realizadoNeto, db.ajustes.moneda);
  el("dashRealizado").className = beneficios.realizadoNeto >= 0 ? "good" : "bad";
  el("dashSeguimiento").textContent = getSeguimiento().length;
  const ultimaActualizacion = getUltimaActualizacionCotizaciones();
  if(el("dashCotizacionesActualizadas")){
    el("dashCotizacionesActualizadas").textContent = ultimaActualizacion
      ? `Cotizaciones actualizadas: ${formatFechaHora(ultimaActualizacion)}`
      : "Cotizaciones sin actualizar";
  }

  const resumenPosiciones = cartera.length ? cartera.map(g=>{
    const real = calcularResultadoReal(g);
    const latente = calcularResultadoLatente(g);
    return `<p><strong>${g.nombre}</strong>: ${num(g.cantidadNeta, 0)} acciones · Cotización: ${latente.cot ? money(latente.cot.price, db.ajustes.moneda) : "sin dato"} · Valor actual: ${latente.cot ? money(latente.valorActual, db.ajustes.moneda) : "-"} · <span class="${real.neto >= 0 ? 'good' : 'bad'}">Real ${money(real.neto, db.ajustes.moneda)} (${formatearInteres(real.interes)})</span> · <span class="${latente.neto >= 0 ? 'good' : 'bad'}">Latente ${latente.cot ? money(latente.neto, db.ajustes.moneda) + ' (' + formatearInteres(latente.interes) + ')' : '-'}</span></p>`;
  }).join("") : `<p class="muted">Todavía no tienes cartera real. Añade una compra desde Movimientos.</p>`;
  const resumenBeneficios = `<p><strong>Beneficio/pérdida real FIFO:</strong> Bruto ${money(beneficios.realizadoBruto, db.ajustes.moneda)} · Dividendos netos ${money(beneficios.dividendosNetos, db.ajustes.moneda)} · Retenciones/impuestos ${money(beneficios.impuestoRealizado, db.ajustes.moneda)} · Neto ${money(beneficios.realizadoNeto, db.ajustes.moneda)} · ${formatearInteres(beneficios.interesReal)}</p>
    <p><strong>Beneficio/pérdida latente:</strong> Bruto ${money(beneficios.latenteBruto, db.ajustes.moneda)} · Gastos venta estimados ${money(beneficios.gastosVentaEstimados, db.ajustes.moneda)} · Impuestos ${money(beneficios.impuestoLatente, db.ajustes.moneda)} · Neto ${money(beneficios.latenteNeto, db.ajustes.moneda)} · ${formatearInteres(beneficios.interesLatente)}</p>`;
  el("dashboardResumen").innerHTML = resumenPosiciones + resumenBeneficios;
}

function renderMovimientos(){
  const contenedor = el("tablaMovimientos");
  const q = (el("buscarMovimiento").value || "").toLowerCase();
  const rows = db.movimientos
    .filter(m => !q || `${m.fecha} ${m.tipo} ${m.nombre} ${m.ticker}`.toLowerCase().includes(q))
    .sort((a,b)=>(b.fecha || "").localeCompare(a.fecha || ""));

  const compras = rows.filter(m=>m.tipo==="COMPRA").length;
  const ventas = rows.filter(m=>m.tipo==="VENTA").length;
  const dividendos = rows.filter(m=>m.tipo==="DIVIDENDO").length;
  const seguimiento = rows.filter(m=>m.tipo==="SEGUIMIENTO").length;
  const importeCompras = rows.filter(m=>m.tipo==="COMPRA").reduce((sum,m)=>sum + getTotalMovimiento(m),0);
  const importeVentas = rows.filter(m=>m.tipo==="VENTA").reduce((sum,m)=>sum + getTotalMovimiento(m),0);
  const importeDividendos = rows.filter(m=>m.tipo==="DIVIDENDO").reduce((sum,m)=>sum + getTotalMovimiento(m),0);
  const gastosCompras = rows.filter(m=>m.tipo==="COMPRA").reduce((sum,m)=>sum + getGastosOperacion(m.gastos),0);
  const gastosVentas = rows.filter(m=>m.tipo==="VENTA").reduce((sum,m)=>sum + getGastosOperacion(m.gastos),0);
  const beneficios = calcularBeneficios(agruparCartera());

  if(el("totalesMovimientos")){
    el("totalesMovimientos").innerHTML = `
      <span><strong>Movimientos:</strong> ${rows.length}</span>
      <span class="good"><strong>Compras:</strong> ${compras} · ${money(importeCompras, db.ajustes.moneda)}</span>
      <span class="bad"><strong>Ventas:</strong> ${ventas} · ${money(importeVentas, db.ajustes.moneda)}</span>
      <span class="good"><strong>Dividendos:</strong> ${dividendos} · ${money(importeDividendos, db.ajustes.moneda)}</span>
      <span><strong>Gastos compras/ventas:</strong> ${money(gastosCompras, db.ajustes.moneda)} / ${money(gastosVentas, db.ajustes.moneda)}</span>
      <span class="${beneficios.realizadoNeto>=0?'good':'bad'}"><strong>Real:</strong> ${money(beneficios.realizadoNeto, db.ajustes.moneda)} · ${formatearInteres(beneficios.interesReal)}</span>
      <span class="${beneficios.latenteNeto>=0?'good':'bad'}"><strong>Latente:</strong> ${money(beneficios.latenteNeto, db.ajustes.moneda)} · ${formatearInteres(beneficios.interesLatente)}</span>
      <span class="warn"><strong>Seguimiento:</strong> ${seguimiento}</span>
    `;
  }

  contenedor.innerHTML = rows.map(m=>{
    const panelId = `movimiento-${m.id}`;
    const tipoClass = m.tipo === "VENTA" ? "bad" : ["COMPRA", "DIVIDENDO"].includes(m.tipo) ? "good" : "warn";
    return `
      <article class="item-card movement-card">
        <div class="item-card-header movement-summary">
          <button class="icon-toggle" type="button" aria-expanded="false" aria-controls="${panelId}" onclick="togglePanelWithButton('${panelId}', this)">+</button>
          <div class="movement-summary-main">
            <span><strong>${m.fecha || "Sin fecha"}</strong></span>
            <span class="${tipoClass}">${m.tipo}</span>
            <span><strong>${m.nombre}</strong> <small class="muted">${m.ticker}</small></span>
            <span>${m.tipo === "SEGUIMIENTO" ? "-" : num(m.cantidad, 0)} acciones</span>
          </div>
        </div>
        <div id="${panelId}" class="collapsible closed item-card-body">
          <div class="detail-grid">
            <span><strong>Símbolo API:</strong> ${m.apiSymbol || "sin API"}</span>
            <span><strong>Exchange:</strong> ${m.exchange || "-"}</span>
            <span><strong>Precio / importe:</strong> ${m.tipo === "SEGUIMIENTO" ? "-" : money(m.precio, db.ajustes.moneda)}</span>
            <span><strong>Ret./Gastos:</strong> ${m.tipo === "SEGUIMIENTO" ? "-" : money(getGastosOperacion(m.gastos), db.ajustes.moneda)}</span>
            <span><strong>Total / neto:</strong> ${m.tipo === "SEGUIMIENTO" ? "-" : money(getTotalMovimiento(m), db.ajustes.moneda)}</span>
            <span><strong>Mercado / nota:</strong> ${m.mercado || "-"}</span>
          </div>
          ${m.notas ? `<p class="muted"><strong>Notas:</strong> ${m.notas}</p>` : ""}
          <div class="actions">
            <button class="small-btn edit" onclick="editarMovimiento('${m.id}')">Editar</button>
            <button class="small-btn delete" onclick="borrarMovimiento('${m.id}')">Borrar</button>
          </div>
        </div>
      </article>`;
  }).join("");

  if(!rows.length){
    contenedor.innerHTML = `<p class="muted placeholder">No hay movimientos.</p>`;
  }
}

function renderCartera(){
  const contenedor = el("tablaCartera");
  const cartera = agruparCartera();

  let totalAcciones = 0;
  let totalCompradas = 0;
  let totalVendidas = 0;
  let totalInvertido = 0;
  let totalValorActual = 0;
  let totalGastosCompra = 0;
  let totalGastosVenta = 0;
  const beneficios = calcularBeneficios(cartera);

  cartera.forEach(g=>{
    const latente = calcularResultadoLatente(g);
    totalAcciones += Number(g.cantidadNeta || 0);
    totalCompradas += Number(g.cantidadComprada || 0);
    totalVendidas += Number(g.cantidadVendida || 0);
    totalInvertido += Number(g.invertidoNeto || 0);
    totalValorActual += latente.valorActual;
    totalGastosCompra += Number(g.gastosCompra || 0);
    totalGastosVenta += Number(g.gastosVenta || 0);
  });

  if(el("totalesCartera")){
    el("totalesCartera").innerHTML = `
      <span><strong>Valores:</strong> ${cartera.length}</span>
      <span><strong>Acciones netas:</strong> ${num(totalAcciones,0)}</span>
      <span><strong>Compradas:</strong> ${num(totalCompradas,0)}</span>
      <span><strong>Vendidas:</strong> ${num(totalVendidas,0)}</span>
      <span><strong>Invertido abierto:</strong> ${money(totalInvertido, db.ajustes.moneda)}</span>
      <span><strong>Valor actual:</strong> ${money(totalValorActual, db.ajustes.moneda)}</span>
      <span class="${beneficios.realizadoNeto>=0?'good':'bad'}"><strong>Real:</strong> ${money(beneficios.realizadoNeto, db.ajustes.moneda)} · ${formatearInteres(beneficios.interesReal)}</span>
      <span class="${beneficios.latenteNeto>=0?'good':'bad'}"><strong>Latente:</strong> ${money(beneficios.latenteNeto, db.ajustes.moneda)} · ${formatearInteres(beneficios.interesLatente)}</span>
      <span><strong>Gastos compra/venta:</strong> ${money(totalGastosCompra, db.ajustes.moneda)} / ${money(totalGastosVenta, db.ajustes.moneda)}</span>
    `;
  }

  contenedor.innerHTML = cartera.map(g=>{
    const real = calcularResultadoReal(g);
    const latente = calcularResultadoLatente(g);
    const panelId = `cartera-${g.ticker}`;
    return `
      <article class="item-card portfolio-card">
        <div class="item-card-header portfolio-summary">
          <button class="icon-toggle" type="button" aria-expanded="false" aria-controls="${panelId}" onclick="togglePanelWithButton('${panelId}', this)">+</button>
          <div class="portfolio-summary-main">
            <span><strong>${g.nombre}</strong> <small class="muted">${g.ticker}</small></span>
            <span><strong>Acciones netas:</strong> ${num(g.cantidadNeta,0)}</span>
            <span><strong>Valor actual:</strong> ${latente.cot ? money(latente.valorActual, db.ajustes.moneda) : "Sin cotización"}</span>
          </div>
        </div>
        <div id="${panelId}" class="collapsible closed item-card-body">
          <div class="detail-grid">
            <span><strong>Símbolo API:</strong> ${g.apiSymbol || "sin API"}</span>
            <span><strong>Compradas:</strong> ${num(g.cantidadComprada,0)}</span>
            <span><strong>Vendidas:</strong> ${num(g.cantidadVendida,0)}</span>
            <span><strong>Invertido abierto:</strong> ${money(g.invertidoNeto, db.ajustes.moneda)}</span>
            <span><strong>Precio medio:</strong> ${money(g.precioMedio, db.ajustes.moneda)}</span>
            <span><strong>Última cotización:</strong> ${latente.cot ? money(latente.cot.price, db.ajustes.moneda) : "Sin cotización"}</span>
            <span class="${real.neto>=0?'good':'bad'}"><strong>Real:</strong> ${money(real.neto, db.ajustes.moneda)} · ${formatearInteres(real.interes)}</span>
            <span class="${latente.neto>=0?'good':'bad'}"><strong>Latente:</strong> ${latente.cot ? money(latente.neto, db.ajustes.moneda) + " · " + formatearInteres(latente.interes) : "-"}</span>
          </div>
          <h3>Movimientos</h3>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Fecha</th><th>Tipo</th><th>Cantidad</th><th>Precio / importe</th><th>Ret./Gastos</th><th>Total / neto</th></tr></thead>
              <tbody>
                ${g.movimientos.map(m=>`
                  <tr>
                    <td>${m.fecha}</td>
                    <td>${m.tipo}</td>
                    <td>${num(m.cantidad,0)}</td>
                    <td>${money(m.precio, db.ajustes.moneda)}</td>
                    <td>${money(getGastosOperacion(m.gastos), db.ajustes.moneda)}</td>
                    <td>${money(getTotalMovimiento(m), db.ajustes.moneda)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </article>`;
  }).join("");

  if(!cartera.length){
    contenedor.innerHTML = `<p class="muted placeholder">No hay posiciones reales.</p>`;
  }
}

function mostrarDetalleCartera(ticker){
  const g = agruparCartera().find(x=>x.ticker === ticker);
  if(!g) return;
  const panel = el("detalleCartera");
  if(!panel) return;
  const real = calcularResultadoReal(g);
  const latente = calcularResultadoLatente(g);
  panel.classList.remove("hidden");
  panel.innerHTML = `
    <h3>Detalle de ${g.nombre} (${g.ticker})</h3>
    <p><strong>Beneficio/pérdida real:</strong> <span class="${real.neto>=0?'good':'bad'}">${money(real.neto, db.ajustes.moneda)}</span> · ${formatearInteres(real.interes)} · ventas cerradas con coste FIFO fijo y dividendos netos.</p>
    <p><strong>Beneficio/pérdida latente:</strong> <span class="${latente.neto>=0?'good':'bad'}">${latente.cot ? money(latente.neto, db.ajustes.moneda) + ' · ' + formatearInteres(latente.interes) : '-'}</span> · acciones abiertas según cotización actual.</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Cantidad</th><th>Precio / importe</th><th>Ret./Gastos</th><th>Total / neto</th></tr></thead>
        <tbody>
          ${g.movimientos.map(m=>`
            <tr>
              <td>${m.fecha}</td>
              <td>${m.tipo}</td>
              <td>${num(m.cantidad,0)}</td>
              <td>${money(m.precio, db.ajustes.moneda)}</td>
              <td>${money(getGastosOperacion(m.gastos), db.ajustes.moneda)}</td>
              <td>${money(getTotalMovimiento(m), db.ajustes.moneda)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>`;
  marcarTablasResponsive();
}

function renderSeguimiento(){
  const tbody = el("tablaSeguimiento");
  const seg = getSeguimiento();
  tbody.innerHTML = seg.map(s=>{
    const cot = getCotizacion(s.ticker);
    return `<tr>
      <td><strong>${s.nombre}</strong></td>
      <td>${s.ticker}</td>
      <td>${s.apiSymbol || ""}</td>
      <td>${s.exchange || ""}</td>
      <td>${cot ? money(cot.price, db.ajustes.moneda) : "Sin cotización"}</td>
      <td>${cot ? new Date(cot.updatedAt).toLocaleString("es-ES") : "-"}</td>
      <td>${s.notas || ""}</td>
      <td>
        <button class="small-btn edit" onclick="editarMovimiento('${s.id}')">Editar</button>
        <button class="small-btn delete" onclick="borrarMovimiento('${s.id}')">Borrar</button>
      </td>
    </tr>`;
  }).join("");

  if(!seg.length){
    tbody.innerHTML = `<tr><td colspan="8" class="muted">No hay valores en seguimiento.</td></tr>`;
  }
}

function renderCotizaciones(){
  const tbody = el("tablaCotizaciones");
  const valores = getTodosValoresCotizables();
  const carteraPorTicker = Object.fromEntries(agruparCartera().map(g=>[g.ticker, g]));

  tbody.innerHTML = valores.map(v=>{
    const cot = getCotizacion(v.ticker);
    const cartera = carteraPorTicker[v.ticker];
    const real = cartera ? calcularResultadoReal(cartera) : null;
    const latente = cartera ? calcularResultadoLatente(cartera) : null;
    return `<tr>
      <td>${v.tipo}</td>
      <td><strong>${v.nombre}</strong><br><small class="muted">${v.ticker}</small></td>
      <td><input value="${v.apiSymbol || ""}" onchange="actualizarApiSymbol('${v.ticker}', this.value)" placeholder="SAN, BBVA, MAP"></td>
      <td><input value="${v.exchange || ""}" onchange="actualizarExchange('${v.ticker}', this.value)" placeholder="XMAD"></td>
      <td><input type="number" step="0.000001" value="${cot ? cot.price : ""}" placeholder="Precio" onchange="guardarCotizacionManual('${v.ticker}', this.value)"></td>
      <td>${cot ? new Date(cot.updatedAt).toLocaleString("es-ES") + " · " + cot.source : "-"}</td>
      <td class="${real && real.neto>=0?'good':'bad'}">${real ? money(real.neto, db.ajustes.moneda) + " · " + formatearInteres(real.interes) : "-"}</td>
      <td class="${latente && latente.neto>=0?'good':'bad'}">${latente && latente.cot ? money(latente.neto, db.ajustes.moneda) + " · " + formatearInteres(latente.interes) : "-"}</td>
      <td>
        <button class="small-btn edit" onclick="actualizarUnaApi('${v.ticker}')">API</button>
      </td>
    </tr>`;
  }).join("");

  if(!valores.length){
    tbody.innerHTML = `<tr><td colspan="9" class="muted">No hay valores para cotizar. Añade compras o seguimiento.</td></tr>`;
  }
}

function actualizarExchange(ticker, exchange){
  db.movimientos.forEach(m=>{
    if(m.ticker === ticker) m.exchange = exchange.trim().toUpperCase();
  });
  saveDB(db);
  renderAll();
  setStatus("Exchange actualizado.");
}

function actualizarApiSymbol(ticker, symbol){
  db.movimientos.forEach(m=>{
    if(m.ticker === ticker) m.apiSymbol = symbol.trim().toUpperCase();
  });
  saveDB(db);
  renderAll();
  setStatus("Símbolo API actualizado.");
}

function guardarCotizacionManual(ticker, value){
  if(!value) return;
  setCotizacion(ticker, Number(value), "manual");
  renderAll();
  setStatus("Cotización manual guardada.");
}

async function actualizarUnaApi(ticker){
  const valor = getTodosValoresCotizables().find(v=>v.ticker === ticker);
  if(!valor) return;
  try{
    setStatus("Descargando cotización de " + ticker + "...");
    const r = await descargarCotizacion(db.ajustes.provider, db.ajustes.apiKey, valor.apiSymbol, valor.exchange);
    setCotizacion(ticker, r.price, db.ajustes.provider);
    renderAll();
    setStatus("Cotización actualizada: " + ticker);
  }catch(e){
    alert(e.message + "\nPuedes introducir la cotización manualmente.");
    setStatus("Falló API. Puedes usar cotización manual.");
  }
}

async function actualizarTodasApi(esAutomatico = false){
  if(actualizarTodasApi.enCurso) return;
  const valores = getTodosValoresCotizables();
  if(!valores.length) return;
  actualizarTodasApi.enCurso = true;
  if(esAutomatico) setStatus("Actualizando cotizaciones automáticamente...");
  try{
    for(const v of valores){
      try{
        const r = await descargarCotizacion(db.ajustes.provider, db.ajustes.apiKey, v.apiSymbol, v.exchange);
        setCotizacion(v.ticker, r.price, db.ajustes.provider);
      }catch(e){
        console.warn("Error cotizando", v.ticker, e);
      }
    }
    renderAll();
    setStatus(esAutomatico
      ? "Cotizaciones actualizadas automáticamente al abrir/visualizar la app."
      : "Proceso de actualización API finalizado. Revisa si algún valor quedó sin actualizar.");
  } finally {
    actualizarTodasApi.enCurso = false;
  }
}

function renderComparativa(){
  const tbody = el("tablaComparativa");
  const carteraCompleta = agruparCartera();
  const cartera = carteraCompleta.filter(g=>g.cantidadNeta > 0);
  const beneficios = calcularBeneficios(carteraCompleta);

  const rows = cartera.map(g=>{
    const real = calcularResultadoReal(g);
    const latente = calcularResultadoLatente(g);

    return `<tr>
      <td><strong>${g.nombre}</strong><br><small class="muted">${g.ticker}</small></td>
      <td>${num(g.cantidadNeta,0)}</td>
      <td>${money(g.invertidoNeto, db.ajustes.moneda)}</td>
      <td>${latente.cot ? money(latente.valorActual, db.ajustes.moneda) : "Sin cotización"}</td>
      <td>${latente.cot ? money(latente.gastosVenta, db.ajustes.moneda) : "-"}</td>
      <td class="${real.neto>=0?'good':'bad'}">${money(real.neto, db.ajustes.moneda)}<br><small>${formatearInteres(real.interes)}</small></td>
      <td class="${latente.bruto>=0?'good':'bad'}">${latente.cot ? money(latente.bruto, db.ajustes.moneda) : "-"}</td>
      <td class="${latente.neto>=0?'good':'bad'}">${latente.cot ? money(latente.neto, db.ajustes.moneda) + "<br><small>" + formatearInteres(latente.interes) + "</small>" : "-"}</td>
      <td class="${latente.rentabilidad>=0?'good':'bad'}">${latente.cot ? num(latente.rentabilidad,2)+" %" : "-"}</td>
    </tr>`;
  });

  if(el("totalesComparativa")){
    el("totalesComparativa").innerHTML = `
      <span><strong>Valores abiertos:</strong> ${cartera.length}</span>
      <span><strong>Invertido abierto:</strong> ${money(beneficios.invertidoAbierto, db.ajustes.moneda)}</span>
      <span><strong>Valor actual:</strong> ${money(beneficios.valorActual, db.ajustes.moneda)}</span>
      <span><strong>Gastos venta estimados:</strong> ${money(beneficios.gastosVentaEstimados, db.ajustes.moneda)}</span>
      <span class="${beneficios.realizadoNeto>=0?'good':'bad'}"><strong>Real neto:</strong> ${money(beneficios.realizadoNeto, db.ajustes.moneda)} · ${formatearInteres(beneficios.interesReal)}</span>
      <span class="${beneficios.latenteBruto>=0?'good':'bad'}"><strong>Latente bruto:</strong> ${money(beneficios.latenteBruto, db.ajustes.moneda)}</span>
      <span class="${beneficios.latenteNeto>=0?'good':'bad'}"><strong>Latente neto:</strong> ${money(beneficios.latenteNeto, db.ajustes.moneda)} · ${formatearInteres(beneficios.interesLatente)}</span>
    `;
  }

  tbody.innerHTML = rows.join("");

  if(!cartera.length){
    tbody.innerHTML = `<tr><td colspan="9" class="muted">No hay posiciones abiertas para comparar.</td></tr>`;
  }
}



function crearContextoIntradiaParaIA(cartera){
  return cartera
    .filter(v=>Number(v.acciones_netas) > 0 && Number(v.ultima_cotizacion) > 0)
    .map(v=>({
      ticker: v.ticker,
      nombre: v.nombre,
      cantidad_actual: v.acciones_netas,
      precio_actual: v.ultima_cotizacion,
      valor_actual: v.valor_actual,
      precio_medio: v.precio_medio,
      rentabilidad_latente_pct: v.rentabilidad_latente_pct,
      fecha_cotizacion: v.fecha_cotizacion,
      criterios: {
        objetivo: "órdenes limitadas diarias realistas para colocar al inicio de sesión",
        compras: "2 tramos por debajo o cerca del precio actual, con posibilidad razonable de ejecutarse durante el día; no usar precios muy alejados",
        ventas: "2 tramos por encima o cerca del precio actual, parciales y ejecutables en sesión si hay movimiento normal",
        cartera_completa: "incluir obligatoriamente una ficha intradía para este valor; si no hay compra o venta recomendable, marcar NO_COMPRAR o NO_VENDER en lugar de inventar una orden",
        vencimiento: "diario",
        tipo_orden: "limitada",
        evitar: "órdenes imposibles, importes desproporcionados o ventas de más acciones que las disponibles"
      }
    }));
}

function generarDatosParaIA(){
  const carteraAgrupada = agruparCartera();
  const beneficios = calcularBeneficios(carteraAgrupada);
  const cartera = carteraAgrupada.map(g=>{
    const real = calcularResultadoReal(g);
    const latente = calcularResultadoLatente(g);

    return {
      nombre: g.nombre,
      ticker: g.ticker,
      simbolo_api: g.apiSymbol || "",
      exchange: g.exchange || "",
      acciones_netas: g.cantidadNeta,
      acciones_compradas: g.cantidadComprada,
      acciones_vendidas: g.cantidadVendida,
      invertido_abierto: Number(g.invertidoNeto.toFixed(4)),
      precio_medio: Number(g.precioMedio.toFixed(6)),
      ultima_cotizacion: latente.cot ? latente.cot.price : null,
      fecha_cotizacion: latente.cot ? latente.cot.updatedAt : null,
      valor_actual: latente.cot ? Number(latente.valorActual.toFixed(4)) : null,
      beneficio_real_bruto: Number(real.bruto.toFixed(4)),
      beneficio_real_neto: Number(real.neto.toFixed(4)),
      interes_real_generado: Number(real.interes.generado.toFixed(4)),
      interes_real_actual_pct: Number(real.interes.actualPct.toFixed(4)),
      interes_real_anual_pct: Number(real.interes.anualPct.toFixed(4)),
      dias_beneficio_real: Number(real.interes.dias.toFixed(2)),
      capital_usado_real: Number(real.interes.capitalUsado.toFixed(4)),
      dividendos_brutos: Number(g.dividendosBrutos.toFixed(4)),
      retenciones_dividendos: Number(g.retencionesDividendos.toFixed(4)),
      dividendos_netos: Number(g.dividendosNetos.toFixed(4)),
      beneficio_latente_bruto: latente.cot ? Number(latente.bruto.toFixed(4)) : null,
      beneficio_latente_neto: latente.cot ? Number(latente.neto.toFixed(4)) : null,
      rentabilidad_latente_pct: latente.cot ? Number(latente.rentabilidad.toFixed(4)) : null,
      interes_latente_generado: latente.cot ? Number(latente.interes.generado.toFixed(4)) : null,
      interes_latente_actual_pct: latente.cot ? Number(latente.interes.actualPct.toFixed(4)) : null,
      interes_latente_anual_pct: latente.cot ? Number(latente.interes.anualPct.toFixed(4)) : null,
      dias_beneficio_latente: latente.cot ? Number(latente.interes.dias.toFixed(2)) : null,
      capital_usado_latente: latente.cot ? Number(latente.interes.capitalUsado.toFixed(4)) : null,
      movimientos: g.movimientos.map(m=>({
        fecha: m.fecha,
        tipo: m.tipo,
        cantidad: m.cantidad,
        precio: m.precio,
        gastos: m.tipo === "DIVIDENDO" ? 0 : getGastosOperacion(m.gastos),
        retencion: m.tipo === "DIVIDENDO" ? getGastosOperacion(m.gastos) : 0,
        total: getTotalMovimiento(m),
        dividendo_neto: m.tipo === "DIVIDENDO" ? getTotalMovimiento(m) : 0,
        notas: m.notas || ""
      }))
    };
  });

  const seguimiento = getSeguimiento().map(s=>{
    const cot = getCotizacion(s.ticker);
    return {
      nombre: s.nombre,
      ticker: s.ticker,
      simbolo_api: s.apiSymbol || "",
      exchange: s.exchange || "",
      ultima_cotizacion: cot ? cot.price : null,
      fecha_cotizacion: cot ? cot.updatedAt : null,
      notas: s.notas || ""
    };
  });

  return {
    tipo: "mibolsa_cartera_para_chatgpt",
    version: "1.0",
    fecha_exportacion: new Date().toISOString(),
    moneda: db.ajustes.moneda || "EUR",
    ajustes: {
      gastos_venta_pct: db.ajustes.ventaPct,
      gastos_venta_minimo: db.ajustes.ventaMin,
      impuesto_plusvalia_pct: db.ajustes.impuestoPct
    },
    prompt_usuario: db.ajustes.promptIA || "",
    beneficios: {
      real_bruto: Number(beneficios.realizadoBruto.toFixed(4)),
      real_neto: Number(beneficios.realizadoNeto.toFixed(4)),
      dividendos_brutos: Number(beneficios.dividendosBrutos.toFixed(4)),
      retenciones_dividendos: Number(beneficios.retencionesDividendos.toFixed(4)),
      dividendos_netos: Number(beneficios.dividendosNetos.toFixed(4)),
      latente_bruto: Number(beneficios.latenteBruto.toFixed(4)),
      latente_neto: Number(beneficios.latenteNeto.toFixed(4)),
      interes_real_generado: Number(beneficios.interesReal.generado.toFixed(4)),
      interes_real_actual_pct: Number(beneficios.interesReal.actualPct.toFixed(4)),
      interes_real_anual_pct: Number(beneficios.interesReal.anualPct.toFixed(4)),
      dias_beneficio_real: Number(beneficios.interesReal.dias.toFixed(2)),
      capital_usado_real: Number(beneficios.interesReal.capitalUsado.toFixed(4)),
      interes_latente_generado: Number(beneficios.interesLatente.generado.toFixed(4)),
      interes_latente_actual_pct: Number(beneficios.interesLatente.actualPct.toFixed(4)),
      interes_latente_anual_pct: Number(beneficios.interesLatente.anualPct.toFixed(4)),
      dias_beneficio_latente: Number(beneficios.interesLatente.dias.toFixed(2)),
      capital_usado_latente: Number(beneficios.interesLatente.capitalUsado.toFixed(4)),
      nota: "Real = ventas cerradas con coste FIFO fijo y dividendos netos. Latente = posiciones abiertas según última cotización."
    },
    cartera,
    seguimiento,
    intradia_contexto: crearContextoIntradiaParaIA(cartera),
    instrucciones_respuesta: {
      formato: "JSON estricto sin markdown",
      recomendaciones_validas: ["VENDER", "MANTENER", "COMPRAR", "NO_ENTRAR"],
      estructura_esperada: {
        fecha: "YYYY-MM-DD",
        lectura_general: "texto breve",
        mercado: "texto breve opcional",
        acciones: [
          {
            ticker: "SAN",
            nombre: "Banco Santander",
            recomendacion: "MANTENER",
            comentario: "texto",
            situacion_actual: {
              precio_medio: 10.0,
              precio_actual: 10.46,
              beneficio_pct: 4.6
            },
            ventas: [
              {"tramo": 1, "precio": 11.8, "cantidad_pct": 25, "descripcion": "primera venta parcial"},
              {"tramo": 2, "precio": 12.8, "cantidad_pct": 25, "descripcion": "segunda venta parcial"},
              {"tramo": 3, "precio": 14.0, "cantidad_pct": 50, "descripcion": "recogida fuerte"}
            ],
            compras: [
              {"tramo": 1, "precio": 9.8, "cantidad_euros": 1000, "descripcion": "compra"},
              {"tramo": 2, "precio": 9.5, "cantidad_euros": 1500, "descripcion": "compra fuerte"}
            ],
            riesgo: "medio",
            prioridad: "alta"
          }
        ],
        operaciones_intradia: {
          fecha_hora_calculo: "YYYY-MM-DDTHH:mm:ss.sssZ",
          criterio: "Órdenes limitadas diarias calculadas con los datos actuales y distintas de recomendaciones IA. Debe incluir todos los valores de cartera con cotización; si una operación no se recomienda, indicar NO_COMPRAR o NO_VENDER.",
          ordenes: [
            {
              ticker: "SAN",
              nombre: "Banco Santander",
              cantidad_actual: 100,
              precio_actual: 10.46,
              valor_actual: 1046,
              compra_tramo_1: {accion: "COMPRAR", precio_limite: 10.35, cantidad_acciones: 20, importe_estimado: 207, probabilidad_ejecucion: "media", motivo: "retroceso intradía cercano"},
              compra_tramo_2: {accion: "COMPRAR", precio_limite: 10.22, cantidad_acciones: 20, importe_estimado: 204.4, probabilidad_ejecucion: "baja-media", motivo: "retroceso más exigente pero posible"},
              venta_tramo_1: {accion: "NO_VENDER", motivo: "no crear una venta intradía artificial si el objetivo realista no es alcanzable hoy"},
              venta_tramo_2: {accion: "NO_VENDER", motivo: "mantener; precio de venta recomendable demasiado alejado para sesión intradía"},
              vencimiento: "diario",
              tipo_orden: "limitada",
              comentario: "texto breve"
            }
          ]
        }
      }
    }
  };
}

function generarJsonParaIA(){
  const data = generarDatosParaIA();
  el("jsonSalidaIA").value = JSON.stringify(data, null, 2);
  setStatus("JSON de cartera generado para ChatGPT.");
}

async function copiarJsonIA(){
  if(!el("jsonSalidaIA").value.trim()){
    generarJsonParaIA();
  }
  await navigator.clipboard.writeText(el("jsonSalidaIA").value);
  setStatus("JSON copiado al portapapeles.");
}

function descargarJsonIA(){
  const data = el("jsonSalidaIA").value.trim() || JSON.stringify(generarDatosParaIA(), null, 2);
  downloadFile("mibolsa_para_chatgpt_" + today() + ".json", data);
  setStatus("JSON descargado.");
}

function getPromptBaseIA(){
  const promptUsuario = db.ajustes.promptIA || "Analiza este JSON de mi cartera personal y devuelve recomendaciones en JSON válido.";
  const estructura = {
    fecha: "YYYY-MM-DD",
    lectura_general: "texto",
    mercado: "texto opcional",
    acciones: [
      {
        ticker: "SAN",
        nombre: "Banco Santander",
        recomendacion: "MANTENER",
        comentario: "texto",
        situacion_actual: {
          precio_medio: 10.0,
          precio_actual: 10.46,
          beneficio_pct: 4.6
        },
        ventas: [
          {tramo: 1, precio: 11.8, cantidad_pct: 25, descripcion: "primera venta parcial"},
          {tramo: 2, precio: 12.8, cantidad_pct: 25, descripcion: "segunda venta parcial"},
          {tramo: 3, precio: 14.0, cantidad_pct: 50, descripcion: "recogida fuerte"}
        ],
        compras: [
          {tramo: 1, precio: 9.8, cantidad_euros: 1000, descripcion: "compra"},
          {tramo: 2, precio: 9.5, cantidad_euros: 1500, descripcion: "compra fuerte"}
        ],
        riesgo: "medio",
        prioridad: "alta"
      }
    ],
    operaciones_intradia: {
      fecha_hora_calculo: "YYYY-MM-DDTHH:mm:ss.sssZ",
      criterio: "órdenes limitadas diarias realistas calculadas con los datos actuales, separadas de recomendaciones IA; incluir todos los valores de cartera con cotización y usar NO_COMPRAR o NO_VENDER cuando no proceda",
      ordenes: [
        {
          ticker: "SAN",
          nombre: "Banco Santander",
          cantidad_actual: 100,
          precio_actual: 10.46,
          valor_actual: 1046,
          compra_tramo_1: {accion: "COMPRAR", precio_limite: 10.35, cantidad_acciones: 20, importe_estimado: 207, probabilidad_ejecucion: "media", motivo: "retroceso intradía cercano"},
          compra_tramo_2: {accion: "COMPRAR", precio_limite: 10.22, cantidad_acciones: 20, importe_estimado: 204.4, probabilidad_ejecucion: "baja-media", motivo: "retroceso más exigente pero posible"},
          venta_tramo_1: {accion: "NO_VENDER", motivo: "no crear una venta intradía artificial si el objetivo realista no es alcanzable hoy"},
          venta_tramo_2: {accion: "NO_VENDER", motivo: "mantener; precio de venta recomendable demasiado alejado para sesión intradía"},
          vencimiento: "diario",
          tipo_orden: "limitada",
          comentario: "texto breve"
        }
      ]
    }
  };

  return promptUsuario
    + "\n\nIMPORTANTE:\nDevuelve SOLO JSON válido, sin markdown, sin comentarios fuera del JSON. En operaciones_intradia incluye toda mi cartera con cotización actual; si no recomiendas compra intradía pon NO_COMPRAR en el ticket de compra, y si no recomiendas venta intradía pon NO_VENDER en el ticket de venta, sin inventar una orden contraria."
    + "\n\nEstructura obligatoria:\n"
    + JSON.stringify(estructura, null, 2)
    + "\n\nDatos de mi cartera:\n"
    + JSON.stringify(generarDatosParaIA(), null, 2);
}

async function copiarPromptIA(){
  const prompt = getPromptBaseIA();
  await navigator.clipboard.writeText(prompt);
  setStatus("Prompt base copiado. Pégalo en ChatGPT.");
}

function getPrimerValorDefinido(...values){
  return values.find(value=>value !== undefined && value !== null && value !== "");
}

function normalizarOperacionIntradia(orden, accion={}){
  if(!orden || typeof orden !== "object") return null;

  const normalizada = {
    ...orden,
    ticker: getPrimerValorDefinido(orden.ticker, orden.valor, orden.simbolo, accion.ticker),
    nombre: getPrimerValorDefinido(orden.nombre, orden.accion, accion.nombre),
    cantidad_actual: getPrimerValorDefinido(orden.cantidad_actual, orden.acciones_actuales, orden.cantidad_cartera, orden.cantidad, accion.cantidad_actual),
    precio_actual: getPrimerValorDefinido(orden.precio_actual, orden.cotizacion_actual, orden.cotizacion, accion.precio_actual),
    precio_inicial: getPrimerValorDefinido(orden.precio_inicial, orden.precio_inicial_intradia, orden.precio_carga, orden.precio_actual, orden.cotizacion_actual, orden.cotizacion, accion.precio_actual),
    valor_actual: getPrimerValorDefinido(orden.valor_actual, orden.importe_actual),
    compra_tramo_1: getPrimerValorDefinido(orden.compra_tramo_1, orden.compra1, orden.compra_1),
    compra_tramo_2: getPrimerValorDefinido(orden.compra_tramo_2, orden.compra2, orden.compra_2),
    venta_tramo_1: getPrimerValorDefinido(orden.venta_tramo_1, orden.venta1, orden.venta_1),
    venta_tramo_2: getPrimerValorDefinido(orden.venta_tramo_2, orden.venta2, orden.venta_2),
    vencimiento: getPrimerValorDefinido(orden.vencimiento, "diario"),
    tipo_orden: getPrimerValorDefinido(orden.tipo_orden, orden.tipo, "limitada")
  };

  if(Array.isArray(orden.compras)){
    normalizada.compra_tramo_1 = normalizada.compra_tramo_1 || orden.compras[0];
    normalizada.compra_tramo_2 = normalizada.compra_tramo_2 || orden.compras[1];
  }
  if(Array.isArray(orden.ventas)){
    normalizada.venta_tramo_1 = normalizada.venta_tramo_1 || orden.ventas[0];
    normalizada.venta_tramo_2 = normalizada.venta_tramo_2 || orden.ventas[1];
  }
  if(orden.operaciones && typeof orden.operaciones === "object"){
    normalizada.compra_tramo_1 = normalizada.compra_tramo_1 || orden.operaciones.compra_tramo_1 || orden.operaciones.compra1;
    normalizada.compra_tramo_2 = normalizada.compra_tramo_2 || orden.operaciones.compra_tramo_2 || orden.operaciones.compra2;
    normalizada.venta_tramo_1 = normalizada.venta_tramo_1 || orden.operaciones.venta_tramo_1 || orden.operaciones.venta1;
    normalizada.venta_tramo_2 = normalizada.venta_tramo_2 || orden.operaciones.venta_tramo_2 || orden.operaciones.venta2;
  }

  return normalizada;
}

function normalizarBloqueIntradia(intradia, obj={}){
  if(!intradia) return null;

  if(Array.isArray(intradia)){
    return {
      fecha_hora_calculo: obj.fecha_hora_calculo || obj.fecha || new Date().toISOString(),
      criterio: obj.criterio_intradia || "Órdenes intradía importadas desde la respuesta de ChatGPT.",
      ordenes: intradia.map(o=>normalizarOperacionIntradia(o)).filter(Boolean)
    };
  }

  if(typeof intradia !== "object") return null;

  const ordenes = getPrimerValorDefinido(
    intradia.ordenes,
    intradia.ordenes_intradia,
    intradia.operaciones,
    intradia.valores,
    intradia.acciones,
    intradia.recomendaciones_intradia
  );

  let ordenesNormalizadas = [];
  if(Array.isArray(ordenes)){
    ordenesNormalizadas = ordenes.map(o=>normalizarOperacionIntradia(o)).filter(Boolean);
  }else if(ordenes && typeof ordenes === "object"){
    ordenesNormalizadas = Object.entries(ordenes)
      .map(([ticker, orden])=>normalizarOperacionIntradia({ticker, ...orden}))
      .filter(Boolean);
  }else if(intradia.ticker || intradia.compra_tramo_1 || intradia.compra1 || intradia.venta_tramo_1 || intradia.venta1 || Array.isArray(intradia.compras) || Array.isArray(intradia.ventas)){
    ordenesNormalizadas = [normalizarOperacionIntradia(intradia)].filter(Boolean);
  }else{
    const clavesMeta = new Set(["fecha", "fecha_hora_calculo", "criterio", "comentario", "tipo_orden", "vencimiento"]);
    ordenesNormalizadas = Object.entries(intradia)
      .filter(([key, value])=>!clavesMeta.has(key) && value && typeof value === "object")
      .map(([ticker, orden])=>normalizarOperacionIntradia({ticker, ...orden}))
      .filter(Boolean);
  }

  return {
    ...intradia,
    fecha_hora_calculo: intradia.fecha_hora_calculo || intradia.fecha || obj.fecha_hora_calculo || obj.fecha || new Date().toISOString(),
    ordenes: ordenesNormalizadas
  };
}

function extraerOperacionesIntradiaDeAcciones(acciones){
  if(!Array.isArray(acciones)) return [];
  return acciones.flatMap(accion=>{
    const intradia = accion.operaciones_intradia || accion.operacionesIntradia || accion.intradia || accion.ordenes_intradia;
    if(!intradia) return [];
    if(Array.isArray(intradia)){
      return intradia.map(o=>normalizarOperacionIntradia(o, accion)).filter(Boolean);
    }
    if(intradia.ordenes || intradia.ordenes_intradia || intradia.operaciones){
      const bloque = normalizarBloqueIntradia(intradia, accion);
      return bloque && Array.isArray(bloque.ordenes) ? bloque.ordenes.map(o=>normalizarOperacionIntradia(o, accion)).filter(Boolean) : [];
    }
    return [normalizarOperacionIntradia(intradia, accion)].filter(Boolean);
  });
}

function normalizarRespuestaIA(obj){
  if(Array.isArray(obj)){
    return {fecha: today(), lectura_general: "", acciones: obj};
  }
  if(!obj.acciones && obj.recomendaciones){
    obj.acciones = obj.recomendaciones;
  }
  if(!Array.isArray(obj.acciones)){
    throw new Error("El JSON debe contener un array llamado 'acciones'.");
  }

  const intradia = obj.operacionesIntradia || obj.operaciones_intradia || obj.intradia || obj.ordenes_intradia || obj.operaciones_diarias;
  const bloqueIntradia = normalizarBloqueIntradia(intradia, obj);
  const ordenesDesdeAcciones = extraerOperacionesIntradiaDeAcciones(obj.acciones);

  if(bloqueIntradia){
    if(!Array.isArray(bloqueIntradia.ordenes)) bloqueIntradia.ordenes = [];
    bloqueIntradia.ordenes = bloqueIntradia.ordenes.concat(ordenesDesdeAcciones);
    obj.operacionesIntradia = bloqueIntradia;
  }else if(ordenesDesdeAcciones.length){
    obj.operacionesIntradia = {
      fecha_hora_calculo: obj.fecha_hora_calculo || obj.fecha || new Date().toISOString(),
      criterio: "Órdenes intradía importadas desde cada acción de la respuesta de ChatGPT.",
      ordenes: ordenesDesdeAcciones
    };
  }

  return obj;
}


function fijarPreciosInicialesIntradia(obj){
  const ordenes = obj?.operacionesIntradia?.ordenes;
  if(!Array.isArray(ordenes)) return;
  ordenes.forEach(orden=>{
    const ticker = orden?.ticker;
    const cot = ticker ? getCotizacion(ticker) : null;
    const precioCarga = getPrimerValorDefinido(orden.precio_inicial, orden.precio_inicial_intradia, orden.precio_carga, orden.precio_actual, orden.cotizacion_actual, orden.cotizacion, cot?.price);
    if(precioCarga !== undefined && precioCarga !== null && precioCarga !== ""){
      orden.precio_inicial = precioCarga;
    }
    if((orden.precio_actual === undefined || orden.precio_actual === null || orden.precio_actual === "") && cot?.price !== undefined){
      orden.precio_actual = cot.price;
    }
  });
}

function cargarRespuestaIA(){
  const raw = el("jsonEntradaIA").value.trim();
  if(!raw){
    alert("Pega primero el JSON devuelto por ChatGPT.");
    return;
  }

  try{
    const jsonLimpio = extraerJsonValido(raw);
    const obj = normalizarRespuestaIA(JSON.parse(jsonLimpio));
    fijarPreciosInicialesIntradia(obj);
    db.recomendacionesIA = {
      ...obj,
      cargado_en: new Date().toISOString()
    };
    saveDB(db);
    renderRecomendacionesIA();
    renderOperacionesIntradia();
    setStatus("Recomendaciones IA y operaciones intradía cargadas correctamente.");
  }catch(e){
    alert("JSON no válido: " + e.message);
  }
}

function pegarEjemploRespuestaIA(){
  const ejemplo = {
    fecha: today(),
    lectura_general: "El mercado está validando la entrada. No se recomienda vender todavía salvo llegada a objetivos.",
    mercado: "Escenario de seguimiento manual. Revisar precios antes de ejecutar órdenes.",
    acciones: [
      {
        ticker: "BBVA",
        nombre: "BBVA",
        recomendacion: "MANTENER",
        comentario: "Entrada validada. Mantener mientras no pierda soportes.",
        situacion_actual: {precio_medio: 17.93, precio_actual: 18.48, beneficio_pct: 3.0},
        ventas: [
          {tramo: 1, precio: 21.50, cantidad_pct: 25, descripcion: "primera venta parcial"},
          {tramo: 2, precio: 23.50, cantidad_pct: 25, descripcion: "segunda venta parcial"},
          {tramo: 3, precio: 25.00, cantidad_pct: 50, descripcion: "recogida fuerte"}
        ],
        compras: [
          {tramo: 1, precio: 17.20, cantidad_euros: 1000, descripcion: "compra"},
          {tramo: 2, precio: 16.50, cantidad_euros: 1500, descripcion: "compra fuerte"}
        ],
        riesgo: "medio",
        prioridad: "alta"
      },
      {
        ticker: "SAN",
        nombre: "Banco Santander",
        recomendacion: "MANTENER",
        comentario: "Valor fuerte de la cartera. No vender en fase inicial.",
        situacion_actual: {precio_medio: 10.00, precio_actual: 10.46, beneficio_pct: 4.6},
        ventas: [
          {tramo: 1, precio: 11.80, cantidad_pct: 25, descripcion: "primera venta parcial"},
          {tramo: 2, precio: 12.80, cantidad_pct: 25, descripcion: "segunda venta parcial"},
          {tramo: 3, precio: 14.00, cantidad_pct: 50, descripcion: "fuerte recogida"}
        ],
        compras: [
          {tramo: 1, precio: 9.80, cantidad_euros: 1000, descripcion: "compra"},
          {tramo: 2, precio: 9.50, cantidad_euros: 1500, descripcion: "compra fuerte"}
        ],
        riesgo: "medio",
        prioridad: "alta"
      },
      {
        ticker: "MAP",
        nombre: "Mapfre",
        recomendacion: "MANTENER",
        comentario: "Más lenta que BBVA y Santander. Esperar antes de ampliar.",
        situacion_actual: {precio_medio: 4.12, precio_actual: 4.17, beneficio_pct: 1.2},
        ventas: [
          {tramo: 1, precio: 4.80, cantidad_pct: 25, descripcion: "primera venta parcial"},
          {tramo: 2, precio: 5.20, cantidad_pct: 25, descripcion: "segunda venta parcial"},
          {tramo: 3, precio: 5.60, cantidad_pct: 50, descripcion: "fuerte recogida"}
        ],
        compras: [
          {tramo: 1, precio: 3.90, cantidad_euros: 1000, descripcion: "esperar compra"},
          {tramo: 2, precio: 3.70, cantidad_euros: 1500, descripcion: "compra fuerte"}
        ],
        riesgo: "medio",
        prioridad: "media"
      }
    ],
    operaciones_intradia: {
      fecha_hora_calculo: new Date().toISOString(),
      criterio: "Órdenes limitadas diarias realistas para preparar al inicio de sesión.",
      ordenes: [
        {
          ticker: "BBVA",
          nombre: "BBVA",
          cantidad_actual: 335,
          precio_actual: 18.48,
          valor_actual: 6190.8,
          compra_tramo_1: {precio_limite: 18.32, cantidad_acciones: 25, importe_estimado: 458, probabilidad_ejecucion: "media", motivo: "retroceso intradía cercano"},
          compra_tramo_2: {precio_limite: 18.12, cantidad_acciones: 25, importe_estimado: 453, probabilidad_ejecucion: "baja-media", motivo: "retroceso más exigente"},
          venta_tramo_1: {precio_limite: 18.68, cantidad_acciones: 50, importe_estimado: 934, probabilidad_ejecucion: "media", motivo: "rebote cercano"},
          venta_tramo_2: {precio_limite: 18.92, cantidad_acciones: 50, importe_estimado: 946, probabilidad_ejecucion: "baja-media", motivo: "extensión diaria posible"},
          vencimiento: "diario",
          tipo_orden: "limitada",
          comentario: "Ajustar si la apertura se aleja mucho del precio actual."
        }
      ]
    }
  };
  el("jsonEntradaIA").value = JSON.stringify(ejemplo, null, 2);
  setStatus("Ejemplo pegado.");
}

function borrarRecomendacionesIA(){
  if(!confirm("¿Borrar recomendaciones IA guardadas?")) return;
  db.recomendacionesIA = null;
  saveDB(db);
  renderRecomendacionesIA();
  renderOperacionesIntradia();
  setStatus("Recomendaciones IA y operaciones intradía borradas.");
}

function claseRecomendacionIA(rec){
  const r = (rec || "").toUpperCase();
  if(r === "COMPRAR") return "bad";
  if(r === "MANTENER") return "warn";
  if(r === "VENDER") return "good";
  if(r === "NO_ENTRAR") return "muted";
  return "";
}

function renderTramosIA(tramos, tipo){
  if(!Array.isArray(tramos) || !tramos.length){
    return `<p class="muted">Sin tramos de ${tipo}.</p>`;
  }

  return `<div class="ia-tramos">
    ${tramos.map(t=>`
      <div class="ia-tramo ${tipo}">
        <strong>Tramo ${t.tramo ?? ""}</strong>
        <span>Precio: ${t.precio ?? "-"}</span>
        <span>${t.cantidad_pct !== undefined ? "Cantidad: " + t.cantidad_pct + "%" : ""}</span>
        <span>${t.cantidad_euros !== undefined ? "Importe: " + money(t.cantidad_euros, db.ajustes.moneda) : ""}</span>
        <small>${t.descripcion || ""}</small>
      </div>
    `).join("")}
  </div>`;
}

function renderRecomendacionesIA(){
  const resumen = el("panelResumenIA");
  const panel = el("panelRecomendacionesIA");
  if(!resumen || !panel) return;

  const data = db.recomendacionesIA;
  if(!data){
    resumen.innerHTML = `<p class="muted">Todavía no hay recomendaciones cargadas. Genera el JSON, pásalo a ChatGPT y pega aquí la respuesta.</p>`;
    panel.innerHTML = "";
    return;
  }

  resumen.innerHTML = `
    <div class="totals-bar">
      <span><strong>Fecha análisis:</strong> ${data.fecha || "-"}</span>
      <span><strong>Cargado:</strong> ${data.cargado_en ? new Date(data.cargado_en).toLocaleString("es-ES") : "-"}</span>
      <span><strong>Valores:</strong> ${Array.isArray(data.acciones) ? data.acciones.length : 0}</span>
    </div>
    <p>${data.lectura_general || ""}</p>
    ${data.mercado ? `<p class="muted">${data.mercado}</p>` : ""}
  `;

  panel.innerHTML = (data.acciones || []).map(a=>{
    const rec = a.recomendacion || "";
    const situacion = a.situacion_actual || {};
    return `<article class="ia-card">
      <div class="ia-card-header">
        <div>
          <h3>${a.nombre || a.ticker || "Valor"}</h3>
          <span class="muted">${a.ticker || ""}</span>
        </div>
        <strong class="ia-badge ${claseRecomendacionIA(rec)}">${rec}</strong>
      </div>

      <div class="ia-metrics">
        <span><strong>Precio medio:</strong> ${situacion.precio_medio ?? "-"}</span>
        <span><strong>Precio actual:</strong> ${situacion.precio_actual ?? "-"}</span>
        <span><strong>Beneficio:</strong> ${situacion.beneficio_pct ?? "-"}%</span>
        <span><strong>Riesgo:</strong> ${a.riesgo || "-"}</span>
        <span><strong>Prioridad:</strong> ${a.prioridad || "-"}</span>
      </div>

      <p>${a.comentario || ""}</p>

      <div class="grid two">
        <div>
          <h4>Ventas propuestas</h4>
          ${renderTramosIA(a.ventas, "venta")}
        </div>
        <div>
          <h4>Compras propuestas</h4>
          ${renderTramosIA(a.compras, "compra")}
        </div>
      </div>
    </article>`;
  }).join("");
}

function getOperacionesIntradiaGuardadas(){
  const data = db.recomendacionesIA || {};
  const intradia = data.operacionesIntradia || data.operaciones_intradia || data.intradia || null;
  if(Array.isArray(intradia)){
    return {fecha_hora_calculo: data.fecha_hora_calculo || data.fecha || data.cargado_en || "", ordenes: intradia};
  }
  return intradia;
}

function formatoNumeroIntradia(value, decimals=2){
  if(value === undefined || value === null || value === "") return "-";
  return num(value, decimals);
}

function normalizarAccionIntradia(tramo, tipo){
  const texto = typeof tramo === "string" ? tramo : (tramo?.accion || tramo?.recomendacion || tramo?.decision || "");
  const accion = String(texto).trim().toUpperCase().replace(/\s+/g, "_");
  if(["NO_COMPRAR", "NO_COMPRA", "NO_BUY"].includes(accion)) return "NO_COMPRAR";
  if(["NO_VENDER", "NO_VENTA", "NO_SELL"].includes(accion)) return "NO_VENDER";
  if(["COMPRAR", "COMPRA", "BUY"].includes(accion)) return "COMPRAR";
  if(["VENDER", "VENTA", "SELL"].includes(accion)) return "VENDER";
  if(!tramo || typeof tramo !== "object") return tipo === "compra" ? "NO_COMPRAR" : "NO_VENDER";
  return tramo.precio_limite || tramo.precio || tramo.cotizacion ? (tipo === "compra" ? "COMPRAR" : "VENDER") : "";
}

function getMotivoIntradia(tramo){
  if(typeof tramo === "string") return "";
  return tramo?.motivo || tramo?.descripcion || tramo?.comentario || "";
}

function renderOrdenIntradia(orden, key, titulo, clase){
  const tramo = orden?.[key] || {};
  const tipo = clase === "buy" ? "compra" : "venta";
  const accion = normalizarAccionIntradia(tramo, tipo);
  if(accion === "NO_COMPRAR" || accion === "NO_VENDER"){
    const texto = accion === "NO_COMPRAR" ? "No comprar" : "No vender";
    return `<div class="intradia-order ${clase}">
      <strong>${titulo}</strong>
      <span><b>Ticket:</b> ${texto}</span>
      <span><b>Límite:</b> -</span>
      <span><b>Cantidad:</b> 0</span>
      <span><b>Importe:</b> -</span>
      <span><b>Prob.:</b> no aplica</span>
      <small>${getMotivoIntradia(tramo)}</small>
    </div>`;
  }

  return `<div class="intradia-order ${clase}">
    <strong>${titulo}</strong>
    ${accion ? `<span><b>Ticket:</b> ${accion === "COMPRAR" ? "Comprar" : "Vender"}</span>` : ""}
    <span><b>Límite:</b> ${formatoNumeroIntradia(tramo.precio_limite ?? tramo.precio ?? tramo.cotizacion, 4)}</span>
    <span><b>Cantidad:</b> ${formatoNumeroIntradia(tramo.cantidad_acciones ?? tramo.cantidad, 0)}</span>
    <span><b>Importe:</b> ${tramo.importe_estimado !== undefined ? money(tramo.importe_estimado, db.ajustes.moneda) : "-"}</span>
    <span><b>Prob.:</b> ${tramo.probabilidad_ejecucion || tramo.probabilidad || "-"}</span>
    <small>${getMotivoIntradia(tramo)}</small>
  </div>`;
}

function setIntradiaViewMode(mode){
  intradiaViewMode = mode === "grafica" ? "grafica" : "detalle";
  localStorage.setItem("intradiaViewMode", intradiaViewMode);
  renderOperacionesIntradia();
}

function actualizarBotonesVistaIntradia(){
  const btnDetalle = el("btnIntradiaVistaDetalle");
  const btnGrafica = el("btnIntradiaVistaGrafica");
  if(btnDetalle) btnDetalle.classList.toggle("active", intradiaViewMode === "detalle");
  if(btnGrafica) btnGrafica.classList.toggle("active", intradiaViewMode === "grafica");
}


function getPrecioActualIntradia(orden){
  const ticker = orden?.ticker;
  const cot = ticker ? getCotizacion(ticker) : null;
  const precio = Number(cot?.price ?? orden?.precio_actual ?? orden?.cotizacion_actual);
  return Number.isFinite(precio) && precio > 0 ? precio : null;
}

function getPrecioInicialIntradia(orden){
  const precio = Number(orden?.precio_inicial ?? orden?.precio_inicial_intradia ?? orden?.precio_carga ?? orden?.precio_actual ?? orden?.cotizacion_actual);
  return Number.isFinite(precio) && precio > 0 ? precio : null;
}

function getPrecioMedioCarteraIntradia(orden, carteraPorTicker={}){
  const cartera = orden?.ticker ? carteraPorTicker[orden.ticker] : null;
  const precio = Number(cartera?.precioMedio ?? orden?.precio_medio_cartera ?? orden?.precio_medio);
  return Number.isFinite(precio) && precio > 0 ? precio : null;
}

function renderVariacionInicialIntradia(precioActual, precioInicial){
  if(precioActual === null || precioInicial === null) return `<span class="intradia-graph-current-delta neutral">0%</span>`;
  const variacion = ((precioActual - precioInicial) / precioInicial) * 100;
  const clase = variacion > 0 ? "positive" : variacion < 0 ? "negative" : "neutral";
  const flecha = variacion > 0 ? "↑" : variacion < 0 ? "↓" : "";
  const signo = variacion > 0 ? "+" : "";
  return `<span class="intradia-graph-current-delta ${clase}">${flecha} ${signo}${num(variacion, 2)}%</span>`;
}

function getCantidadActualIntradia(orden, carteraPorTicker={}){
  const cartera = orden?.ticker ? carteraPorTicker[orden.ticker] : null;
  const cantidad = Number(cartera?.cantidadNeta ?? orden?.cantidad_actual ?? orden?.acciones_actuales ?? orden?.cantidad);
  return Number.isFinite(cantidad) ? cantidad : null;
}

function getValorActualIntradia(orden, carteraPorTicker={}){
  const precioActual = getPrecioActualIntradia(orden);
  const cantidadActual = getCantidadActualIntradia(orden, carteraPorTicker);
  if(precioActual !== null && cantidadActual !== null) return precioActual * cantidadActual;
  const valor = Number(orden?.valor_actual);
  return Number.isFinite(valor) ? valor : null;
}

function getPrecioOrdenIntradia(orden, key, tipo){
  const tramo = orden?.[key] || {};
  const accion = normalizarAccionIntradia(tramo, tipo);
  if((tipo === "compra" && accion !== "COMPRAR") || (tipo === "venta" && accion !== "VENDER")) return null;
  const precio = Number(tramo.precio_limite ?? tramo.precio ?? tramo.cotizacion);
  if(!Number.isFinite(precio) || precio <= 0) return null;
  return {precio, tramo};
}

function getVariacionGraficaIntradia(precioReferencia, precioActual){
  if(!precioActual) return 0;
  return ((precioReferencia - precioActual) / precioActual) * 100;
}

function getVariacionMostradaGraficaIntradia(precioReferencia, precioActual){
  return Number(num(getVariacionGraficaIntradia(precioReferencia, precioActual), 2));
}

function renderLineaGraficaIntradia(item, tipo, precioActual){
  if(!item) return "";
  const variacion = getVariacionGraficaIntradia(item.precio, precioActual);
  const variacionMostrada = getVariacionMostradaGraficaIntradia(item.precio, precioActual);
  const claseSigno = variacionMostrada > 0 ? "positive" : variacionMostrada < 0 ? "negative" : "neutral";
  const clase = item.clase || `${tipo === "compra" ? "buy" : "sell"} ${claseSigno}`;
  const signo = variacionMostrada > 0 ? "+" : "";
  return `<div class="intradia-graph-line ${clase}">
    <span class="intradia-graph-pct">${signo}${num(variacion, 2)}%</span>
    <span class="intradia-graph-rule"></span>
    <span class="intradia-graph-price">${item.etiqueta ? `<b>${item.etiqueta}</b> ` : ""}${formatoNumeroIntradia(item.precio, 4)}</span>
  </div>`;
}

function renderGraficaIntradia(orden, carteraPorTicker={}){
  const precioActual = getPrecioActualIntradia(orden);
  const precioInicial = getPrecioInicialIntradia(orden);
  const precioMedio = getPrecioMedioCarteraIntradia(orden, carteraPorTicker);
  const ventas = [
    getPrecioOrdenIntradia(orden, "venta_tramo_1", "venta"),
    getPrecioOrdenIntradia(orden, "venta_tramo_2", "venta")
  ].filter(Boolean).sort((a, b)=>b.precio - a.precio);
  const compras = [
    getPrecioOrdenIntradia(orden, "compra_tramo_1", "compra"),
    getPrecioOrdenIntradia(orden, "compra_tramo_2", "compra")
  ].filter(Boolean).sort((a, b)=>b.precio - a.precio);

  const lineaPrecioMedio = precioMedio !== null ? renderLineaGraficaIntradia({precio: precioMedio, etiqueta: "Precio medio", clase: "average"}, "medio", precioActual) : "";
  const variacionMostradaPrecioMedio = precioMedio !== null ? getVariacionMostradaGraficaIntradia(precioMedio, precioActual) : 0;

  return `<div class="intradia-graph-box" aria-label="Gráfico intradía de ${orden.nombre || orden.ticker || "valor"}">
    <div class="intradia-graph-zone sells">
      ${ventas.map(item=>renderLineaGraficaIntradia(item, "venta", precioActual)).join("") || `<span class="intradia-graph-empty">Sin ventas recomendadas</span>`}
    </div>
    ${variacionMostradaPrecioMedio >= 0 ? lineaPrecioMedio : ""}
    <div class="intradia-graph-current">
      <span>Precio actual</span>
      ${renderVariacionInicialIntradia(precioActual, precioInicial)}
      <strong>${Number.isFinite(precioActual) ? formatoNumeroIntradia(precioActual, 4) : "-"}</strong>
    </div>
    ${variacionMostradaPrecioMedio < 0 ? lineaPrecioMedio : ""}
    <div class="intradia-graph-zone buys">
      ${compras.map(item=>renderLineaGraficaIntradia(item, "compra", precioActual)).join("") || `<span class="intradia-graph-empty">Sin compras recomendadas</span>`}
    </div>
  </div>`;
}

function renderOperacionesIntradia(){
  const resumen = el("panelResumenIntradia");
  const panel = el("panelOperacionesIntradia");
  if(!resumen || !panel) return;

  const intradia = getOperacionesIntradiaGuardadas();
  const ordenes = intradia && Array.isArray(intradia.ordenes) ? intradia.ordenes : [];

  actualizarBotonesVistaIntradia();

  if(!intradia || !ordenes.length){
    resumen.innerHTML = `<p class="muted">Todavía no hay operaciones intradía cargadas. Genera el JSON en Recomendaciones IA, pásalo a ChatGPT y carga la respuesta con el bloque <strong>operaciones_intradia</strong>.</p>`;
    panel.innerHTML = "";
    return;
  }

  resumen.innerHTML = `
    <div class="totals-bar">
      <span><strong>Fecha y hora cálculo:</strong> ${intradia.fecha_hora_calculo ? formatFechaHora(intradia.fecha_hora_calculo) : "-"}</span>
      <span><strong>Órdenes preparadas:</strong> ${ordenes.length}</span>
      <span><strong>Tipo:</strong> limitada</span>
      <span><strong>Vencimiento:</strong> diario</span>
    </div>
    ${intradia.criterio ? `<p class="muted">${intradia.criterio}</p>` : ""}
  `;

  const carteraPorTicker = Object.fromEntries(agruparCartera().map(g=>[g.ticker, g]));

  panel.innerHTML = ordenes.map(o=>{
    const precioActual = getPrecioActualIntradia(o);
    const cantidadActual = getCantidadActualIntradia(o, carteraPorTicker);
    const valorActual = getValorActualIntradia(o, carteraPorTicker);
    const precioMedio = getPrecioMedioCarteraIntradia(o, carteraPorTicker);
    return `
    <article class="ia-card intradia-card">
      <div class="ia-card-header">
        <div>
          <h3>${o.nombre || o.ticker || "Valor"}</h3>
          <span class="muted">${o.ticker || ""}</span>
        </div>
        <strong class="ia-badge">${o.tipo_orden || "limitada"} · ${o.vencimiento || "diario"}</strong>
      </div>

      <div class="intradia-current-box">
        <span><strong>Cantidad cartera:</strong> ${cantidadActual !== null ? formatoNumeroIntradia(cantidadActual, 0) : "-"}</span>
        <span><strong>Cotización actual:</strong> ${precioActual !== null ? formatoNumeroIntradia(precioActual, 4) : "-"}</span>
        <span><strong>Precio medio cartera:</strong> ${precioMedio !== null ? formatoNumeroIntradia(precioMedio, 4) : "-"}</span>
        <span><strong>Valor:</strong> ${valorActual !== null ? money(valorActual, db.ajustes.moneda) : "-"}</span>
        <span><strong>Forma:</strong> cantidad × cotización</span>
      </div>

      ${intradiaViewMode === "grafica" ? renderGraficaIntradia(o, carteraPorTicker) : `<div class="intradia-orders-grid">
        ${renderOrdenIntradia(o, "compra_tramo_1", "Compra tramo 1", "buy")}
        ${renderOrdenIntradia(o, "compra_tramo_2", "Compra tramo 2", "buy")}
        ${renderOrdenIntradia(o, "venta_tramo_1", "Venta tramo 1", "sell")}
        ${renderOrdenIntradia(o, "venta_tramo_2", "Venta tramo 2", "sell")}
      </div>`}
      ${o.comentario ? `<p>${o.comentario}</p>` : ""}
    </article>
  `;
  }).join("");
}

function cargarAjustesForm(){
  db.ajustes.promptIA = db.ajustes.promptIA || defaultData.ajustes.promptIA || "";
  el("ajProvider").value = db.ajustes.provider;
  el("ajApiKey").value = db.ajustes.apiKey;
  if(el("ajGoogleUrl")) el("ajGoogleUrl").value = db.ajustes.googleUrl || "";
  if(el("ajActualizarAlAbrir")) el("ajActualizarAlAbrir").checked = Boolean(db.ajustes.actualizarAlAbrir);
  el("ajVentaPct").value = db.ajustes.ventaPct;
  el("ajVentaMin").value = db.ajustes.ventaMin;
  el("ajMoneda").value = db.ajustes.moneda;
  el("ajImpuestoPct").value = db.ajustes.impuestoPct;
  if(el("ajPromptIA")) el("ajPromptIA").value = db.ajustes.promptIA || "";
}

function guardarAjustes(e){
  e.preventDefault();
  db.ajustes = {
    ...defaultData.ajustes,
    ...db.ajustes,
    provider: el("ajProvider").value,
    apiKey: el("ajApiKey").value.trim(),
    googleUrl: el("ajGoogleUrl") ? el("ajGoogleUrl").value.trim() : "",
    actualizarAlAbrir: Boolean(el("ajActualizarAlAbrir") && el("ajActualizarAlAbrir").checked),
    ventaPct: Number(el("ajVentaPct").value || 0),
    ventaMin: Number(el("ajVentaMin").value || 0),
    moneda: el("ajMoneda").value.trim() || "EUR",
    impuestoPct: Number(el("ajImpuestoPct").value || 0),
    promptIA: el("ajPromptIA") ? el("ajPromptIA").value.trim() : ""
  };
  saveDB(db);
  renderAll();
  setStatus("Ajustes guardados.");
}

function exportarDatos(){
  const filename = "mibolsa_backup_" + today() + ".json";
  downloadFile(filename, JSON.stringify(db, null, 2));
}

function importarDatos(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const imported = JSON.parse(reader.result);
      db = {
        movimientos: imported.movimientos || [],
        cotizaciones: imported.cotizaciones || {},
        ajustes: {...defaultData.ajustes, ...(imported.ajustes || {})},
        recomendacionesIA: imported.recomendacionesIA || null
      };
      saveDB(db);
      renderAll();
      setStatus("Datos importados.");
    }catch(err){
      alert("Archivo no válido.");
    }
  };
  reader.readAsText(file);
}

function borrarTodo(){
  if(!confirm("Esto borrará todos los datos locales. ¿Continuar?")) return;
  db = structuredClone(defaultData);
  saveDB(db);
  renderAll();
  setStatus("Datos borrados.");
}


window.addEventListener("DOMContentLoaded", init);


window.togglePanel = togglePanel;
window.editarMovimiento = editarMovimiento;
window.borrarMovimiento = borrarMovimiento;
window.mostrarDetalleCartera = mostrarDetalleCartera;
window.actualizarUnaApi = actualizarUnaApi;

window.togglePanelWithButton = togglePanelWithButton;
