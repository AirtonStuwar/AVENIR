export type ModuloConciliable = 'solicitud' | 'solicitud_arendir' | 'solicitud_reembolso' | 'caja_chica' | 'devolucion_cliente'

export interface MovimientoBanco {
  fecha_oper: string | null   // YYYY-MM-DD
  fecha_valor: string | null
  descripcion: string
  n_operacion: string | null
  monto: number                // negativo = cargo (salida), positivo = abono (entrada)
  itf: number | null
  saldo_contable: number | null
}

export interface EstadoCuentaBBVA {
  empresa: string | null
  cuentaCci: string | null
  moneda: string | null
  saldoAnterior: number | null
  movimientos: MovimientoBanco[]
}

export interface RegistroPagable {
  modulo: ModuloConciliable
  id: number
  codigo: string | null
  beneficiario: string | null
  monto: number
  fecha_pago: string
}

export interface MatchGrupo {
  registro: RegistroPagable
}

export interface MovimientoConciliado {
  movimiento: MovimientoBanco
  estado: 'individual' | 'grupo' | 'sin_match'
  registros: RegistroPagable[]
}

export interface ResultadoConciliacion {
  conciliados: MovimientoConciliado[]        // estado individual o grupo
  sinMatchBanco: MovimientoConciliado[]      // movimientos del banco sin match
  sinMatchSistema: RegistroPagable[]         // registros pagados en AVENIR que no aparecen en el banco
}

export interface ConciliacionGuardada {
  id: number
  cuenta_bancaria_id: number
  fecha_desde: string
  fecha_hasta: string
  saldo_anterior: number | null
  saldo_final: number | null
  nombre_archivo: string | null
  usuario_id: string | null
  fecha_creacion: string
}
