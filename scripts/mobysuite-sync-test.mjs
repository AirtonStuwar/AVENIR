// Script de prueba (no forma parte de la app) — jala el cronograma de cuotas de un
// proyecto de Mobysuite y lo guarda en la tabla mobysuite_cuota, para validar el mapeo
// de campos antes de automatizar la sincronización con una Edge Function.
//
// Uso:
//   MOBY_HOST=https://... MOBY_CLIENT_ID=... MOBY_CLIENT_SECRET=... \
//   SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/mobysuite-sync-test.mjs --moby-project=4 --avenir-proyecto=5

import { createClient } from '@supabase/supabase-js'

const arg = (name) => {
  const found = process.argv.find(a => a.startsWith(`--${name}=`))
  return found ? found.split('=')[1] : null
}

const MOBY_HOST = process.env.MOBY_HOST
const MOBY_CLIENT_ID = process.env.MOBY_CLIENT_ID
const MOBY_CLIENT_SECRET = process.env.MOBY_CLIENT_SECRET
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const MOBY_PROJECT_ID = arg('moby-project') ?? '4'
const AVENIR_PROYECTO_ID = Number(arg('avenir-proyecto') ?? '5')

for (const [k, v] of Object.entries({ MOBY_HOST, MOBY_CLIENT_ID, MOBY_CLIENT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY })) {
  if (!v) {
    console.error(`Falta la variable de entorno ${k}`)
    process.exit(1)
  }
}

async function getToken() {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: MOBY_CLIENT_ID,
    client_secret: MOBY_CLIENT_SECRET,
  })
  const res = await fetch(`${MOBY_HOST}/oauth/token`, { method: 'POST', body })
  if (!res.ok) throw new Error(`Login Mobysuite falló: ${res.status} ${await res.text()}`)
  const json = await res.json()
  return json.accessToken
}

function isPagado(pago) {
  return Array.isArray(pago.reciboPago) && pago.reciboPago.some(r => r.estadoPago === 'Documentado')
}

function toDate(iso) {
  if (!iso) return null
  return iso.slice(0, 10) // YYYY-MM-DD
}

async function fetchContracts(token) {
  const res = await fetch(`${MOBY_HOST}/v1/api/integrations/contracts?project=${MOBY_PROJECT_ID}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Contracts falló: ${res.status} ${await res.text()}`)
  return res.json()
}

async function main() {
  console.log(`Obteniendo token de Mobysuite...`)
  const token = await getToken()
  console.log(`Token OK. Consultando contratos del proyecto Mobysuite ${MOBY_PROJECT_ID}...`)
  const contratos = await fetchContracts(token)
  console.log(`Contratos recibidos: ${contratos.length}`)

  const rows = []
  for (const c of contratos) {
    const cliente = c.cliente ?? {}
    const bien = Array.isArray(c.bienes) ? c.bienes.find(b => b.isPrimary) ?? c.bienes[0] : null
    for (const pago of c.pagos ?? []) {
      rows.push({
        proyecto_id: AVENIR_PROYECTO_ID,
        moby_contrato_id: c.id,
        moby_cuota_id: pago.id,
        contrato_estado: c.estadoContrato ?? null,
        cliente_rut: cliente.rut ?? null,
        cliente_nombre: cliente.razonSocial ?? ([cliente.nombre, cliente.apellido].filter(Boolean).join(' ') || null),
        cliente_email: cliente.email ?? null,
        cliente_telefono: cliente.telefonoDos ?? cliente.telefonoUno ?? null,
        bien_numero: bien?.numeroDeBien ?? null,
        numero_cuota: pago.cuota ?? null,
        descripcion_pago: pago.descripcionPago ?? null,
        fecha_vencimiento: toDate(pago.fechaVencimientoPago),
        monto: pago.montoPago ?? 0,
        estado: isPagado(pago) ? 'Pagado' : 'Pendiente',
        fecha_pago: isPagado(pago) ? toDate(pago.reciboPago[0]?.fechaTipoPago) : null,
        ultima_sincronizacion: new Date().toISOString(),
      })
    }
  }

  console.log(`Cuotas a insertar/actualizar: ${rows.length}`)

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { error, count } = await supabase
    .from('mobysuite_cuota')
    .upsert(rows, { onConflict: 'moby_cuota_id', count: 'exact' })

  if (error) {
    console.error('Error al guardar en Supabase:', error)
    process.exit(1)
  }
  console.log(`Listo. ${count ?? rows.length} filas guardadas/actualizadas en mobysuite_cuota.`)

  const pendientes = rows.filter(r => r.estado === 'Pendiente')
  const vencidas = pendientes.filter(r => r.fecha_vencimiento && r.fecha_vencimiento < new Date().toISOString().slice(0, 10))
  console.log(`Resumen: ${rows.length} cuotas totales, ${pendientes.length} pendientes, ${vencidas.length} vencidas.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
