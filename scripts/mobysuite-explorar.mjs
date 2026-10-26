// Script de exploración (solo lectura, no forma parte de la app).
// Muestra QUÉ campos entrega Mobysuite (nombres, tipos, fechas disponibles y valores de campos
// tipo "estado"/"tipo"), SIN imprimir nombres, RUT, correos ni teléfonos de clientes.
//
// Uso (PowerShell), con las mismas credenciales que tiene Vercel:
//   $env:MOBY_HOST="https://..."; $env:MOBY_CLIENT_ID="..."; $env:MOBY_CLIENT_SECRET="..."
//   node scripts/mobysuite-explorar.mjs --project=6
//
// --project = moby_project_id (Park View = 6). Pega la salida completa en el chat.

const arg = (n) => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=')[1]
const { MOBY_HOST, MOBY_CLIENT_ID, MOBY_CLIENT_SECRET } = process.env
const PROJECT = arg('project') ?? '6'

for (const [k, v] of Object.entries({ MOBY_HOST, MOBY_CLIENT_ID, MOBY_CLIENT_SECRET })) {
  if (!v) { console.error(`Falta la variable de entorno ${k}`); process.exit(1) }
}

const PERSONAL = /nombre|name|rut|rol|mail|correo|telefono|phone|fono|direccion|address|documento|dni|apellido|razon/i
const MOSTRAR_VALORES = /estado|status|tipo|type|categor|etapa|moneda|currency|clase|modalidad|origen/i
const ES_FECHA = /^\d{4}-\d{2}-\d{2}/

async function token() {
  const res = await fetch(`${MOBY_HOST}/oauth/token`, {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: MOBY_CLIENT_ID, client_secret: MOBY_CLIENT_SECRET }),
  })
  if (!res.ok) throw new Error(`Login falló: ${res.status}`)
  return (await res.json()).accessToken
}

// Recorre todos los objetos y resume cada ruta de campo: tipo, cuántos tienen valor, rango de fechas o valores distintos
function resumir(items) {
  const rutas = new Map()
  const visitar = (valor, ruta) => {
    if (Array.isArray(valor)) {
      const r = rutas.get(ruta) ?? { tipos: new Set(), n: 0, vacios: 0, valores: new Set(), fmin: null, fmax: null }
      r.tipos.add('array'); r.n++; if (valor.length === 0) r.vacios++
      rutas.set(ruta, r)
      valor.forEach(v => visitar(v, ruta + '[]'))
      return
    }
    if (valor && typeof valor === 'object') {
      for (const [k, v] of Object.entries(valor)) visitar(v, ruta ? `${ruta}.${k}` : k)
      return
    }
    const r = rutas.get(ruta) ?? { tipos: new Set(), n: 0, vacios: 0, valores: new Set(), fmin: null, fmax: null }
    r.n++
    if (valor === null || valor === undefined || valor === '') { r.vacios++; r.tipos.add('null'); rutas.set(ruta, r); return }
    if (typeof valor === 'string' && ES_FECHA.test(valor)) {
      r.tipos.add('fecha')
      const d = valor.slice(0, 10)
      if (!r.fmin || d < r.fmin) r.fmin = d
      if (!r.fmax || d > r.fmax) r.fmax = d
    } else {
      r.tipos.add(typeof valor)
      const campo = ruta.split('.').pop().replace(/\[\]/g, '')
      if (MOSTRAR_VALORES.test(campo) && !PERSONAL.test(campo) && r.valores.size < 15) r.valores.add(String(valor).slice(0, 40))
    }
    rutas.set(ruta, r)
  }
  items.forEach(it => visitar(it, ''))
  return rutas
}

function imprimir(titulo, items) {
  console.log(`\n==== ${titulo} (${items.length} registros) ====`)
  for (const [ruta, r] of [...resumir(items)].sort((a, b) => a[0].localeCompare(b[0]))) {
    const campo = ruta.split('.').pop()
    const partes = [`${ruta || '(raíz)'}  [${[...r.tipos].join('|')}]  con valor: ${r.n - r.vacios}/${r.n}`]
    if (r.fmin) partes.push(`fechas ${r.fmin} → ${r.fmax}`)
    if (r.valores.size) partes.push(`valores: ${[...r.valores].join(' · ')}`)
    else if (PERSONAL.test(campo)) partes.push('(dato personal: no se muestra)')
    console.log('  ' + partes.join('   '))
  }
}

async function get(tk, ruta) {
  const res = await fetch(`${MOBY_HOST}${ruta}`, { headers: { Authorization: `Bearer ${tk}` } })
  const texto = await res.text()
  let json = null
  try { json = JSON.parse(texto) } catch { /* no es JSON */ }
  return { status: res.status, json }
}

const tk = await token()

// 1) Contratos del proyecto
const c = await get(tk, `/v1/api/integrations/contracts?project=${PROJECT}`)
const contratos = Array.isArray(c.json) ? c.json : c.json?.data
if (c.status === 200 && Array.isArray(contratos)) {
  imprimir('CONTRATOS', contratos)
} else {
  console.log('Contratos:', c.status)
}

// 2) Otros endpoints que podrían traer stock, unidades o proyectos (solo se reporta si existen)
const candidatos = [
  `/v1/api/integrations/projects`,
  `/v1/api/integrations/projects/${PROJECT}`,
  `/v1/api/integrations/properties?project=${PROJECT}`,
  `/v1/api/integrations/units?project=${PROJECT}`,
  `/v1/api/integrations/inventory?project=${PROJECT}`,
  `/v1/api/integrations/stock?project=${PROJECT}`,
  `/v1/api/integrations/reservations?project=${PROJECT}`,
  `/v1/api/integrations/promises?project=${PROJECT}`,
  `/v1/api/integrations/quotations?project=${PROJECT}`,
  `/v1/api/integrations/clients?project=${PROJECT}`,
]
console.log('\n==== OTROS ENDPOINTS PROBADOS ====')
for (const ruta of candidatos) {
  const r = await get(tk, ruta)
  console.log(`  ${r.status}  ${ruta}`)
  if (r.status === 200 && r.json) {
    const lista = Array.isArray(r.json) ? r.json : (Array.isArray(r.json.data) ? r.json.data : [r.json])
    imprimir(ruta, lista)
  }
}
