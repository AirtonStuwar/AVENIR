export const config = { runtime: 'edge' }

// Consulta EN VIVO el cronograma de cuotas de un proyecto en Mobysuite — no persiste nada.
// Uso: GET /api/mobysuite-cronograma?mobyProjectId=4

interface MobyRecibo {
  estadoPago?: string
  fechaTipoPago?: string
}

interface MobyPago {
  id: number
  codigo: string
  cuota: number
  descripcionPago: string
  fechaVencimientoPago: string
  montoPago: number
  reciboPago?: MobyRecibo[]
}

interface MobyBien {
  numeroDeBien?: string
  isPrimary?: boolean
}

interface MobyCliente {
  rut?: string
  razonSocial?: string
  nombre?: string
  apellido?: string
  email?: string
  telefonoDos?: string
  telefonoUno?: string
}

interface MobyContrato {
  id: number
  estadoContrato: string
  precioTotal?: number
  pagos?: MobyPago[]
  bienes?: MobyBien[]
  cliente?: MobyCliente
}

async function getToken(host: string, clientId: string, clientSecret: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })
  const res = await fetch(`${host}/oauth/token`, { method: 'POST', body })
  if (!res.ok) throw new Error(`Login Mobysuite falló: ${res.status}`)
  const json = await res.json() as { accessToken: string }
  return json.accessToken
}

function toDate(iso?: string): string | null {
  if (!iso) return null
  return iso.slice(0, 10)
}

function categoria(descripcion: string): 'BANCO' | 'CLIENTE' {
  const d = descripcion.toUpperCase()
  return d.includes('HIPOTECARIO') || d.includes('CREDITO') ? 'BANCO' : 'CLIENTE'
}

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url)
  const mobyProjectId = searchParams.get('mobyProjectId')

  if (!mobyProjectId) {
    return Response.json({ error: 'mobyProjectId requerido' }, { status: 400 })
  }

  const MOBY_HOST = process.env.MOBY_HOST
  const MOBY_CLIENT_ID = process.env.MOBY_CLIENT_ID
  const MOBY_CLIENT_SECRET = process.env.MOBY_CLIENT_SECRET

  if (!MOBY_HOST || !MOBY_CLIENT_ID || !MOBY_CLIENT_SECRET) {
    return Response.json({ error: 'Integración Mobysuite no configurada en el servidor' }, { status: 500 })
  }

  try {
    const token = await getToken(MOBY_HOST, MOBY_CLIENT_ID, MOBY_CLIENT_SECRET)

    const res = await fetch(`${MOBY_HOST}/v1/api/integrations/contracts?project=${encodeURIComponent(mobyProjectId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      return Response.json({ error: `Mobysuite respondió ${res.status}` }, { status: 502 })
    }
    const contratos = (await res.json()) as MobyContrato[]

    const hoy = new Date().toISOString().slice(0, 10)
    const cuotas = []
    let ventasAcumuladas = 0

    for (const c of contratos) {
      ventasAcumuladas += c.precioTotal ?? 0
      const cliente = c.cliente ?? {}
      const bien = c.bienes?.find(b => b.isPrimary) ?? c.bienes?.[0]
      const clienteNombre = cliente.razonSocial
        || [cliente.nombre, cliente.apellido].filter(Boolean).join(' ')
        || null

      for (const pago of c.pagos ?? []) {
        if (!pago.montoPago || pago.montoPago === 0) continue // excluye "Cuota de ajuste" sin monto real

        const reciboPagado = pago.reciboPago?.find(r => r.estadoPago === 'Documentado')
        const pagado = !!reciboPagado
        const fechaVenc = toDate(pago.fechaVencimientoPago)
        const estado = pagado ? 'Pagado' : (fechaVenc && fechaVenc < hoy ? 'Vencido' : 'Pendiente')

        cuotas.push({
          contratoId: c.id,
          contratoEstado: c.estadoContrato,
          clienteRut: cliente.rut ?? null,
          clienteNombre,
          clienteEmail: cliente.email ?? null,
          clienteTelefono: cliente.telefonoDos ?? cliente.telefonoUno ?? null,
          bienNumero: bien?.numeroDeBien ?? null,
          numeroCuota: pago.cuota,
          descripcion: pago.descripcionPago,
          categoria: categoria(pago.descripcionPago ?? ''),
          fechaVencimiento: fechaVenc,
          fechaPago: toDate(reciboPagado?.fechaTipoPago),
          monto: pago.montoPago,
          estado,
        })
      }
    }

    return Response.json({
      totalContratos: contratos.length,
      totalCuotas: cuotas.length,
      ventasAcumuladas,
      cuotas,
    })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Error desconocido' }, { status: 500 })
  }
}
