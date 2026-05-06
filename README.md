# MiBolsa PWA V5 completa

Aplicación PWA para gestionar una cartera personal de acciones.

## Funciones incluidas

- Alta, modificación y baja de movimientos.
- Tipos de movimiento:
  - COMPRA
  - VENTA
  - SEGUIMIENTO / solo cotización
- Cartera real agrupada por acción.
- Compras suman y ventas restan.
- Sección separada para valores en seguimiento.
- Cotizaciones manuales.
- Cotizaciones por API:
  - Finnhub
  - Twelve Data
  - Alpha Vantage
- Comparativa con beneficio bruto y neto estimado.
- Ajustes de gastos de venta:
  - porcentaje
  - mínimo por operación
- Exportar e importar copia JSON.
- Datos demo.
- PWA instalable en móvil o PC.
- Funciona sin servidor si se abre con Live Server o servidor local.

## Uso recomendado

Para evitar restricciones del navegador, abre el proyecto con un servidor local.

Ejemplo con Python:

```bash
cd mibolsa_pwa_v5_completa
python -m http.server 8080
```

Luego abre:

```text
http://localhost:8080
```

## Símbolos API ejemplo

- BBVA: BBVA.MC
- Santander: SAN.MC
- Mapfre: MAP.MC
- Iberdrola: IBE.MC

## Nota

La aplicación guarda los datos en localStorage del navegador.
Usa Exportar JSON para hacer copias de seguridad.


## Adaptación móvil / PC añadida

Esta versión está adaptada para ambos formatos:

- En PC se muestran tablas completas.
- En móvil las tablas se convierten automáticamente en tarjetas.
- El menú pasa a la parte inferior para uso táctil.
- Formularios a una columna en pantallas pequeñas.
- Botones con tamaño táctil.
- Inputs con tamaño de letra adecuado para evitar zoom automático.
- Compatible con instalación PWA en móvil y escritorio.


## Cambios de esta versión

- Eliminado el botón de datos demo.
- Movimientos ahora tiene botón para plegar/desplegar.
- Mi cartera ahora tiene botón para plegar/desplegar.
- Comparativa ahora tiene botón para plegar/desplegar.
- Añadida barra de totales en Movimientos.
- Añadida barra de totales en Mi cartera.
- Añadida barra de totales en Comparativa.


## Yahoo Finance experimental

Se ha añadido el proveedor:

```text
Yahoo Finance experimental
```

Usa el endpoint no oficial:

```text
https://query1.finance.yahoo.com/v7/finance/quote?symbols=SIMBOLO
```

Ejemplos de símbolos:

```text
BBVA.MC
SAN.MC
MAP.MC
IBE.MC
AAPL
MSFT
TSLA
```

Importante:

- Yahoo Finance no ofrece una API pública oficial estable.
- Puede fallar por CORS, bloqueo, cookies o cambios internos de Yahoo.
- Si falla, la aplicación mantiene la opción de introducir cotización manual.
- Para uso más estable se recomienda Finnhub, Twelve Data o Alpha Vantage.


## Corrección error `Unexpected token DOCTYPE`

Esta versión corrige un problema del service worker:

```text
Unexpected token '<', "<!DOCTYPE..." is not valid JSON
```

La causa habitual es que una petición externa de API fallaba y la PWA devolvía `index.html`
como fallback de caché. Ahora el service worker no intercepta APIs externas.

También se ha añadido validación para mostrar un error claro cuando un proveedor devuelve HTML
en lugar de JSON.


## Corrección Yahoo sin API key

Yahoo Finance experimental no requiere API key.  
La validación se ha ajustado para que solo pidan clave:

- Finnhub
- Twelve Data
- Alpha Vantage

Yahoo puede quedar con API key vacía.


## Corrección final de Yahoo sin API key

Se ha corregido la validación para que Yahoo Finance experimental no pida API key.

Si en el móvil sigue apareciendo "Falta API key", no es el código nuevo:
es la PWA antigua cacheada. Hay que borrar datos de la app o abrir GitHub Pages y recargar.
