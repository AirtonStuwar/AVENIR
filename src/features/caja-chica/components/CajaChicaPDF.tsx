import {
  Document, Page, View, Text, Image, StyleSheet, Font,
} from '@react-pdf/renderer'
import type { CajaChica, CajaChicaDetalle } from '../types/cajaChica'

function fmtDate(val: string | null | undefined): string {
  if (!val) return '—'
  try {
    const d = new Date(val.includes('T') ? val : val + 'T00:00:00')
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return val }
}

function fmtMoney(val: number | null | undefined): string {
  if (val == null) return 'S/ 0.00'
  return `S/ ${val.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
  headerGrid: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 10,
  },
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
  headerValue: {
    fontSize: 9,
    color: '#111827',
    fontFamily: 'Helvetica-Bold',
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#F0F4F8',
    borderRadius: 4,
    padding: 6,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 7,
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#003D7D',
  },
  table: { marginBottom: 0 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#003D7D',
  },
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
  tableRowTotal: {
    flexDirection: 'row',
    backgroundColor: '#003D7D',
  },
  th: {
    color: '#FFFFFF',
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    paddingVertical: 5,
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  td: {
    fontSize: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
    color: '#374151',
  },
  tdTotal: {
    fontSize: 8,
    paddingVertical: 5,
    paddingHorizontal: 4,
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
  },
  colFecha:     { width: '10%' },
  colArea:      { width: '10%' },
  colProveedor: { width: '18%' },
  colTipo:      { width: '9%' },
  colNumDoc:    { width: '11%' },
  colDetalle:   { width: '28%' },
  colMonto:     { width: '14%', textAlign: 'right' },
  saldoRow: {
    flexDirection: 'row',
    backgroundColor: '#E8F5E9',
    borderBottomWidth: 1,
    borderBottomColor: '#81C784',
  },
  firmaSection: {
    flexDirection: 'row',
    marginTop: 30,
    gap: 20,
  },
  firmaBox: {
    flex: 1,
    alignItems: 'center',
  },
  firmaImg: {
    width: 120,
    height: 50,
    objectFit: 'contain',
    marginBottom: 4,
  },
  firmaLine: {
    borderTopWidth: 1,
    borderTopColor: '#374151',
    width: '100%',
    marginBottom: 4,
  },
  firmaLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    textAlign: 'center',
  },
  firmaNombre: {
    fontSize: 7,
    color: '#6B7280',
    textAlign: 'center',
  },
})

interface CajaChicaPDFProps {
  cajaChica: CajaChica
  detalles: CajaChicaDetalle[]
  logoSrc?: string | null
  firmaUsuarioSrc?: string | null
  firmaAprobadorSrc?: string | null
}

export function CajaChicaPDF({ cajaChica, detalles, logoSrc, firmaUsuarioSrc, firmaAprobadorSrc }: CajaChicaPDFProps) {
  const totalGastos = detalles.reduce((acc, d) => acc + d.monto, 0)
  const saldoActual = cajaChica.monto_asignado - totalGastos

  return (
    <Document>
      <Page size="A4" style={s.page} orientation="landscape">

        {/* Title bar */}
        <View style={s.titleBar}>
          <Text style={s.titleText}>RENDICIÓN DE CAJA CHICA</Text>
          {logoSrc && <Image style={s.logo} src={logoSrc} />}
        </View>

        {/* Header info */}
        <View style={s.headerGrid}>
          <View style={s.headerCard}>
            <Text style={s.headerLabel}>Código</Text>
            <Text style={s.headerValue}>{cajaChica.codigo ?? '—'}</Text>
          </View>
          <View style={[s.headerCard, { flex: 2 }]}>
            <Text style={s.headerLabel}>Responsable</Text>
            <Text style={s.headerValue}>{cajaChica.responsable_nombre ?? '—'}</Text>
          </View>
          <View style={[s.headerCard, { flex: 2 }]}>
            <Text style={s.headerLabel}>Empresa</Text>
            <Text style={s.headerValue}>{cajaChica.proyecto?.nombre ?? '—'}</Text>
          </View>
          <View style={s.headerCard}>
            <Text style={s.headerLabel}>Período</Text>
            <Text style={s.headerValue}>{fmtDate(cajaChica.periodo_desde)} - {fmtDate(cajaChica.periodo_hasta)}</Text>
          </View>
          <View style={s.headerCard}>
            <Text style={s.headerLabel}>Cuenta BBVA</Text>
            <Text style={s.headerValue}>{cajaChica.cuenta_bbva ?? '—'}</Text>
          </View>
        </View>

        {/* Financial summary */}
        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Saldo anterior</Text>
            <Text style={s.summaryValue}>{fmtMoney(cajaChica.saldo_anterior)}</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Transferencia</Text>
            <Text style={s.summaryValue}>{fmtMoney(cajaChica.transferencia)}</Text>
          </View>
          <View style={[s.summaryCard, { backgroundColor: '#E3F2FD' }]}>
            <Text style={s.summaryLabel}>Monto asignado</Text>
            <Text style={s.summaryValue}>{fmtMoney(cajaChica.monto_asignado)}</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Saldo actual</Text>
            <Text style={[s.summaryValue, { color: saldoActual >= 0 ? '#059669' : '#DC2626' }]}>
              {fmtMoney(saldoActual)}
            </Text>
          </View>
          <View style={[s.summaryCard, { backgroundColor: '#FFF8E1' }]}>
            <Text style={s.summaryLabel}>Pendiente a reembolsar</Text>
            <Text style={[s.summaryValue, { color: '#D97706' }]}>{fmtMoney(totalGastos)}</Text>
          </View>
        </View>

        {/* Detail table */}
        <View style={s.table}>
          <View style={s.tableHeader}>
            <Text style={[s.th, s.colFecha]}>FECHA</Text>
            <Text style={[s.th, s.colArea]}>CÓD. COSTOS</Text>
            <Text style={[s.th, s.colProveedor]}>PROVEEDOR / USUARIO</Text>
            <Text style={[s.th, s.colTipo]}>TIPO DOC</Text>
            <Text style={[s.th, s.colNumDoc]}>N° DOC</Text>
            <Text style={[s.th, s.colDetalle]}>DETALLE</Text>
            <Text style={[s.th, s.colMonto]}>S/.</Text>
          </View>
          {detalles.map((d, i) => (
            <View key={d.id} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={[s.td, s.colFecha]}>{fmtDate(d.fecha)}</Text>
              <Text style={[s.td, s.colArea]}>{d.area_nombre ?? '—'}</Text>
              <Text style={[s.td, s.colProveedor]}>{d.proveedor}</Text>
              <Text style={[s.td, s.colTipo]}>{d.tipo_documento}</Text>
              <Text style={[s.td, s.colNumDoc]}>{d.numero_documento ?? '—'}</Text>
              <Text style={[s.td, s.colDetalle]}>{d.detalle}</Text>
              <Text style={[s.td, s.colMonto]}>{d.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</Text>
            </View>
          ))}

          {/* Total row */}
          <View style={s.tableRowTotal}>
            <Text style={[s.tdTotal, { width: '86%', textAlign: 'right' }]}>TOTAL GASTOS:</Text>
            <Text style={[s.tdTotal, s.colMonto]}>{fmtMoney(totalGastos)}</Text>
          </View>

          {/* Saldo row */}
          <View style={s.saldoRow}>
            <Text style={[s.td, { width: '86%', textAlign: 'right', fontFamily: 'Helvetica-Bold', color: '#2E7D32' }]}>
              SALDO ACTUAL:
            </Text>
            <Text style={[s.td, s.colMonto, { fontFamily: 'Helvetica-Bold', color: '#2E7D32' }]}>
              {fmtMoney(saldoActual)}
            </Text>
          </View>
        </View>

        {/* Signatures */}
        <View style={s.firmaSection}>
          <View style={s.firmaBox}>
            {firmaUsuarioSrc && <Image style={s.firmaImg} src={firmaUsuarioSrc} />}
            <View style={s.firmaLine} />
            <Text style={s.firmaLabel}>Responsable</Text>
            <Text style={s.firmaNombre}>{cajaChica.responsable_nombre ?? ''}</Text>
          </View>
          <View style={s.firmaBox}>
            {firmaAprobadorSrc && <Image style={s.firmaImg} src={firmaAprobadorSrc} />}
            <View style={s.firmaLine} />
            <Text style={s.firmaLabel}>Aprobado por</Text>
            <Text style={s.firmaNombre}>{cajaChica.aprobador_nombre ?? ''}</Text>
          </View>
        </View>

      </Page>
    </Document>
  )
}
