let db = loadDB();
let deferredPrompt = null;

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
  bind("btnRefrescarCotizaciones", "click", renderCotizaciones);

  bind("btnGenerarJsonIA", "click", generarJsonParaIA);
  bind("btnCopiarJsonIA", "click", copiarJsonIA);
  bind("btnDescargarJsonIA", "click", descargarJsonIA);
  bind("btnCopiarPromptIA", "click", copiarPromptIA);
  bind("btnCargarRespuestaIA", "click", cargarRespuestaIA);
  bind("btnEjemploRespuestaIA", "click", pegarEjemploRespuestaIA);
  bind("btnBorrarRecomendacionesIA", "click", borrarRecomendacionesIA);
  bind("btnAceptarAvisoIA", "click", aceptarAvisoRecomendacionesIA);

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

  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("sw.js");
  }
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
  const inicio = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");
  if(inicio === -1 || fin === -1 || fin <= inicio){
    throw new Error("No se encontró un objeto JSON válido.");
  }
  return texto.slice(inicio, fin + 1);
}

function toggleTipoMovimiento(){
  const tipo = el("movTipo").value;
  const bloque = el("bloqueOperacion");
  bloque.style.display = tipo === "SEGUIMIENTO" ? "none" : "block";
  if(tipo === "SEGUIMIENTO"){
    el("movCantidad").value = "";
    el("movPrecio").value = "";
    el("movGastos").value = "";
    el("movTotal").value = "";
  }
}

function recalcularTotalOperacion(){
  const tipo = el("movTipo").value;
  if(tipo === "SEGUIMIENTO") return;
  const cantidad = Number(el("movCantidad").value || 0);
  const precio = Number(el("movPrecio").value || 0);
  const gastos = Number(el("movGastos").value || 0);
  if(cantidad && precio){
    el("movTotal").value = (cantidad * precio + gastos).toFixed(2);
  }
}

function calcularGastosDesdeTotal(){
  const cantidad = Number(el("movCantidad").value || 0);
  const precio = Number(el("movPrecio").value || 0);
  const total = Number(el("movTotal").value || 0);
  if(cantidad && precio && total){
    const gastos = total - (cantidad * precio);
    el("movGastos").value = gastos.toFixed(2);
  }
}

