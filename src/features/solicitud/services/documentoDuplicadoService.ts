import { useEffect, useState } from 'react'
import { supabase } from '../../../api/supabase'

// Aviso de N° de documento (factura, boleta, ticket…) ya registrado en Solicitudes, Caja Chica, A Rendir o Reembolso.
// La comparación y la normalización (sin espacios, mayúsculas, sin ceros a la izquierda) viven en la función de BD
// buscar_documento_duplicado(); ignora registros Rechazados/Cancelados. Es solo un aviso, nunca bloquea guardar.

export type ModuloDoc = 'solicitud' | 'caja_chica' | 'arendir' | 'reembolso'

export interface DocumentoDuplicado {
  modulo: string          // 'Solicitud' | 'Caja Chica' | 'A Rendir' | 'Reembolso'
  registro_id: number
  codigo: string | null
  proveedor: string | null
  monto: number | null
  moneda: string | null
  estado: string | null
}

const SUFIJOS = new Set(['SAC', 'SA', 'SRL', 'EIRL', 'SCRL', 'SAA', 'SL', 'LTDA', 'CIA', 'PERU', 'DEL', 'DE', 'LA', 'LOS', 'LAS', 'Y', 'E', 'EL'])

function tokensProveedor(nombre: string): string[] {
  return nombre
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/).filter(t => t && !SUFIJOS.has(t))
}

/** ¿Es (probablemente) el mismo proveedor? Tolera mayúsculas, tildes, S.A.C./S.A. y nombres abreviados ("Sodimac" vs "SODIMAC PERU S.A."). */
export function mismoProveedor(a: string | null | undefined, b: string | null | undefined): boolean {
  const ta = tokensProveedor(a ?? ''), tb = tokensProveedor(b ?? '')
  if (!ta.length || !tb.length) return true      // sin nombre que comparar: se avisa igual (mejor un aviso de más que callar un duplicado)
  const [corto, largo] = ta.length <= tb.length ? [ta, tb] : [tb, ta]
  const enLargo = new Set(largo)
  const comunes = corto.filter(t => enLargo.has(t)).length
  return comunes / corto.length >= 0.6
}

/**
 * `modulo` y `excluirId` identifican el registro que se está editando (id de la solicitud, o id del gasto en los otros
 * módulos) para no avisarle de sí mismo. La función de BD necesita siempre valores concretos (con NULL descarta todo),
 * por eso sin id se manda -1. `proveedor` (opcional): solo avisa si el registro ya existente es del mismo proveedor.
 */
export async function buscarDocumentoDuplicado(numero: string, modulo: ModuloDoc, excluirId?: number | null, ignorarCodigo?: string | null, proveedor?: string | null): Promise<DocumentoDuplicado[]> {
  if (!numero.trim()) return []
  const { data, error } = await supabase.rpc('buscar_documento_duplicado', {
    p_numero: numero, p_modulo: modulo, p_excluir_id: excluirId ?? -1,
  })
  if (error) throw error
  // Varias líneas de un mismo registro pueden compartir el N° de documento (ej. una boleta con varios ítems): eso no es un duplicado
  return ((data ?? []) as DocumentoDuplicado[]).filter(d => !ignorarCodigo || d.codigo !== ignorarCodigo)
    // Otra razón social = otra factura aunque el número coincida: solo avisa si es el mismo proveedor
    .filter(d => !proveedor?.trim() || mismoProveedor(proveedor, d.proveedor))
}

export function textoDocumentoDuplicado(d: DocumentoDuplicado): string {
  const sym = d.moneda === 'USD' ? '$ ' : 'S/ '
  const partes = [`${d.modulo} ${d.codigo ?? ''}`.trim()]
  if (d.proveedor) partes.push(d.proveedor)
  if (d.monto != null) partes.push(`${sym}${Number(d.monto).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
  return partes.join(' — ')
}

/** Busca (con 500 ms de espera tras escribir) si el N° ya está registrado. `numero` vacío = no busca. */
export function useDocumentoDuplicado(numero: string, modulo: ModuloDoc, excluirId?: number | null, ignorarCodigo?: string | null, proveedor?: string | null): DocumentoDuplicado[] {
  const [duplicados, setDuplicados] = useState<DocumentoDuplicado[]>([])
  useEffect(() => {
    if (!numero.trim()) { setDuplicados([]); return }
    let vigente = true
    const timer = setTimeout(() => {
      buscarDocumentoDuplicado(numero, modulo, excluirId, ignorarCodigo, proveedor)
        .then(rows => { if (vigente) setDuplicados(rows) })
        .catch(() => { if (vigente) setDuplicados([]) })
    }, 500)
    return () => { vigente = false; clearTimeout(timer) }
  }, [numero, modulo, excluirId, ignorarCodigo, proveedor])
  return duplicados
}
