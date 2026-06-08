import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { Solicitud, SolicitudDetalle } from '../types/solicitud'

// ── Types ────────────────────────────────────────────────────────
export interface OrdenCompraPDFProps {
  solicitud:             Solicitud
  detalles:              SolicitudDetalle[]
  logoSrc?:              string | null
  firmaUsuarioSrc?:      string | null
  firmaAprobadorSrc?:    string | null
  aprobadorNombre?:      string | null
  aprobadorEmail?:       string | null
  aprobadorCargo?:       string | null
}

// ── Helpers ──────────────────────────────────────────────────────
function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'short' }).format(new Date(d + 'T00:00:00'))
}

function fmtMoney(n: number, moneda: 'PEN' | 'USD' = 'PEN') {
  const sym = moneda === 'USD' ? '$ ' : 'S/ '
  return sym + n.toLocaleString(moneda === 'USD' ? 'en-US' : 'es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pct(v: number | null | undefined) {
  if (v == null) return '—'
  return `${v}%`
}

// ── Palette ──────────────────────────────────────────────────────
const BLUE        = '#003D7D'
const BLUE_LIGHT  = '#e8f0fa'
const GRAY_BG     = '#f9fafb'
const GRAY_BORDER = '#d1d5db'
const GRAY_TEXT   = '#6b7280'
const WHITE       = '#ffffff'

// ── Styles ───────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily:      'Helvetica',
    fontSize:        8,
    color:           '#111827',
    padding:         28,
    backgroundColor: WHITE,
  },

  // ── Header ──────────────────────────────────────────────────
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: WHITE,
    borderBottomWidth: 2,
    borderBottomColor: BLUE,
    borderBottomStyle: 'solid',
    paddingBottom:   10,
    marginBottom:    10,
  },
  logo: {
    width:     70,
    height:    28,
    objectFit: 'contain',
  },
  logoPlaceholder: {
    width:  70,
    height: 28,
  },
  headerCenter: {
    flex:       1,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily:    'Helvetica-Bold',
    fontSize:      13,
    color:         BLUE,
    letterSpacing: 0.5,
  },
  headerSub: {
    fontFamily: 'Helvetica',
    fontSize:   7,
    color:      GRAY_TEXT,
    marginTop:  2,
  },
  headerRight: {
    width:      90,
    alignItems: 'flex-end',
    gap:        3,
  },
  headerRightLabel: {
    fontFamily: 'Helvetica-Bold',
    color:      BLUE,
    fontSize:   8,
  },
  headerRightVal: {
    color:    GRAY_TEXT,
    fontSize: 7,
    marginTop: 1,
  },

  // ── Facturar A ───────────────────────────────────────────────
  facturarA: {
    backgroundColor:  BLUE_LIGHT,
    borderRadius:     4,
    padding:          8,
    marginBottom:     8,
    borderWidth:      1,
    borderColor:      '#bfdbfe',
    borderStyle:      'solid',
  },
  facturarATitle: {
    fontFamily: 'Helvetica-Bold',
    color:      BLUE,
    fontSize:   7,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  facturarARow: {
    flexDirection: 'row',
    gap:           16,
  },
  facturarAText: {
    fontSize: 8,
    color:    '#1e3a5f',
  },
  facturarABold: {
    fontFamily: 'Helvetica-Bold',
    fontSize:   9,
    color:      BLUE,
  },

  // ── Two-column sections ──────────────────────────────────────
  row2: {
    flexDirection: 'row',
    gap:           6,
    marginBottom:  6,
  },
  card: {
    flex:        1,
    borderWidth: 1,
    borderColor: GRAY_BORDER,
    borderStyle: 'solid',
    borderRadius: 4,
    overflow:    'hidden',
  },
  cardHeader: {
    backgroundColor:  BLUE,
    paddingHorizontal: 8,
    paddingVertical:   4,
  },
  cardHeaderText: {
    fontFamily: 'Helvetica-Bold',
    color:      WHITE,
    fontSize:   7,
    textTransform: 'uppercase',
  },
  cardBody: {
    padding: 8,
    gap:     4,
  },
  fieldRow: {
    flexDirection: 'row',
    gap:           4,
  },
  fieldLabel: {
    fontFamily: 'Helvetica-Bold',
    color:      GRAY_TEXT,
    fontSize:   7,
    width:      70,
  },
  fieldValue: {
    flex:     1,
    fontSize: 7,
    color:    '#111827',
  },

  // ── Condiciones ──────────────────────────────────────────────
  condCard: {
    borderWidth:  1,
    borderColor:  GRAY_BORDER,
    borderStyle:  'solid',
    borderRadius: 4,
    overflow:     'hidden',
    marginBottom: 6,
  },

  // ── Items table ──────────────────────────────────────────────
  tableWrap: {
    borderWidth:  1,
    borderColor:  GRAY_BORDER,
    borderStyle:  'solid',
    borderRadius: 4,
    overflow:     'hidden',
    marginBottom: 6,
  },
  tableHead: {
    flexDirection:    'row',
    backgroundColor:  BLUE,
    paddingVertical:  5,
    paddingHorizontal: 4,
  },
  tableHeadCell: {
    fontFamily:    'Helvetica-Bold',
    color:         WHITE,
    fontSize:      7,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: GRAY_BORDER,
    borderTopStyle: 'solid',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tableRowAlt: {
    backgroundColor: GRAY_BG,
  },
  tableCell: {
    fontSize: 7.5,
    color:    '#374151',
  },
  tableCellBold: {
    fontFamily: 'Helvetica-Bold',
    color:      BLUE,
  },

  // col widths
  colIdx:   { width: 22 },
  colDesc:  { flex: 1 },
  colCant:  { width: 36, textAlign: 'right' },
  colUnit:  { width: 64, textAlign: 'right' },
  colTotal: { width: 64, textAlign: 'right' },

  // ── Totals ───────────────────────────────────────────────────
  totalsWrap: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  totalsInner: {
    width:        200,
    borderWidth:  1,
    borderColor:  GRAY_BORDER,
    borderStyle:  'solid',
    borderRadius: 4,
    overflow:     'hidden',
  },
  totalRow: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderTopWidth:    1,
    borderTopColor:    GRAY_BORDER,
    borderTopStyle:    'solid',
  },
  totalRowFirst: {
    borderTopWidth: 0,
  },
  totalLabel: {
    fontSize: 7,
    color:    GRAY_TEXT,
  },
  totalValue: {
    fontSize: 7,
    color:    '#374151',
  },
  totalFinal: {
    backgroundColor: BLUE,
    paddingHorizontal: 8,
    paddingVertical:   5,
    flexDirection:     'row',
    justifyContent:    'space-between',
  },
  totalFinalText: {
    fontFamily: 'Helvetica-Bold',
    color:      WHITE,
    fontSize:   9,
  },

  // ── Signatures ───────────────────────────────────────────────
  sigWrap: {
    flexDirection: 'row',
    gap:           12,
    marginTop:     4,
  },
  sigBox: {
    flex:         1,
    borderWidth:  1,
    borderColor:  GRAY_BORDER,
    borderStyle:  'solid',
    borderRadius: 4,
    overflow:     'hidden',
    alignItems:   'center',
    padding:      8,
    gap:          4,
  },
  sigTitle: {
    fontFamily: 'Helvetica-Bold',
    color:      BLUE,
    fontSize:   7,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sigImg: {
    width:  120,
    height: 50,
    objectFit: 'contain',
  },
  sigImgPlaceholder: {
    width:       120,
    height:      50,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    borderRadius: 2,
  },
  sigLine: {
    borderTopWidth:  1,
    borderTopColor:  '#9ca3af',
    borderTopStyle:  'solid',
    width:           '100%',
    marginVertical:  4,
  },
  sigEmail: {
    fontSize: 7,
    color:    GRAY_TEXT,
    textAlign: 'center',
  },

  // ── Footer ───────────────────────────────────────────────────
  footer: {
    position:  'absolute',
    bottom:    16,
    left:      28,
    right:     28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: GRAY_BORDER,
    borderTopStyle: 'solid',
    paddingTop: 4,
  },
  footerText: {
    fontSize: 6,
    color:    '#9ca3af',
  },
})

