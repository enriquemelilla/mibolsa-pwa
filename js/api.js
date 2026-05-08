async function leerJsonSeguro(res, nombreProveedor){
  const text = await res.text();
  try{
    return JSON.parse(text);
  }catch(e){
    const inicio = text.slice(0, 120).replace(/\s+/g, " ");
    throw new Error(`${nombreProveedor} no devolvió JSON válido. Respuesta recibida: ${inicio}`);
  }
}

async function descargarCotizacion(provider, apiKey, symbol, exchange=""){
  provider = provider || "manual";
  symbol = (symbol || "").trim().toUpperCase();
  exchange = (exchange || "").trim().toUpperCase();

  if(provider === "manual"){
    throw new Error("Proveedor API no configurado. Usa cotización manual o configura API en Ajustes.");
  }
  if(provider === "google"){
  const googleUrl = db.ajustes.googleUrl || "";

  if(!googleUrl){
    throw new Error("Falta la URL de Google Apps Script en Ajustes.");
  }

  const res = await fetch(googleUrl);

  if(!res.ok){
    throw new Error("Error Google Finance / Sheets: " + res.status);
  }

  const data = await leerJsonSeguro(res, "Google Finance / Sheets");

  const lista = Array.isArray(data) ? data : data.datos;

  if(!Array.isArray(lista)){
    throw new Error("Google no devolvió una lista válida de cotizaciones.");
  }

  const encontrado = lista.find(item =>
    String(item.ticker || "").toUpperCase() === symbol.toUpperCase()
  );

  if(!encontrado){
    throw new Error("Google no encontró cotización para " + symbol);
  }

  const price = Number(encontrado.price);

  if(!price){
    throw new Error("Google no devolvió precio válido para " + symbol);
  }

  return {
    price,
    raw: encontrado
  };
}

  // Yahoo Finance experimental NO necesita API key.
  // Finnhub, Twelve Data y Alpha Vantage sí la necesitan.
  if(provider !== "yahoo" && provider !== "google" && !apiKey){
  throw new Error("Falta API key.");
}

  if(!symbol){
    throw new Error("Falta símbolo API.");
  }

  if(provider === "finnhub"){
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error("Error Finnhub: " + res.status);
    const data = await leerJsonSeguro(res, "Finnhub");
    if(!data.c) throw new Error("Finnhub no devolvió cotización válida para " + symbol);
    return {price:Number(data.c), raw:data};
  }

  if(provider === "twelvedata"){
    /*
      Twelve Data puede ignorar exchange=XMAD en algunos casos y resolver SAN como ADR/NYSE.
      Por eso, si el usuario informa Exchange, enviamos el símbolo en formato:
      SAN:XMAD, BBVA:XMAD, MAP:XMAD, IBE:XMAD
    */
    const symbolForRequest = exchange && !symbol.includes(":")
      ? `${symbol}:${exchange}`
      : symbol;

    const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbolForRequest)}&apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error("Error Twelve Data: " + res.status);
    const data = await leerJsonSeguro(res, "Twelve Data");

    if(data.status === "error"){
      throw new Error("Twelve Data: " + (data.message || "error en la consulta") + " [" + symbolForRequest + "]");
    }

    if(!data.price){
      throw new Error("Twelve Data no devolvió cotización válida para " + symbolForRequest);
    }

    return {price:Number(data.price), raw:data};
  }

  if(provider === "alphavantage"){
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error("Error Alpha Vantage: " + res.status);
    const data = await leerJsonSeguro(res, "Alpha Vantage");
    const price = data?.["Global Quote"]?.["05. price"];
    if(!price) throw new Error("Alpha Vantage no devolvió cotización válida para " + symbol);
    return {price:Number(price), raw:data};
  }

  if(provider === "yahoo"){
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}&lang=es-ES&region=ES&corsDomain=finance.yahoo.com`;
    const res = await fetch(url);
    if(!res.ok) throw new Error("Error Yahoo Finance: " + res.status);
    const data = await leerJsonSeguro(res, "Yahoo Finance");
    const quote = data?.quoteResponse?.result?.[0];
    const price = quote?.regularMarketPrice || quote?.postMarketPrice || quote?.preMarketPrice;
    if(!price) throw new Error("Yahoo Finance no devolvió cotización válida para " + symbol);
    return {price:Number(price), raw:data};
  }


  if(provider === "massive"){
    /*
      Massive.com, antes Polygon.io.
      Para plan gratuito, el endpoint más compatible suele ser Previous Day Bar:
      /v2/aggs/ticker/{ticker}/prev
      Devuelve cierre anterior (EOD), no tiempo real.
      Ejemplo símbolo USA: AAPL, MSFT, TSLA.
    */
    const url = `https://api.massive.com/v2/aggs/ticker/${encodeURIComponent(symbol)}/prev?adjusted=true&apiKey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error("Error Massive: " + res.status);
    const data = await leerJsonSeguro(res, "Massive");

    if(data.status && data.status !== "OK"){
      throw new Error("Massive: " + (data.error || data.message || data.status));
    }

    const result = data?.results?.[0];
    const price = result?.c;

    if(!price){
      throw new Error("Massive no devolvió cierre válido para " + symbol + ". Prueba con símbolos USA como AAPL, MSFT o TSLA.");
    }

    return {price:Number(price), raw:data};
  }

  throw new Error("Proveedor no reconocido.");
}
