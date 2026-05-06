
async function leerJsonSeguro(res, nombreProveedor){
  const text = await res.text();
  try{
    return JSON.parse(text);
  }catch(e){
    const inicio = text.slice(0, 80).replace(/\s+/g, " ");
    throw new Error(`${nombreProveedor} no devolvió JSON válido. Respuesta recibida: ${inicio}`);
  }
}

async function descargarCotizacion(provider, apiKey, symbol){
  if(!provider || provider === "manual"){
    throw new Error("Proveedor API no configurado. Usa cotización manual o configura API en Ajustes.");
  }
  if(provider !== "yahoo" && !apiKey){
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
    const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error("Error Twelve Data: " + res.status);
    const data = await leerJsonSeguro(res, "Twelve Data");
    if(!data.price) throw new Error("Twelve Data no devolvió cotización válida para " + symbol);
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
    /*
      Yahoo Finance no ofrece API pública oficial estable.
      Este endpoint es no oficial y puede fallar por CORS, cookies, bloqueo o cambios internos.
      Se mantiene como opción experimental para uso personal.
    */
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}&lang=es-ES&region=ES&corsDomain=finance.yahoo.com`;
    const res = await fetch(url);
    if(!res.ok) throw new Error("Error Yahoo Finance: " + res.status);
    const data = await leerJsonSeguro(res, "Yahoo Finance");
    const quote = data?.quoteResponse?.result?.[0];
    const price = quote?.regularMarketPrice || quote?.postMarketPrice || quote?.preMarketPrice;
    if(!price) throw new Error("Yahoo Finance no devolvió cotización válida para " + symbol);
    return {price:Number(price), raw:data};
  }

  throw new Error("Proveedor no reconocido.");
}