// ── Field helper ─────────────────────────────────────────────────
function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <View style={S.fieldRow}>
      <Text style={S.fieldLabel}>{label}:</Text>
      <Text style={S.fieldValue}>{value ?? '—'}</Text>
    </View>
  )
}

// ── Card helper ──────────────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={S.card}>
      <View style={S.cardHeader}><Text style={S.cardHeaderText}>{title}</Text></View>
      <View style={S.cardBody}>{children}</View>
    </View>
  )
}

// ── Main component ───────────────────────────────────────────────
export function OrdenCompraPDF({
  solicitud,
  detalles,
  logoSrc,
  firmaUsuarioSrc,
  firmaAprobadorSrc,
  aprobadorNombre,
  aprobadorEmail,
  aprobadorCargo,
}: OrdenCompraPDFProps) {
  const moneda      = (solicitud.moneda as 'PEN' | 'USD') ?? 'PEN'
  const subtotal    = detalles.reduce((s, d) => s + (d.valor_total ?? d.cantidad * d.valor_unitario), 0)
  const descuento   = 0
  const baseGravable = subtotal - descuento
  const igv         = baseGravable * 0.18
  const total       = baseGravable + igv

  const proyecto    = solicitud.proyecto
  const hoy         = new Intl.DateTimeFormat('es-PE', { dateStyle: 'short' }).format(new Date())

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* ── HEADER ── */}
        <View style={S.header}>
          {logoSrc
            ? <Image src={logoSrc} style={S.logo} />
            : <View style={S.logoPlaceholder} />
          }
          <View style={S.headerCenter}>
            <Text style={S.headerTitle}>ORDEN DE COMPRA O SERVICIO</Text>
            <Text style={S.headerSub}>Documento de solicitud de adquisición</Text>
          </View>
          <View style={S.headerRight}>
            <Text style={S.headerRightLabel}>N° {solicitud.codigo ?? `#${solicitud.id}`}</Text>
            <Text style={S.headerRightVal}>Emisión: {hoy}</Text>
            {solicitud.fecha_pedido && (
              <Text style={S.headerRightVal}>Pedido: {fmtDate(solicitud.fecha_pedido)}</Text>
            )}
            {solicitud.fecha_requerida && (
              <Text style={S.headerRightVal}>Requerido: {fmtDate(solicitud.fecha_requerida)}</Text>
            )}
          </View>
        </View>

        {/* ── FACTURAR A ── */}
        {proyecto && (
          <View style={S.facturarA}>
            <Text style={S.facturarATitle}>Facturar a</Text>
            <Text style={S.facturarABold}>{proyecto.nombre ?? '—'}</Text>
            <View style={S.facturarARow}>
              <Text style={S.facturarAText}>RUC: {proyecto.ruc ?? '—'}</Text>
              <Text style={S.facturarAText}>Dirección: {proyecto.direccion ?? '—'}</Text>
            </View>
          </View>
        )}

        {/* ── PROVEEDOR + CONTACTO ── */}
        <View style={S.row2}>
          <Card title="Datos del Proveedor">
            <Field label="Razón Social" value={solicitud.razon_social} />
            <Field label="RUC"          value={solicitud.ruc} />
            <Field label="Dirección"    value={solicitud.direccion} />
          </Card>
          <Card title="Contacto">
            <Field label="Nombre"   value={solicitud.contacto_nombre} />
            <Field label="Teléfono" value={solicitud.contacto_telefono} />
            <Field label="Correo"   value={solicitud.contacto_correo} />
          </Card>
        </View>

        {/* ── BANCARIO + PORCENTAJES ── */}
        <View style={S.row2}>
          <Card title="Datos Bancarios">
            <Field label="Banco"         value={solicitud.banco} />
            <Field label="N° Cta / CCI"  value={solicitud.numero_cuenta} />
            <Field label="Detracciones"  value={solicitud.cuenta_detracciones} />
          </Card>
          <Card title="Condiciones Comerciales">
            <Field label="Forma de Pago" value={solicitud.solicitud_forma_pago?.nombre ?? solicitud.forma_pago} />
            <Field label="% Contrato"    value={pct(solicitud.porcentaje_contrato)} />
            <Field label="% Acumulado"   value={pct(solicitud.porcentaje_acumulado_contrato)} />
            <Field label="% Pendiente"   value={pct(solicitud.porcentaje_pendiente_contrato)} />
          </Card>
        </View>

        {/* ── CONDICIONES ── */}
        {solicitud.condiciones && (
          <View style={[S.condCard, { marginBottom: 6 }]}>
            <View style={S.cardHeader}><Text style={S.cardHeaderText}>Condiciones</Text></View>
            <View style={{ padding: 8 }}>
              <Text style={{ fontSize: 7, color: '#374151' }}>{solicitud.condiciones}</Text>
            </View>
          </View>
        )}

        {/* ── ITEMS TABLE ── */}
        <View style={S.tableWrap}>
          {/* Head */}
          <View style={S.tableHead}>
            <Text style={[S.tableHeadCell, S.colIdx]}>#</Text>
            <Text style={[S.tableHeadCell, S.colDesc]}>Descripción</Text>
            <Text style={[S.tableHeadCell, S.colCant]}>Cant.</Text>
            <Text style={[S.tableHeadCell, S.colUnit]}>V. Unit.</Text>
            <Text style={[S.tableHeadCell, S.colTotal]}>Total</Text>
          </View>
          {/* Rows */}
          {detalles.map((d, i) => (
            <View key={d.id} style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}>
              <Text style={[S.tableCell, S.colIdx]}>{i + 1}</Text>
              <Text style={[S.tableCell, S.colDesc]}>{d.descripcion}</Text>
              <Text style={[S.tableCell, S.colCant]}>{d.cantidad}</Text>
              <Text style={[S.tableCell, S.colUnit]}>{fmtMoney(d.valor_unitario, moneda)}</Text>
              <Text style={[S.tableCell, S.colTotal, S.tableCellBold]}>
                {fmtMoney(d.valor_total ?? d.cantidad * d.valor_unitario, moneda)}
              </Text>
            </View>
          ))}
          {detalles.length === 0 && (
            <View style={S.tableRow}>
              <Text style={[S.tableCell, { flex: 1, textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }]}>
                Sin ítems registrados
              </Text>
            </View>
          )}
        </View>

        {/* ── TOTALS ── */}
        <View style={S.totalsWrap}>
          <View style={S.totalsInner}>
            <View style={[S.totalRow, S.totalRowFirst]}>
              <Text style={S.totalLabel}>Subtotal</Text>
              <Text style={S.totalValue}>{fmtMoney(subtotal, moneda)}</Text>
            </View>
            <View style={S.totalRow}>
              <Text style={S.totalLabel}>Descuento</Text>
              <Text style={S.totalValue}>{fmtMoney(descuento, moneda)}</Text>
            </View>
            <View style={S.totalRow}>
              <Text style={S.totalLabel}>Base Gravable</Text>
              <Text style={S.totalValue}>{fmtMoney(baseGravable, moneda)}</Text>
            </View>
            <View style={S.totalRow}>
              <Text style={S.totalLabel}>IGV (18%)</Text>
              <Text style={S.totalValue}>{fmtMoney(igv, moneda)}</Text>
            </View>
            <View style={S.totalFinal}>
              <Text style={S.totalFinalText}>TOTAL</Text>
              <Text style={S.totalFinalText}>{fmtMoney(total, moneda)}</Text>
            </View>
          </View>
        </View>

        {/* ── FIRMAS ── */}
        <View style={S.sigWrap}>
          {/* Solicitado por */}
          <View style={S.sigBox}>
            <Text style={S.sigTitle}>Solicitado por</Text>
            {firmaUsuarioSrc
              ? <Image src={firmaUsuarioSrc} style={S.sigImg} />
              : <View style={S.sigImgPlaceholder} />
            }
            <View style={S.sigLine} />
            {solicitud.creador_nombre && (
              <Text style={[S.sigEmail, { fontFamily: 'Helvetica-Bold', color: '#374151' }]}>
                {solicitud.creador_nombre}
              </Text>
            )}
            <Text style={S.sigEmail}>{solicitud.creador_email ?? '—'}</Text>
            {solicitud.creador_cargo && (
              <Text style={[S.sigEmail, { fontStyle: 'italic' }]}>{solicitud.creador_cargo}</Text>
            )}
          </View>

          {/* Aprobado por */}
          <View style={S.sigBox}>
            <Text style={S.sigTitle}>Aprobado por</Text>
            {firmaAprobadorSrc
              ? <Image src={firmaAprobadorSrc} style={S.sigImg} />
              : <View style={S.sigImgPlaceholder} />
            }
            <View style={S.sigLine} />
            {aprobadorNombre && (
              <Text style={[S.sigEmail, { fontFamily: 'Helvetica-Bold', color: '#374151' }]}>
                {aprobadorNombre}
              </Text>
            )}
            <Text style={S.sigEmail}>{aprobadorEmail ?? solicitud.usuario_aprobador ?? '—'}</Text>
            {aprobadorCargo && (
              <Text style={[S.sigEmail, { fontStyle: 'italic' }]}>{aprobadorCargo}</Text>
            )}
          </View>
        </View>

        {/* ── FOOTER ── */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>AVENIR — Documento generado el {hoy}</Text>
          <Text style={S.footerText} render={({ pageNumber, totalPages }) => `Pág. ${pageNumber} / ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}
