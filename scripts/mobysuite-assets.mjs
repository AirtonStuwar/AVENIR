// Script de exploración (solo lectura, no forma parte de la app).
// Prueba los endpoints de "assets" y "payments" de la documentación Postman de Mobysuite e imprime
// SOLO estructura y conteos (nombres de campos, estados, tipos), nunca nombres/RUT/correos de clientes.
//
// Uso (PowerShell), con las credenciales en variables de entorno de ESA ventana (no las pegues en el chat):
//   $env:MOBY_HOST="https://..."; $env:MOBY_CLIENT_ID="..."; $env:MOBY_CLIENT_SECRET="..."
//   node scripts/mobysuite-assets.mjs --project=6
// Pega en el chat solo la salida.

const arg = (n) => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=')[1]
const { MOBY_HOST, MOBY_CLIENT_ID, MOBY_CLIENT_SECRET } = process.env
const PROJECT = arg('project') ?? '6'

for (const [k, v] of Object.entries({ MOBY_HOST, MOBY_CLIENT_ID, MOBY_CLIENT_SECRET })) {
  if (!v) { console.error(`Falta la variable de entorno ${k}`); process.exit(1) }
}

const PERSONAL = /nombre|name|rut|mail|correo|telefono|phone|fono|direccion|address|documento|dni|apellido|razon|customer|client|owner|username|user/i
const MOSTRAR_VALORES = /estado|status|tipo|type|categor|etapa|stage|moneda|clase|origen|origin|deleted|available|enum|typology|tipolog|dorm|piso|floor|reserv|webquote/i
const ES_FECHA = /^\d{4}-\d{2}-\d{2}/

async function token() {
  const res = await fetch(`${MOBY_HOST}/oauth/token`, {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: MOBY_CLIENT_ID, client_secret: MOBY_CLIENT_SECRET }),
  })
  if (!res.ok) throw new Error(`Login falló: ${res.status}`)
  return (await res.json()).accessToken
}

function resumir(items) {
  const rutas = new Map()
  const nuevo = () => ({ tipos: new Set(), n: 0, vacios: 0, valores: new Map(), fmin: null, fmax: null })
  const visitar = (valor, ruta) => {
    if (Array.isArray(valor)) {
      const r = rutas.get(ruta) ?? nuevo()
      r.tipos.add('array'); r.n++; if (valor.length === 0) r.vacios++
      rutas.set(ruta, r)
      valor.forEach(v => visitar(v, ruta + '[]'))
      return
    }
    if (valor && typeof valor === 'object') {
      for (const [k, v] of Object.entries(valor)) visitar(v, ruta ? `${ruta}.${k}` : k)
      return
    }
    const r = rutas.get(ruta) ?? nuevo()
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
      if (MOSTRAR_VALORES.test(campo) && !PERSONAL.test(ruta) && (r.valores.size < 15 || r.valores.has(String(valor)))) {
        const k = String(valor).slice(0, 40)
        r.valores.set(k, (r.valores.get(k) ?? 0) + 1)
      }
    }
    rutas.set(ruta, r)
  }
  items.forEach(it => visitar(it, ''))
  return rutas
}

function imprimir(titulo, items) {
  console.log(`\n==== ${titulo} (${items.length} registros) ====`)
  for (const [ruta, r] of [...resumir(items)].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (PERSONAL.test(ruta) && !/assetType|status|deleted/i.test(ruta)) {
      console.log(`  ${ruta || '(raíz)'}  (posible dato personal: solo se indica que existe, con valor ${r.n - r.vacios}/${r.n})`)
      continue
    }
    const partes = [`${ruta || '(raíz)'}  [${[...r.tipos].join('|')}]  con valor: ${r.n - r.vacios}/${r.n}`]
    if (r.fmin) partes.push(`fechas ${r.fmin} → ${r.fmax}`)
    if (r.valores.size) partes.push(`valores: ${[...r.valores].map(([v, c]) => `${v} (${c})`).join(' · ')}`)
    console.log('  ' + partes.join('   '))
  }
}

async function get(tk, ruta, opciones = {}) {
  const res = await fetch(`${MOBY_HOST}${ruta}`, { headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' }, ...opciones })
  const texto = await res.text()
  let json = null
  try { json = JSON.parse(texto) } catch { /* no es JSON */ }
  return { status: res.status, json, largo: texto.length }
}

// La respuesta puede ser lista, { content: [...] } (paginada de Spring) o { data: [...] }
const comoLista = (j) => Array.isArray(j) ? j : (Array.isArray(j?.content) ? j.content : (Array.isArray(j?.data) ? j.data : null))

const tk = await token()

const pruebas = [
  `/v1/api/integrations/assets/all-assets?projectId=${PROJECT}`,
  `/v1/api/integrations/assets?projectId=${PROJECT}&page=0&size=500`,
  `/v1/api/integrations/assets/contracts?projectId=${PROJECT}&page=0&size=500`,
  `/v1/api/integrations/asset-types/project/${PROJECT}`,
  `/v1/api/integrations/payments/list-payments-pageable?project=${PROJECT}&page=0&sinceDate=01-01-2026,31-12-2026`,
]

for (const ruta of pruebas) {
  const r = await get(tk, ruta)
  console.log(`\n#### ${r.status}  ${ruta}  (${r.largo} bytes)`)
  if (r.status !== 200 || r.json == null) continue
  const lista = comoLista(r.json)
  if (lista) {
    if (!Array.isArray(r.json)) console.log(`  (envoltorio: ${Object.keys(r.json).filter(k => !Array.isArray(r.json[k])).map(k => `${k}=${JSON.stringify(r.json[k])}`).join(', ')})`)
    imprimir(ruta.split('?')[0], lista)
  } else {
    imprimir(ruta.split('?')[0], [r.json])
  }
}

console.log('\n(Fin. Pega solo esta salida en el chat.)')
