// Script de verificación (solo lectura, no forma parte de la app).
// Calcula, por proyecto, los indicadores del dashboard del directorio a partir de los contratos de Mobysuite,
// para compararlos con las cifras que ya se presentan. Imprime SOLO totales y conteos: ningún dato de clientes.
//
// Uso (PowerShell), con las credenciales en variables de entorno de esa ventana:
//   node scripts/mobysuite-indicadores.mjs --project=6
//   node scripts/mobysuite-indicadores.mjs --project=4,5,6,7,9      (varios proyectos)

const arg = (n) => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=')[1]
const { MOBY_HOST, MOBY_CLIENT_ID, MOBY_CLIENT_SECRET } = process.env
const PROYECTOS = (arg('project') ?? '6').split(',')

for (const [k, v] of Object.entries({ MOBY_HOST, MOBY_CLIENT_ID, MOBY_CLIENT_SECRET })) {
  if (!v) { console.error(`Falta la variable de entorno ${k}`); process.exit(1) }
}

async function token() {
  const res = await fetch(`${MOBY_HOST}/oauth/token`, {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: MOBY_CLIENT_ID, client_secret: MOBY_CLIENT_SECRET }),
  })
  if (!res.ok) throw new Error(`Login falló: ${res.status}`)
  return (await res.json()).accessToken
}

const contar = (arr, fn) => arr.reduce((m, x) => { const k = fn(x) ?? '(vacío)'; m[k] = (m[k] ?? 0) + 1; return m }, {})
const mes = (f) => (f ? String(f).slice(0, 7) : null)
const suma = (arr, fn) => arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0)
const fmt = (n) => Number(n).toLocaleString('es-PE', { maximumFractionDigits: 2 })
const ordenado = (obj) => Object.fromEntries(Object.entries(obj).sort((a, b) => a[0].localeCompare(b[0])))

const tk = await token()

for (const id of PROYECTOS) {
  const res = await fetch(`${MOBY_HOST}/v1/api/integrations/contracts?project=${id}`, { headers: { Authorization: `Bearer ${tk}` } })
  if (!res.ok) { console.log(`\n#### Proyecto ${id}: error ${res.status}`); continue }
  const json = await res.json()
  const contratos = Array.isArray(json) ? json : json.data ?? []
  const bienes = contratos.flatMap(c => (c.bienes ?? []).map(b => ({ ...b, _contrato: c })))
  const deptos = bienes.filter(b => b.tipoBien === 'DEPARTAMENTO')
  const deptosVigentes = deptos.filter(b => !b.eliminadoContrato)

  console.log(`\n#################### PROYECTO ${id} ####################`)
  console.log(`Contratos: ${contratos.length}  por estado:`, contar(contratos, c => c.estadoContrato))
  console.log(`Bienes: ${bienes.length}  por tipoBien:`, contar(bienes, b => b.tipoBien))
  console.log(`Bienes con eliminadoContrato=true:`, contar(bienes, b => String(b.eliminadoContrato)))
  console.log(`Departamentos total: ${deptos.length}  | vigentes (no eliminados): ${deptosVigentes.length}`)
  console.log(`  vigentes por estado del bien:`, contar(deptosVigentes, b => b.estadoBien))
  console.log(`  contratos con más de 1 departamento:`, contratos.filter(c => (c.bienes ?? []).filter(b => b.tipoBien === 'DEPARTAMENTO').length > 1).length)

  console.log(`\n-- Montos --`)
  console.log(`  Suma precioTotal de contratos:            S/ ${fmt(suma(contratos, c => c.precioTotal))}`)
  console.log(`  Suma valorVenta de TODOS los bienes:      S/ ${fmt(suma(bienes, b => b.valorVenta))}`)
  console.log(`  Suma valorVenta de deptos vigentes:       S/ ${fmt(suma(deptosVigentes, b => b.valorVenta))}`)
  console.log(`  Suma valorVenta de deptos PROMESADOS:     S/ ${fmt(suma(deptosVigentes.filter(b => b.estadoBien === 'PROMESADO'), b => b.valorVenta))}`)

  console.log(`\n-- Precio por m² (deptos vigentes) --`)
  const m2Pond = suma(deptosVigentes, b => b.superficiePonderada), m2Total = suma(deptosVigentes, b => b.superficieTotal), m2Util = suma(deptosVigentes, b => b.superficieUtil)
  const venta = suma(deptosVigentes, b => b.valorVenta)
  console.log(`  valorVenta / superficiePonderada: ${m2Pond ? fmt(venta / m2Pond) : '—'}   | / superficieTotal: ${m2Total ? fmt(venta / m2Total) : '—'}   | / superficieUtil: ${m2Util ? fmt(venta / m2Util) : '—'}`)

  console.log(`\n-- Evolución mensual (por contrato) --`)
  console.log(`  Separaciones por mes (fechaReserva):`, ordenado(contar(contratos, c => mes(c.fechaReserva))))
  console.log(`  Minutas por mes (fechaPromesa):     `, ordenado(contar(contratos.filter(c => c.fechaPromesa), c => mes(c.fechaPromesa))))

  const de2026 = contratos.filter(c => String(c.fechaPromesa ?? '').startsWith('2026'))
  console.log(`\n-- Ventas 2026 (minutas con fechaPromesa en 2026): ${de2026.length} contratos, S/ ${fmt(suma(de2026, c => c.precioTotal))}`)

  console.log(`\n-- Tipología de los departamentos (campo "tipo") --`)
  console.log(`  `, ordenado(contar(deptosVigentes, b => b.tipo)))
  console.log(`  por piso:`, ordenado(contar(deptosVigentes, b => String(b.piso).padStart(2, '0'))))
  console.log(`  por n° de dormitorios:`, ordenado(contar(deptosVigentes, b => b.numeroDeDormitorios)))
  console.log(`  por cantidad de bienes por contrato:`, ordenado(contar(contratos, c => (c.bienes ?? []).length)))
}
