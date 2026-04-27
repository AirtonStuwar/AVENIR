import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { CheckCircle, Eye, FileText, Trash2, Upload } from 'lucide-react'
import {
  deleteArchivoSolicitud,
  getArchivosBySolicitud,
  getArchivoUrl,
  uploadArchivoSolicitud,
} from '../services/solicitudService'
import type { SolicitudArchivo } from '../types/solicitud'

const TIPOS = ['Contrato', 'Cotizacion', 'Cuadro Comparativo', 'Sustento'] as const

interface Props {
  solicitudId: number
  editable: boolean
  onChange?: (archivos: SolicitudArchivo[]) => void
}

export default function SolicitudArchivos({ solicitudId, editable, onChange }: Props) {
  const [archivos,  setArchivos]  = useState<SolicitudArchivo[]>([])
  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const refs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => { loadArchivos() }, [solicitudId])

  const loadArchivos = async () => {
    setLoading(true)
    try {
      const data = await getArchivosBySolicitud(solicitudId)
      setArchivos(data)
      onChange?.(data)
    } catch {
      toast.error('Error al cargar documentos')
    } finally {
      setLoading(false)
    }
  }

  const byTipo = (tipo: string) => archivos.find(a => a.tipo_archivo === tipo) ?? null

  const handleUpload = async (tipo: string, file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Solo se permiten archivos PDF')
      return
    }
    const existing = byTipo(tipo)
    setUploading(tipo)
    try {
      if (existing) {
        await deleteArchivoSolicitud(existing.id, existing.archivo_path!)
      }
      const nuevo = await uploadArchivoSolicitud(file, solicitudId, tipo)
      const next  = [...archivos.filter(a => a.tipo_archivo !== tipo), nuevo]
      setArchivos(next)
      onChange?.(next)
      toast.success(`${tipo} subido`)
    } catch (err: any) {
      toast.error(err?.message ?? 'Error al subir archivo')
    } finally {
      setUploading(null)
    }
  }

  const handleDelete = async (archivo: SolicitudArchivo) => {
    if (!confirm(`¿Eliminar ${archivo.tipo_archivo}?`)) return
    try {
      await deleteArchivoSolicitud(archivo.id, archivo.archivo_path!)
      const next = archivos.filter(a => a.id !== archivo.id)
      setArchivos(next)
      onChange?.(next)
      toast.success('Documento eliminado')
    } catch (err: any) {
      toast.error(err?.message ?? 'Error al eliminar')
    }
  }

  const handleView = async (archivo: SolicitudArchivo) => {
    try {
      const url = await getArchivoUrl(archivo.archivo_path!)
      window.open(url, '_blank')
    } catch {
      toast.error('No se pudo abrir el documento')
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide">
          Documentos requeridos
        </h2>
        <span className="text-xs text-gray-400">{archivos.length} / 4 subidos</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#003D7D] border-t-transparent" />
        </div>
      ) : (
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {TIPOS.map(tipo => {
            const archivo    = byTipo(tipo)
            const isUploading = uploading === tipo

            return (
              <div key={tipo} className={`rounded-xl border-2 p-4 flex flex-col gap-3 transition-all ${
                archivo
                  ? 'border-green-200 bg-green-50'
                  : 'border-dashed border-gray-200 bg-gray-50'
              }`}>
                <div className="flex items-center gap-2">
                  {archivo
                    ? <CheckCircle size={15} className="text-green-600 shrink-0" />
                    : <FileText  size={15} className="text-gray-400 shrink-0" />
                  }
                  <span className="text-sm font-semibold text-gray-800">{tipo}</span>
                  <span className="ml-auto text-xs font-medium text-red-400">*</span>
                </div>

                {archivo ? (
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-xs text-gray-600 truncate" title={archivo.nombre_archivo ?? ''}>
                      {archivo.nombre_archivo}
                    </span>
                    <button
                      onClick={() => handleView(archivo)}
                      className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-100 transition-colors"
                      title="Ver documento"
                    >
                      <Eye size={13} />
                    </button>
                    {editable && (
                      <button
                        onClick={() => handleDelete(archivo)}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-100 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ) : editable ? (
                  <>
                    <input
                      ref={el => { refs.current[tipo] = el }}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) handleUpload(tipo, f)
                        e.target.value = ''
                      }}
                    />
                    <button
                      onClick={() => refs.current[tipo]?.click()}
                      disabled={isUploading}
                      className="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-500 hover:text-[#003D7D] hover:bg-white rounded-lg border border-gray-200 transition-all disabled:opacity-50"
                    >
                      {isUploading
                        ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#003D7D] border-t-transparent" />
                        : <><Upload size={12} /> Subir PDF</>
                      }
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-gray-400 italic">No adjuntado</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
