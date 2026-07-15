export interface Proveedor {
  ruc:                 string
  razon_social:        string | null
  direccion:           string | null
  estado_sunat:        string | null
  fecha_creacion:      string | null
  fecha_actualizacion: string | null
}

export interface ProveedorConMetricas extends Proveedor {
  total_solicitudes:   number
  promedio_general:    number | null   // promedio de los 4 criterios
  promedio_calidad:    number | null
  promedio_tiempo:     number | null
  promedio_precio:     number | null
  promedio_comunicacion: number | null
  pct_recomendaria:    number | null   // 0–100
  total_encuestas:     number
  ultima_solicitud:    string | null
}

export interface Encuesta {
  id:             number
  solicitud_id:   number
  proveedor_ruc:  string | null
  usuario_id:     string | null
  calidad:        number | null
  tiempo:         number | null
  precio:         number | null
  comunicacion:   number | null
  recomendaria:   boolean | null
  comentarios:    string | null
  fecha_creacion: string | null
}

export type EncuestaInsert = Omit<Encuesta, 'id' | 'fecha_creacion'>
export type EncuestaUpdate = Partial<Omit<Encuesta, 'id' | 'solicitud_id' | 'fecha_creacion'>>

export interface ProveedorCuenta {
  id:                  number
  proveedor_ruc:       string
  banco:               string
  numero_cuenta:       string
  moneda:              'PEN' | 'USD'
  cuenta_detracciones: string | null
  descripcion:         string | null
  estado:              string
  fecha_creacion:      string | null
}

export type ProveedorCuentaInsert = Omit<ProveedorCuenta, 'id' | 'fecha_creacion'>
export type ProveedorCuentaUpdate = Partial<Omit<ProveedorCuenta, 'id' | 'proveedor_ruc' | 'fecha_creacion'>>