function guardarMovimiento(e){
  e.preventDefault();
  const tipo = el("movTipo").value;
  const id = el("movId").value || uid();

  const movimiento = {
    id,
    tipo,
    nombre: el("movNombre").value.trim(),
    ticker: el("movTicker").value.trim().toUpperCase(),
    apiSymbol: el("movApiSymbol").value.trim().toUpperCase(),
    exchange: el("movExchange").value.trim().toUpperCase(),
    cantidad: tipo === "SEGUIMIENTO" ? 0 : Number(el("movCantidad").value || 0),
    precio: tipo === "SEGUIMIENTO" ? 0 : Number(el("movPrecio").value || 0),
    gastos: tipo === "SEGUIMIENTO" ? 0 : Number(el("movGastos").value || 0),
    total: tipo === "SEGUIMIENTO" ? 0 : Number(el("movTotal").value || 0),
    fecha: el("movFecha").value || today(),
    mercado: el("movMercado").value.trim(),
    notas: el("movNotas").value.trim(),
    createdAt: new Date().toISOString()
  };

  if(!movimiento.nombre || !movimiento.ticker){
    alert("Debes indicar nombre y ticker.");
    return;
  }

  if(tipo !== "SEGUIMIENTO" && (!movimiento.cantidad || !movimiento.precio)){
    alert("En compra/venta debes indicar cantidad y precio.");
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
  el("movGastos").value = m.gastos || "";
  el("movTotal").value = m.total || "";
  el("movFecha").value = m.fecha || today();
  el("movMercado").value = m.mercado || "";
  el("movNotas").value = m.notas || "";
  toggleTipoMovimiento();
  document.querySelector('[data-view="movimientos"]').click();
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

function agruparCartera(){
  const map = {};
  db.movimientos.forEach(m=>{
    if(m.tipo === "SEGUIMIENTO") return;
    if(!map[m.ticker]){
      map[m.ticker] = {
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
        movimientos:[]
      };
    }
    const g = map[m.ticker];
    g.movimientos.push(m);
    if(m.tipo === "COMPRA"){
      g.cantidadComprada += m.cantidad;
      g.invertidoCompras += m.cantidad * m.precio + m.gastos;
      g.gastosCompra += m.gastos;
    }
    if(m.tipo === "VENTA"){
      g.cantidadVendida += m.cantidad;
      g.importeVentas += m.cantidad * m.precio - m.gastos;
      g.gastosVenta += m.gastos;
    }
    if(m.apiSymbol) g.apiSymbol = m.apiSymbol;
    if(m.exchange) g.exchange = m.exchange;
    if(m.nombre) g.nombre = m.nombre;
  });

  return Object.values(map).map(g=>{
    g.cantidadNeta = g.cantidadComprada - g.cantidadVendida;
    g.invertidoNeto = g.invertidoCompras - g.importeVentas;
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

function renderAll(){
  renderDashboard();
  renderMovimientos();
  renderCartera();
  renderSeguimiento();
  renderCotizaciones();
  renderComparativa();
  renderRecomendacionesIA();
  cargarAjustesForm();
  marcarTablasResponsive();
}

function renderDashboard(){
  const cartera = agruparCartera();
  let valorActual = 0, invertido = 0, beneficio = 0;
  cartera.forEach(g=>{
    const cot = getCotizacion(g.ticker);
    const va = cot ? cot.price * g.cantidadNeta : 0;
    const gv = va > 0 ? estimarGastosVenta(va) : 0;
    valorActual += va;
    invertido += g.invertidoNeto;
    beneficio += va - g.invertidoNeto - gv;
  });
  el("dashValorCartera").textContent = money(valorActual, db.ajustes.moneda);
  el("dashInvertido").textContent = money(invertido, db.ajustes.moneda);
  el("dashBeneficio").textContent = money(beneficio, db.ajustes.moneda);
  el("dashBeneficio").className = beneficio >= 0 ? "good" : "bad";
  el("dashSeguimiento").textContent = getSeguimiento().length;

  const html = cartera.length ? cartera.map(g=>{
    const cot = getCotizacion(g.ticker);
    return `<p><strong>${g.nombre}</strong>: ${num(g.cantidadNeta, 4)} acciones · Cotización: ${cot ? money(cot.price, db.ajustes.moneda) : "sin dato"}</p>`;
  }).join("") : `<p class="muted">Todavía no tienes cartera real. Añade una compra desde Movimientos.</p>`;
  el("dashboardResumen").innerHTML = html;
}

function renderMovimientos(){
  const tbody = el("tablaMovimientos");
  const q = (el("buscarMovimiento").value || "").toLowerCase();
  const rows = db.movimientos
    .filter(m => !q || `${m.fecha} ${m.tipo} ${m.nombre} ${m.ticker}`.toLowerCase().includes(q))
    .sort((a,b)=>(b.fecha || "").localeCompare(a.fecha || ""));

  const compras = rows.filter(m=>m.tipo==="COMPRA").length;
  const ventas = rows.filter(m=>m.tipo==="VENTA").length;
  const seguimiento = rows.filter(m=>m.tipo==="SEGUIMIENTO").length;
  const importeCompras = rows.filter(m=>m.tipo==="COMPRA").reduce((s,m)=>s + Number(m.total || (m.cantidad*m.precio+m.gastos) || 0),0);
  const importeVentas = rows.filter(m=>m.tipo==="VENTA").reduce((s,m)=>s + Number(m.total || (m.cantidad*m.precio-m.gastos) || 0),0);

  if(el("totalesMovimientos")){
    el("totalesMovimientos").innerHTML = `
      <span><strong>Movimientos:</strong> ${rows.length}</span>
      <span class="good"><strong>Compras:</strong> ${compras} · ${money(importeCompras, db.ajustes.moneda)}</span>
      <span class="bad"><strong>Ventas:</strong> ${ventas} · ${money(importeVentas, db.ajustes.moneda)}</span>
      <span class="warn"><strong>Seguimiento:</strong> ${seguimiento}</span>
    `;
  }

  tbody.innerHTML = rows.map(m=>`
    <tr>
      <td>${m.fecha || ""}</td>
      <td><span class="${m.tipo === "VENTA" ? "bad" : m.tipo === "COMPRA" ? "good" : "warn"}">${m.tipo}</span></td>
      <td>${m.nombre}<br><small class="muted">${m.ticker} · ${m.apiSymbol || "sin API"}</small></td>
      <td>${m.tipo === "SEGUIMIENTO" ? "-" : num(m.cantidad, 4)}</td>
      <td>${m.tipo === "SEGUIMIENTO" ? "-" : money(m.precio, db.ajustes.moneda)}</td>
      <td>${m.tipo === "SEGUIMIENTO" ? "-" : money(m.total || (m.cantidad*m.precio+m.gastos), db.ajustes.moneda)}</td>
      <td>
        <button class="small-btn edit" onclick="editarMovimiento('${m.id}')">Editar</button>
        <button class="small-btn delete" onclick="borrarMovimiento('${m.id}')">Borrar</button>
      </td>
    </tr>`).join("");

  if(!rows.length){
    tbody.innerHTML = `<tr><td colspan="7" class="muted">No hay movimientos.</td></tr>`;
  }
}

function renderCartera(){
  const tbody = el("tablaCartera");
  const cartera = agruparCartera();

  let totalAcciones = 0;
  let totalCompradas = 0;
  let totalVendidas = 0;
  let totalInvertido = 0;
  let totalValorActual = 0;

  cartera.forEach(g=>{
    const cot = getCotizacion(g.ticker);
    totalAcciones += Number(g.cantidadNeta || 0);
    totalCompradas += Number(g.cantidadComprada || 0);
    totalVendidas += Number(g.cantidadVendida || 0);
    totalInvertido += Number(g.invertidoNeto || 0);
    totalValorActual += cot ? cot.price * g.cantidadNeta : 0;
  });

  if(el("totalesCartera")){
    el("totalesCartera").innerHTML = `
      <span><strong>Valores:</strong> ${cartera.length}</span>
      <span><strong>Acciones netas:</strong> ${num(totalAcciones,4)}</span>
      <span><strong>Compradas:</strong> ${num(totalCompradas,4)}</span>
      <span><strong>Vendidas:</strong> ${num(totalVendidas,4)}</span>
      <span><strong>Invertido neto:</strong> ${money(totalInvertido, db.ajustes.moneda)}</span>
      <span><strong>Valor actual:</strong> ${money(totalValorActual, db.ajustes.moneda)}</span>
    `;
  }

  tbody.innerHTML = cartera.map(g=>{
    const cot = getCotizacion(g.ticker);
    const valorActual = cot ? cot.price * g.cantidadNeta : 0;
    return `<tr onclick="mostrarDetalleCartera('${g.ticker}')">
      <td><strong>${g.nombre}</strong><br><small class="muted">${g.ticker} · ${g.apiSymbol || "sin API"}</small></td>
      <td>${num(g.cantidadNeta,4)}</td>
      <td>${num(g.cantidadComprada,4)}</td>
      <td>${num(g.cantidadVendida,4)}</td>
      <td>${money(g.invertidoNeto, db.ajustes.moneda)}</td>
      <td>${money(g.precioMedio, db.ajustes.moneda)}</td>
      <td>${cot ? money(cot.price, db.ajustes.moneda) : "Sin cotización"}</td>
      <td>${cot ? money(valorActual, db.ajustes.moneda) : "-"}</td>
    </tr>`;
  }).join("");

  if(!cartera.length){
    tbody.innerHTML = `<tr><td colspan="8" class="muted">No hay posiciones reales.</td></tr>`;
  }
}

function mostrarDetalleCartera(ticker){
  const g = agruparCartera().find(x=>x.ticker === ticker);
  if(!g) return;
  const panel = el("detalleCartera");
  panel.classList.remove("hidden");
  panel.innerHTML = `
    <h3>Detalle de ${g.nombre} (${g.ticker})</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Cantidad</th><th>Precio</th><th>Gastos</th><th>Total</th></tr></thead>
        <tbody>
          ${g.movimientos.map(m=>`
            <tr>
              <td>${m.fecha}</td>
              <td>${m.tipo}</td>
              <td>${num(m.cantidad,4)}</td>
              <td>${money(m.precio, db.ajustes.moneda)}</td>
              <td>${money(m.gastos, db.ajustes.moneda)}</td>
              <td>${money(m.total || (m.cantidad*m.precio+m.gastos), db.ajustes.moneda)}</td>
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
    tbody.innerHTML = `<tr><td colspan="7" class="muted">No hay valores en seguimiento.</td></tr>`;
  }
}

function renderCotizaciones(){
  const tbody = el("tablaCotizaciones");
  const valores = getTodosValoresCotizables();

  tbody.innerHTML = valores.map(v=>{
    const cot = getCotizacion(v.ticker);
    return `<tr>
      <td>${v.tipo}</td>
      <td><strong>${v.nombre}</strong><br><small class="muted">${v.ticker}</small></td>
      <td><input value="${v.apiSymbol || ""}" onchange="actualizarApiSymbol('${v.ticker}', this.value)" placeholder="SAN, BBVA, MAP"></td>
      <td><input value="${v.exchange || ""}" onchange="actualizarExchange('${v.ticker}', this.value)" placeholder="XMAD"></td>
      <td><input type="number" step="0.000001" value="${cot ? cot.price : ""}" placeholder="Precio" onchange="guardarCotizacionManual('${v.ticker}', this.value)"></td>
      <td>${cot ? new Date(cot.updatedAt).toLocaleString("es-ES") + " · " + cot.source : "-"}</td>
      <td>
        <button class="small-btn edit" onclick="actualizarUnaApi('${v.ticker}')">API</button>
      </td>
    </tr>`;
  }).join("");

  if(!valores.length){
    tbody.innerHTML = `<tr><td colspan="7" class="muted">No hay valores para cotizar. Añade compras o seguimiento.</td></tr>`;
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

async function actualizarTodasApi(){
  const valores = getTodosValoresCotizables();
  if(!valores.length) return;
  for(const v of valores){
    try{
      const r = await descargarCotizacion(db.ajustes.provider, db.ajustes.apiKey, v.apiSymbol, v.exchange);
      setCotizacion(v.ticker, r.price, db.ajustes.provider);
    }catch(e){
      console.warn("Error cotizando", v.ticker, e);
    }
  }
  renderAll();
  setStatus("Proceso de actualización API finalizado. Revisa si algún valor quedó sin actualizar.");
}

function renderComparativa(){
  const tbody = el("tablaComparativa");
  const cartera = agruparCartera().filter(g=>g.cantidadNeta > 0);

  let totalInvertido = 0;
  let totalValorActual = 0;
  let totalGastosVenta = 0;
  let totalBruto = 0;
  let totalNeto = 0;

  const rows = cartera.map(g=>{
    const cot = getCotizacion(g.ticker);
    const valorActual = cot ? cot.price * g.cantidadNeta : 0;
    const gastosVenta = valorActual > 0 ? estimarGastosVenta(valorActual) : 0;
    const bruto = valorActual - g.invertidoNeto;
    const impuesto = bruto > 0 ? bruto * (Number(db.ajustes.impuestoPct || 0)/100) : 0;
    const neto = bruto - gastosVenta - impuesto;
    const rent = g.invertidoNeto ? (neto / g.invertidoNeto) * 100 : 0;

    if(cot){
      totalInvertido += g.invertidoNeto;
      totalValorActual += valorActual;
      totalGastosVenta += gastosVenta;
      totalBruto += bruto;
      totalNeto += neto;
    }

    return `<tr>
      <td><strong>${g.nombre}</strong><br><small class="muted">${g.ticker}</small></td>
      <td>${num(g.cantidadNeta,4)}</td>
      <td>${money(g.invertidoNeto, db.ajustes.moneda)}</td>
      <td>${cot ? money(valorActual, db.ajustes.moneda) : "Sin cotización"}</td>
      <td>${cot ? money(gastosVenta, db.ajustes.moneda) : "-"}</td>
      <td class="${bruto>=0?'good':'bad'}">${cot ? money(bruto, db.ajustes.moneda) : "-"}</td>
      <td class="${neto>=0?'good':'bad'}">${cot ? money(neto, db.ajustes.moneda) : "-"}</td>
      <td class="${rent>=0?'good':'bad'}">${cot ? num(rent,2)+" %" : "-"}</td>
    </tr>`;
  });

  const totalRent = totalInvertido ? (totalNeto / totalInvertido) * 100 : 0;

  if(el("totalesComparativa")){
    el("totalesComparativa").innerHTML = `
      <span><strong>Valores abiertos:</strong> ${cartera.length}</span>
      <span><strong>Invertido:</strong> ${money(totalInvertido, db.ajustes.moneda)}</span>
      <span><strong>Valor actual:</strong> ${money(totalValorActual, db.ajustes.moneda)}</span>
      <span><strong>Gastos venta:</strong> ${money(totalGastosVenta, db.ajustes.moneda)}</span>
      <span class="${totalBruto>=0?'good':'bad'}"><strong>Beneficio bruto:</strong> ${money(totalBruto, db.ajustes.moneda)}</span>
      <span class="${totalNeto>=0?'good':'bad'}"><strong>Beneficio neto:</strong> ${money(totalNeto, db.ajustes.moneda)} · ${num(totalRent,2)} %</span>
    `;
  }

  tbody.innerHTML = rows.join("");

  if(!cartera.length){
    tbody.innerHTML = `<tr><td colspan="8" class="muted">No hay posiciones abiertas para comparar.</td></tr>`;
  }
}


function generarDatosParaIA(){
  const cartera = agruparCartera().map(g=>{
    const cot = getCotizacion(g.ticker);
    const valorActual = cot ? cot.price * g.cantidadNeta : 0;
    const beneficioBruto = cot ? valorActual - g.invertidoNeto : null;
    const rentabilidadBrutaPct = cot && g.invertidoNeto ? (beneficioBruto / g.invertidoNeto) * 100 : null;

    return {
      nombre: g.nombre,
      ticker: g.ticker,
      simbolo_api: g.apiSymbol || "",
      exchange: g.exchange || "",
      acciones_netas: g.cantidadNeta,
      acciones_compradas: g.cantidadComprada,
      acciones_vendidas: g.cantidadVendida,
      invertido_neto: Number(g.invertidoNeto.toFixed(4)),
      precio_medio: Number(g.precioMedio.toFixed(6)),
      ultima_cotizacion: cot ? cot.price : null,
      fecha_cotizacion: cot ? cot.updatedAt : null,
      valor_actual: cot ? Number(valorActual.toFixed(4)) : null,
      beneficio_bruto: cot ? Number(beneficioBruto.toFixed(4)) : null,
      rentabilidad_bruta_pct: rentabilidadBrutaPct !== null ? Number(rentabilidadBrutaPct.toFixed(4)) : null,
      movimientos: g.movimientos.map(m=>({
        fecha: m.fecha,
        tipo: m.tipo,
        cantidad: m.cantidad,
        precio: m.precio,
        gastos: m.gastos,
        total: m.total,
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
    cartera,
    seguimiento,
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
        ]
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
    ]
  };

  return promptUsuario
    + "\n\nIMPORTANTE:\nDevuelve SOLO JSON válido, sin markdown, sin comentarios fuera del JSON."
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
  return obj;
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
    db.recomendacionesIA = {
      ...obj,
      cargado_en: new Date().toISOString()
    };
    saveDB(db);
    renderRecomendacionesIA();
    setStatus("Recomendaciones IA cargadas correctamente.");
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
    ]
  };
  el("jsonEntradaIA").value = JSON.stringify(ejemplo, null, 2);
  setStatus("Ejemplo pegado.");
}

function borrarRecomendacionesIA(){
  if(!confirm("¿Borrar recomendaciones IA guardadas?")) return;
  db.recomendacionesIA = null;
  saveDB(db);
  renderRecomendacionesIA();
  setStatus("Recomendaciones IA borradas.");
}

function claseRecomendacionIA(rec){
  const r = (rec || "").toUpperCase();
  if(r === "COMPRAR") return "good";
  if(r === "MANTENER") return "warn";
  if(r === "VENDER") return "bad";
  if(r === "NO_ENTRAR") return "muted";
  return "";
}

function renderTramosIA(tramos, tipo){
  if(!Array.isArray(tramos) || !tramos.length){
    return `<p class="muted">Sin tramos de ${tipo}.</p>`;
  }

  return `<div class="ia-tramos">
    ${tramos.map(t=>`
      <div class="ia-tramo">
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

function cargarAjustesForm(){
  db.ajustes.promptIA = db.ajustes.promptIA || defaultData.ajustes.promptIA || "";
  el("ajProvider").value = db.ajustes.provider;
  el("ajApiKey").value = db.ajustes.apiKey;
  if(el("ajGoogleUrl")) el("ajGoogleUrl").value = db.ajustes.googleUrl || "";
  el("ajVentaPct").value = db.ajustes.ventaPct;
  el("ajVentaMin").value = db.ajustes.ventaMin;
  el("ajMoneda").value = db.ajustes.moneda;
  el("ajImpuestoPct").value = db.ajustes.impuestoPct;
  if(el("ajPromptIA")) el("ajPromptIA").value = db.ajustes.promptIA || "";
}

function guardarAjustes(e){
  e.preventDefault();
  db.ajustes = {
    provider: el("ajProvider").value,
    apiKey: el("ajApiKey").value.trim(),
    googleUrl: el("ajGoogleUrl") ? el("ajGoogleUrl").value.trim() : "",
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
