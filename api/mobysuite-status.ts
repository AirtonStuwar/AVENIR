import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'edge' }

// Resumen EN VIVO (solo cifras agregadas, sin datos de clientes) del estado comercial de un proyecto de Mobysuite:
// unidades por estado y tipo, venta, precio por m² y cobrado. No persiste nada.
// Uso: GET /api/mobysuite-status?mobyProjectId=6

interface MobyRecibo { estadoPago?: string; pesosMontoPagado?: number }
interface MobyPago { descripcionPago?: string; reciboPago?: MobyRecibo[] }
interface MobyBien {
  tipoBien?: string
  estadoBien?: string
  eliminadoContrato?: boolean
  piso?: number
  numeroDeDormitorios?: number
  valorVenta?: number
  superficieTotal?: number
}
interface MobyContrato {
  estadoContrato?: string
  precioTotal?: number
  bienes?: MobyBien[]
  pagos?: MobyPago[]
}

type Conteo = { promesado: number; reservado: number }
const vacio = (): Conteo => ({ promesado: 0, reservado: 0 })

async function getToken(host: string, clientId: string, clientSecret: string): Promise<string> {
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret })
  const res = await fetch(`${host}/oauth/token`, { method: 'POST', body })
  if (!res.ok) throw new Error(`Login Mobysuite falló: ${res.status}`)
  return ((await res.json()) as { accessToken: string }).accessToken
}

const ESTADOS_RECIBO_PAGADO = ['DOCUMENTADO', 'PAGADO']
const esReciboPagado = (r: MobyRecibo) => ESTADOS_RECIBO_PAGADO.includes((r.estadoPago ?? '').trim().toUpperCase())
const esCuotaDeAjuste = (d?: string) => (d ?? '').trim().toUpperCase().startsWith('CUOTA DE AJUSTE')

// Datos agregados de proyecto para gerencia: solo ADMIN (1) y APROBADOR (9)
async function requireRol(req: Request): Promise<boolean> {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const auth = req.headers.get('Authorization')
  if (!url || !key || !auth?.startsWith('Bearer ')) return false
  const admin = createClient(url, key)
  const { data: { user }, error } = await admin.auth.getUser(auth.slice(7))
  if (error || !user) return false
  const { data: rolRow } = await admin.from('usuario_rol').select('rol').eq('usuario', user.id).maybeSingle()
  return [1, 9].includes(rolRow?.rol as number)
}

export default async function handler(req: Request): Promise<Response> {
  if (!(await requireRol(req))) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const mobyProjectId = new URL(req.url).searchParams.get('mobyProjectId')
  if (!mobyProjectId) return Response.json({ error: 'mobyProjectId requerido' }, { status: 400 })

  const { MOBY_HOST, MOBY_CLIENT_ID, MOBY_CLIENT_SECRET } = process.env
  if (!MOBY_HOST || !MOBY_CLIENT_ID || !MOBY_CLIENT_SECRET) {
    return Response.json({ error: 'Integración Mobysuite no configurada en el servidor' }, { status: 500 })
  }

  try {
    const token = await getToken(MOBY_HOST, MOBY_CLIENT_ID, MOBY_CLIENT_SECRET)
    const res = await fetch(`${MOBY_HOST}/v1/api/integrations/contracts?project=${encodeURIComponent(mobyProjectId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return Response.json({ error: `Mobysuite respondió ${res.status}` }, { status: 502 })
    const contratos = (await res.json()) as MobyContrato[]

    const contratosPorEstado: Record<string, number> = {}
    const deptos = vacio(), estacionamientos = vacio(), depositos = vacio()
    const venta = vacio()                  // suma de precioTotal de los contratos por estado (incluye estacionamientos y depósitos)
    const ventaDeptos = vacio()            // suma de valorVenta de los departamentos
    const m2 = { minutas: { venta: 0, superficie: 0 }, todos: { venta: 0, superficie: 0 } }
    const porDormitorios: Record<string, Conteo> = {}
    const porPiso: Record<string, Conteo> = {}
    let cobrado = 0, valorContratos = 0

    for (const c of contratos) {
      const est = (c.estadoContrato ?? 'SIN ESTADO').toUpperCase()
      contratosPorEstado[est] = (contratosPorEstado[est] ?? 0) + 1
      const clave = est === 'PROMESADO' ? 'promesado' : est === 'RESERVADO' ? 'reservado' : null
      if (clave) venta[clave] += c.precioTotal ?? 0
      valorContratos += c.precioTotal ?? 0

      for (const b of c.bienes ?? []) {
        if (b.eliminadoContrato) continue
        const tipo = (b.tipoBien ?? '').toUpperCase()
        const estBien = (b.estadoBien ?? '').toUpperCase()
        const k = estBien === 'PROMESADO' ? 'promesado' : estBien === 'RESERVADO' ? 'reservado' : null
        if (!k) continue
        if (tipo === 'ESTACIONAMIENTO') estacionamientos[k]++
        else if (tipo === 'DEPOSITO') depositos[k]++
        else if (tipo === 'DEPARTAMENTO') {
          deptos[k]++
          ventaDeptos[k] += b.valorVenta ?? 0
          m2.todos.venta += b.valorVenta ?? 0
          m2.todos.superficie += b.superficieTotal ?? 0
          if (k === 'promesado') {
            m2.minutas.venta += b.valorVenta ?? 0
            m2.minutas.superficie += b.superficieTotal ?? 0
          }
          const dorm = String(b.numeroDeDormitorios ?? 's/d')
          const piso = String(b.piso ?? 's/d').padStart(2, '0')
          ;(porDormitorios[dorm] ??= vacio())[k]++
          ;(porPiso[piso] ??= vacio())[k]++
        }
      }

      for (const p of c.pagos ?? []) {
        if (esCuotaDeAjuste(p.descripcionPago)) continue
        const r = p.reciboPago?.find(esReciboPagado)
        if (r) cobrado += r.pesosMontoPagado ?? 0
      }
    }

    return Response.json({
      totalContratos: contratos.length,
      contratosPorEstado,
      deptos, estacionamientos, depositos,
      venta, ventaDeptos,
      precioM2: {
        minutas: m2.minutas.superficie ? m2.minutas.venta / m2.minutas.superficie : null,
        todos: m2.todos.superficie ? m2.todos.venta / m2.todos.superficie : null,
      },
      porDormitorios, porPiso,
      cobrado, valorContratos,
    })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Error desconocido' }, { status: 500 })
  }
}
