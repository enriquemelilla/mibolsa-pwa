async function descargarCotizacion(provider, apiKey, symbol){
  if(!provider || provider === "manual"){
    throw new Error("Proveedor API no configurado. Usa cotización manual o configura API en Ajustes.");
  }
  if(!apiKey){
    throw new Error("Falta API key.");
  }
  if(!symbol){
    throw new Error("Falta símbolo API.");
  }

  if(provider === "finnhub"){
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error("Error Finnhub: " + res.status);
    const data = await res.json();
    if(!data.c) throw new Error("Finnhub no devolvió cotización válida para " + symbol);
    return {price:Number(data.c), raw:data};
  }

  if(provider === "twelvedata"){
    const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error("Error Twelve Data: " + res.status);
    const data = await res.json();
    if(!data.price) throw new Error("Twelve Data no devolvió cotización válida para " + symbol);
    return {price:Number(data.price), raw:data};
  }

  if(provider === "alphavantage"){
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error("Error Alpha Vantage: " + res.status);
    const data = await res.json();
    const price = data?.["Global Quote"]?.["05. price"];
    if(!price) throw new Error("Alpha Vantage no devolvió cotización válida para " + symbol);
    return {price:Number(price), raw:data};
  }

  throw new Error("Proveedor no reconocido.");
}
