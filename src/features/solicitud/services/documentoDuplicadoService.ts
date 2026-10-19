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

/**
 * `modulo` y `excluirId` identifican el registro que se está editando (id de la solicitud, o id del gasto en los otros
 * módulos) para no avisarle de sí mismo. La función de BD necesita siempre valores concretos (con NULL descarta todo),
 * por eso sin id se manda -1.
 */
export async function buscarDocumentoDuplicado(numero: string, modulo: ModuloDoc, excluirId?: number | null, ignorarCodigo?: string | null): Promise<DocumentoDuplicado[]> {
  if (!numero.trim()) return []
  const { data, error } = await supabase.rpc('buscar_documento_duplicado', {
    p_numero: numero, p_modulo: modulo, p_excluir_id: excluirId ?? -1,
  })
  if (error) throw error
  // Varias líneas de un mismo registro pueden compartir el N° de documento (ej. una boleta con varios ítems): eso no es un duplicado
  return ((data ?? []) as DocumentoDuplicado[]).filter(d => !ignorarCodigo || d.codigo !== ignorarCodigo)
}

export function textoDocumentoDuplicado(d: DocumentoDuplicado): string {
  const sym = d.moneda === 'USD' ? '$ ' : 'S/ '
  const partes = [`${d.modulo} ${d.codigo ?? ''}`.trim()]
  if (d.proveedor) partes.push(d.proveedor)
  if (d.monto != null) partes.push(`${sym}${Number(d.monto).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
  return partes.join(' — ')
}

/** Busca (con 500 ms de espera tras escribir) si el N° ya está registrado. `numero` vacío = no busca. */
export function useDocumentoDuplicado(numero: string, modulo: ModuloDoc, excluirId?: number | null, ignorarCodigo?: string | null): DocumentoDuplicado[] {
  const [duplicados, setDuplicados] = useState<DocumentoDuplicado[]>([])
  useEffect(() => {
    if (!numero.trim()) { setDuplicados([]); return }
    let vigente = true
    const timer = setTimeout(() => {
      buscarDocumentoDuplicado(numero, modulo, excluirId, ignorarCodigo)
        .then(rows => { if (vigente) setDuplicados(rows) })
        .catch(() => { if (vigente) setDuplicados([]) })
    }, 500)
    return () => { vigente = false; clearTimeout(timer) }
  }, [numero, modulo, excluirId, ignorarCodigo])
  return duplicados
}
