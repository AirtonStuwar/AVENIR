import {
  Document, Page, View, Text, Image, StyleSheet, Font,
} from '@react-pdf/renderer'
import type { SolicitudReembolso, ReembolsoDetalle } from '../types/reembolso'

function fmtDate(val: string | null | undefined): string {
  if (!val) return '—'
  try {
    const d = new Date(val.includes('T') ? val : val + 'T00:00:00')
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return val
  }
}

function fmtMoney(val: number | null | undefined, moneda = 'PEN'): string {
  if (val == null) return moneda === 'USD' ? '$ 0.00' : 'S/ 0.00'
  const sym = moneda === 'USD' ? '$ ' : 'S/ '
  const loc = moneda === 'USD' ? 'en-US' : 'es-PE'
  return `${sym}${val.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

Font.register({ family: 'Helvetica', fonts: [] })

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1a1a1a',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 30,
    paddingVertical: 24,
  },
  titleBar: {
    backgroundColor: '#003D7D',
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
  },
  logo: { width: 70, height: 28, objectFit: 'contain' },
  headerGrid: { flexDirection: 'row', marginBottom: 12, gap: 10 },
  headerCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    padding: 6,
  },
  headerLabel: {
    fontSize: 7,
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 2,
    fontFamily: 'Helvetica-Bold',
  },
  headerValue: { fontSize: 9, color: '#111827', fontFamily: 'Helvetica-Bold' },
  table: { marginBottom: 0 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#003D7D' },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableRowAlt: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableRowTotal: { flexDirection: 'row', backgroundColor: '#003D7D' },
  th: {
    color: '#FFFFFF',
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    paddingVertical: 5,
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  td: { fontSize: 8, paddingVertical: 4, paddingHorizontal: 4, color: '#374151' },
  tdTotal: {
    fontSize: 8,
    paddingVertical: 5,
    paddingHorizontal: 4,
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
  },
  colFecha:     { width: '10%' },
  colProveedor: { width: '20%' },
  colTipo:      { width: '10%' },
  colNumDoc:    { width: '12%' },
  colConcepto:  { width: '33%' },
  colImporte:   { width: '15%', textAlign: 'right' },
  firmaSection: { flexDirection: 'row', marginTop: 30, gap: 20 },
  firmaBox:     { flex: 1, alignItems: 'center' },
  firmaImg:     { width: 120, height: 50, objectFit: 'contain', marginBottom: 4 },
  firmaLine:    { borderTopWidth: 1, borderTopColor: '#374151', width: '100%', marginBottom: 4 },
  firmaLabel:   { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#374151', textAlign: 'center' },
  firmaNombre:  { fontSize: 7, color: '#6B7280', textAlign: 'center' },
})

interface ReembolsoPDFProps {
  solicitud: SolicitudReembolso
  detalles: ReembolsoDetalle[]
  logoSrc?: string | null
  firmaUsuarioSrc?: string | null
  firmaAprobadorSrc?: string | null
}

export function ReembolsoPDF({ solicitud, detalles, logoSrc, firmaUsuarioSrc, firmaAprobadorSrc }: ReembolsoPDFProps) {
  const total = detalles.reduce((acc, d) => acc + (d.importe ?? 0), 0)

  return (
    <Document>
      <Page size="A4" style={s.page} orientation="landscape">

        {/* Title bar */}
        <View style={s.titleBar}>
          <Text style={s.titleText}>REEMBOLSO DE GASTOS</Text>
          {logoSrc && <Image style={s.logo} src={logoSrc} />}
        </View>

        {/* Header info */}
        <View style={s.headerGrid}>
          <View style={s.headerCard}>
            <Text style={s.headerLabel}>Código</Text>
            <Text style={s.headerValue}>{solicitud.codigo ?? '—'}</Text>
          </View>
          <View style={[s.headerCard, { flex: 2 }]}>
            <Text style={s.headerLabel}>Beneficiario</Text>
            <Text style={s.headerValue}>{solicitud.beneficiario_nombre ?? '—'}</Text>
          </View>
          <View style={s.headerCard}>
            <Text style={s.headerLabel}>DNI</Text>
            <Text style={s.headerValue}>{solicitud.beneficiario_dni ?? '—'}</Text>
          </View>
          <View style={s.headerCard}>
            <Text style={s.headerLabel}>Cargo</Text>
            <Text style={s.headerValue}>{solicitud.beneficiario_cargo ?? '—'}</Text>
          </View>
          <View style={s.headerCard}>
            <Text style={s.headerLabel}>Proyecto</Text>
            <Text style={s.headerValue}>{solicitud.proyecto?.nombre ?? '—'}</Text>
          </View>
          <View style={s.headerCard}>
            <Text style={s.headerLabel}>Fecha Requerida</Text>
            <Text style={s.headerValue}>{fmtDate(solicitud.fecha_requerida)}</Text>
          </View>
        </View>

        {/* Table */}
        <View style={s.table}>
          <View style={s.tableHeader}>
            <Text style={[s.th, s.colFecha]}>FECHA DOC.</Text>
            <Text style={[s.th, s.colProveedor]}>PROVEEDOR</Text>
            <Text style={[s.th, s.colTipo]}>TIPO DOC.</Text>
            <Text style={[s.th, s.colNumDoc]}>N° DOC.</Text>
            <Text style={[s.th, s.colConcepto]}>CONCEPTO</Text>
            <Text style={[s.th, s.colImporte]}>{solicitud.moneda === 'USD' ? '$' : 'S/'}</Text>
          </View>

          {detalles.map((d, idx) => (
            <View key={d.id} style={idx % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={[s.td, s.colFecha]}>{fmtDate(d.fecha_documento)}</Text>
              <Text style={[s.td, s.colProveedor]}>{d.proveedor ?? '—'}</Text>
              <Text style={[s.td, s.colTipo]}>{d.tipo_documento ?? '—'}</Text>
              <Text style={[s.td, s.colNumDoc]}>{d.numero_documento ?? '—'}</Text>
              <Text style={[s.td, s.colConcepto]}>{d.concepto ?? '—'}</Text>
              <Text style={[s.td, s.colImporte]}>{fmtMoney(d.importe, solicitud.moneda)}</Text>
            </View>
          ))}

          {detalles.length === 0 && (
            <View style={s.tableRow}>
              <Text style={[s.td, { flex: 1, color: '#9CA3AF', textAlign: 'center' }]}>
                Sin detalles registrados
              </Text>
            </View>
          )}

          <View style={s.tableRowTotal}>
            <Text style={[s.tdTotal, { flex: 1 }]}>TOTAL A REEMBOLSAR</Text>
            <Text style={[s.tdTotal, s.colImporte]}>{fmtMoney(total, solicitud.moneda)}</Text>
          </View>
        </View>

        {/* Firmas */}
        <View style={s.firmaSection}>
          <View style={s.firmaBox}>
            {firmaUsuarioSrc
              ? <Image style={s.firmaImg} src={firmaUsuarioSrc} />
              : <View style={{ height: 54 }} />
            }
            <View style={s.firmaLine} />
            <Text style={s.firmaLabel}>PRESENTADO POR</Text>
            <Text style={s.firmaNombre}>{solicitud.beneficiario_nombre ?? '—'}</Text>
            <Text style={s.firmaNombre}>DNI: {solicitud.beneficiario_dni ?? '—'}</Text>
          </View>

          <View style={s.firmaBox}>
            {firmaAprobadorSrc
              ? <Image style={s.firmaImg} src={firmaAprobadorSrc} />
              : <View style={{ height: 54 }} />
            }
            <View style={s.firmaLine} />
            <Text style={s.firmaLabel}>AUTORIZADO POR</Text>
            <Text style={s.firmaNombre}>{solicitud.aprobador_nombre ?? '—'}</Text>
          </View>
        </View>

      </Page>
    </Document>
  )
}
