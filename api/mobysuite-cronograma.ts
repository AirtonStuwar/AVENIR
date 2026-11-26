import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'edge' }

// Consulta EN VIVO el cronograma de cuotas de un proyecto en Mobysuite — no persiste nada.
// Uso: GET /api/mobysuite-cronograma?mobyProjectId=4

interface MobyRecibo {
  estadoPago?: string
  fechaTipoPago?: string
  unidadFomentoMontoPagado?: number | string
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

// Solo conocemos con certeza `numeroDeBien` e `isPrimary`; el resto de campos del bien (entre ellos
// el que diga si es departamento o estacionamiento) no estaba documentado, por eso se lee de forma
// defensiva (ver tipoDelBien) y se devuelve un `diagnostico` con los campos que realmente llegan.
interface MobyBien {
  numeroDeBien?: string
  isPrimary?: boolean
  [campo: string]: unknown
}

interface BienSalida {
  numero: string
  tipo: string | null
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

// ── Tipo de bien (departamento, estacionamiento…) ─────────────────────────────────────────────
const CAMPOS_TIPO = [
  'tipoDeBien', 'tipoBien', 'tipo', 'tipoUnidad', 'tipoDeUnidad', 'tipoInmueble', 'tipoDeInmueble',
  'tipoProducto', 'tipoDeProducto', 'categoria', 'clase',
]
// Campos cuyo NOMBRE sugiere que describen el bien; solo en estos se busca como último recurso
const NOMBRE_CAMPO_DESCRIPTIVO = /tipo|type|categ|clase|descrip|nombre|name|producto|unidad/i
// Orden importa: "estacionamiento de motos" debe ganar a "local"; "depósito" a "departamento"
const PATRONES_TIPO: Array<[RegExp, string]> = [
  [/moto/i, 'Estacionamiento de motos'],
  [/estacionamiento|cochera|parking|garaje|garage/i, 'Estacionamiento'],
  [/dep[oó]sito|bodega/i, 'Depósito'],
  [/departamento|dpto|d[uú]plex|flat|penthouse/i, 'Departamento'],
  [/local/i, 'Local'],
]

function textoDe(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return v.trim()
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    for (const k of ['nombre', 'name', 'descripcion', 'description', 'label']) {
      if (typeof o[k] === 'string' && (o[k] as string).trim()) return (o[k] as string).trim()
    }
  }
  return null
}

function tipoDelBien(b: MobyBien): string | null {
  // 1) un campo de tipo conocido, tal cual lo manda Mobysuite
  for (const k of CAMPOS_TIPO) {
    const t = textoDe(b[k])
    if (t) return t
  }
  // 2) último recurso: campos con nombre descriptivo cuyo texto mencione un tipo conocido
  for (const [k, v] of Object.entries(b)) {
    if (k === 'numeroDeBien' || !NOMBRE_CAMPO_DESCRIPTIVO.test(k)) continue
    const t = textoDe(v)
    if (!t) continue
    const hallado = PATRONES_TIPO.find(([re]) => re.test(t))
    if (hallado) return hallado[1]
  }
  return null
}

// Un recibo "Documentado" o "Pagado" significa que la cuota está cancelada. Antes solo se
// reconocía "Documentado", y los recibos en estado "Pagado" se contaban como deuda. Se compara
// sin distinguir mayúsculas/espacios; cualquier otro estado (ej. uno reversado) NO cuenta como pago.
const ESTADOS_RECIBO_PAGADO = ['DOCUMENTADO', 'PAGADO']

function esReciboPagado(r: MobyRecibo): boolean {
  return ESTADOS_RECIBO_PAGADO.includes((r.estadoPago ?? '').trim().toUpperCase())
}

function esCuotaDeAjuste(descripcion?: string): boolean {
  return (descripcion ?? '').trim().toUpperCase().startsWith('CUOTA DE AJUSTE')
}

function categoria(descripcion: string): 'BANCO' | 'CLIENTE' {
  const d = descripcion.toUpperCase()
  return d.includes('HIPOTECARIO') || d.includes('CREDITO') ? 'BANCO' : 'CLIENTE'
}

// ── Monto documentado vs pactado ─────────────────────────────────────────────
// `montoPago` es lo PACTADO en el cronograma; lo que el cliente realmente pagó es el
// `unidadFomentoMontoPagado` de sus recibos ("Monto documentado S/." en Mobysuite).
// OJO: `pesosMontoPagado` NO sirve (es la segunda columna de importes, ~3.7 veces mayor).
const TOLERANCIA = 1 // diferencias de céntimos por redondeo de Mobysuite no cuentan
const r2 = (n: number) => Math.round(n * 100) / 100

export interface Abono { fecha: string | null; monto: number }

export interface CuotaCalculada {
  numeroCuota: number
  categoria: 'BANCO' | 'CLIENTE'
  fechaVencimiento: string | null
  monto: number      // pactado
  ejecutado: number  // documentado
  saldo: number      // por cobrar
  adelanto: number   // parte cubierta con lo que se pagó de más en otras cuotas
}

// Pagos documentados de una cuota. Si algún recibo pagado no trae importe, se cae al monto
// pactado (como se calculaba antes) y se marca `sinMonto` para informarlo, en vez de inventar deuda.
export function abonosDe(recibos: MobyRecibo[], pactado: number): { abonos: Abono[]; sinMonto: boolean } {
  const pagados = recibos.filter(esReciboPagado)
  if (pagados.length === 0) return { abonos: [], sinMonto: false }
  const abonos = pagados.map(r => ({ fecha: toDate(r.fechaTipoPago), monto: Number(r.unidadFomentoMontoPagado) }))
  if (abonos.some(a => !Number.isFinite(a.monto) || a.monto <= 0)) {
    return { abonos: [{ fecha: abonos[0].fecha, monto: pactado }], sinMonto: true }
  }
  return { abonos, sinMonto: false }
}

// Lo pagado de más en las cuotas del cliente se descuenta de su ÚLTIMA cuota pendiente y, si no
// alcanza, de la anterior (regla de Cobranza). Nunca se aplica sobre cuotas que paga el banco.
export function aplicarAdelantos(cuotas: CuotaCalculada[]): void {
  let resto = r2(cuotas
    .filter(c => c.categoria === 'CLIENTE' && c.ejecutado - c.monto > TOLERANCIA)
    .reduce((s, c) => s + (c.ejecutado - c.monto), 0))
  if (resto <= 0) return
  const pendientes = cuotas
    .filter(c => c.categoria === 'CLIENTE' && c.saldo > 0)
    .sort((a, b) => (b.fechaVencimiento ?? '').localeCompare(a.fechaVencimiento ?? '') || b.numeroCuota - a.numeroCuota)
  for (const c of pendientes) {
    if (resto <= 0) break
    const usado = Math.min(c.saldo, resto)
    c.adelanto = r2(usado)
    c.saldo = r2(c.saldo - usado)
    if (c.saldo <= TOLERANCIA) c.saldo = 0
    resto = r2(resto - usado)
  }
}

// Datos personales de clientes: solo ADMIN (1), APROBADOR (9) y VISUALIZADOR (10) con sesión válida
async function requireRolIngreso(req: Request): Promise<boolean> {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const auth = req.headers.get('Authorization')
  if (!url || !key || !auth?.startsWith('Bearer ')) return false
  const admin = createClient(url, key)
  const { data: { user }, error } = await admin.auth.getUser(auth.slice(7))
  if (error || !user) return false
  const { data: rolRow } = await admin.from('usuario_rol').select('rol').eq('usuario', user.id).maybeSingle()
  return [1, 9, 10, 12].includes(rolRow?.rol as number)
}

export default async function handler(req: Request): Promise<Response> {
  if (!(await requireRolIngreso(req))) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

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
    // Diagnóstico informativo (no cambia lo que se muestra): qué trae realmente cada bien
    const diag = { contratosConVariosBienes: 0, contratosSinBienes: 0, bienesTotales: 0, bienesConTipo: 0, camposBien: new Set<string>() }

    let recibosSinMonto = 0

    for (const c of contratos) {
      ventasAcumuladas += c.precioTotal ?? 0
      const cliente = c.cliente ?? {}
      const bien = c.bienes?.find(b => b.isPrimary) ?? c.bienes?.[0]
      // TODOS los bienes del contrato (un contrato puede incluir departamento + estacionamiento)
      const bienes: BienSalida[] = (c.bienes ?? [])
        .map(b => ({ numero: String(b.numeroDeBien ?? '').trim(), tipo: tipoDelBien(b) }))
        .filter(b => b.numero || b.tipo)
      if ((c.bienes?.length ?? 0) > 1) diag.contratosConVariosBienes++
      if (!c.bienes?.length) diag.contratosSinBienes++
      for (const b of c.bienes ?? []) {
        diag.bienesTotales++
        if (tipoDelBien(b)) diag.bienesConTipo++
        Object.keys(b).forEach(k => diag.camposBien.add(k))
      }
      const clienteNombre = cliente.razonSocial
        || [cliente.nombre, cliente.apellido].filter(Boolean).join(' ')
        || null

      const delContrato = []
      for (const pago of c.pagos ?? []) {
        if (!pago.montoPago || pago.montoPago === 0) continue
        // "Cuota de ajuste" es un registro contable de Mobysuite, no deuda del cliente: no
        // forma parte del precio del contrato, así que sumarla infla la cartera. Se excluye
        // siempre, venga con monto o sin él (antes solo se descartaban las de monto 0).
        if (esCuotaDeAjuste(pago.descripcionPago)) continue

        const { abonos, sinMonto } = abonosDe(pago.reciboPago ?? [], pago.montoPago)
        if (sinMonto) recibosSinMonto++
        const ejecutado = r2(abonos.reduce((s, a) => s + a.monto, 0))
        const falta = r2(pago.montoPago - ejecutado)
        const fechasPago = abonos.map(a => a.fecha).filter((f): f is string => !!f).sort()

        delContrato.push({
          contratoId: c.id,
          contratoEstado: c.estadoContrato,
          clienteRut: cliente.rut ?? null,
          clienteNombre,
          clienteEmail: cliente.email ?? null,
          clienteTelefono: cliente.telefonoDos ?? cliente.telefonoUno ?? null,
          bienNumero: bien?.numeroDeBien ?? null,
          bienes,
          numeroCuota: pago.cuota,
          descripcion: pago.descripcionPago,
          categoria: categoria(pago.descripcionPago ?? ''),
          fechaVencimiento: toDate(pago.fechaVencimientoPago),
          fechaPago: fechasPago[fechasPago.length - 1] ?? null,
          monto: pago.montoPago,
          ejecutado,
          saldo: falta > TOLERANCIA ? falta : 0,
          adelanto: 0,
          abonos,
          estado: 'Pendiente' as 'Pagado' | 'Pendiente' | 'Vencido',
        })
      }

      aplicarAdelantos(delContrato)
      for (const q of delContrato) {
        q.estado = q.saldo === 0 ? 'Pagado' : (q.fechaVencimiento && q.fechaVencimiento < hoy ? 'Vencido' : 'Pendiente')
        cuotas.push(q)
      }
    }

    return Response.json({
      totalContratos: contratos.length,
      totalCuotas: cuotas.length,
      ventasAcumuladas,
      cuotas,
      recibosSinMonto,
      // Solo los NOMBRES de los campos del bien (no sus valores): sirve para saber qué datos manda
      // Mobysuite sobre cada bien sin exponer nada más de lo necesario.
      diagnostico: { ...diag, camposBien: [...diag.camposBien].sort() },
    })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Error desconocido' }, { status: 500 })
  }
}
