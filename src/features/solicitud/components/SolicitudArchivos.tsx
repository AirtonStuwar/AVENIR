import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import JSZip from 'jszip'
import { CheckCircle, Download, Eye, FileText, Trash2, Upload } from 'lucide-react'
import {
  deleteArchivoSolicitud,
  getArchivosBySolicitud,
  getArchivoUrl,
  uploadArchivoSolicitud,
} from '../services/solicitudService'
import type { SolicitudArchivo } from '../types/solicitud'

const TIPOS_REQUERIDOS = ['Contrato', 'Cotizacion', 'Sustento'] as const
const TIPOS_OPCIONALES = ['Cuadro Comparativo', 'Factura XML', 'Factura PDF'] as const
const TIPOS = [...TIPOS_REQUERIDOS, ...TIPOS_OPCIONALES] as const

// Tipos de archivo aceptados por cada documento
const ACCEPT: Record<string, string> = {
  'Factura XML': '.xml,text/xml,application/xml',
}
const DEFAULT_ACCEPT = 'application/pdf'

interface Props {
  solicitudId: number
  editable: boolean
  onChange?: (archivos: SolicitudArchivo[]) => void
  tiposVisibles?: string[]   // si se indica, sólo muestra estos tipos de documento
  tiposOpcionales?: string[] // sobrescribe tipos que normalmente son obligatorios → los marca como opcionales
  canDownloadAll?: boolean   // muestra el botón "Descargar todos" en el header
  zipName?: string           // nombre del ZIP y la carpeta interna (ej. código de la solicitud)
}

export default function SolicitudArchivos({ solicitudId, editable, onChange, tiposVisibles, tiposOpcionales, canDownloadAll, zipName }: Props) {
  const [archivos,  setArchivos]  = useState<SolicitudArchivo[]>([])
  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [downloadingAll, setDownloadingAll] = useState(false)
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
    if (tipo === 'Factura XML') {
      if (!['text/xml', 'application/xml'].includes(file.type) && !file.name.endsWith('.xml')) {
        toast.error('Solo se permiten archivos XML')
        return
      }
    } else {
      if (file.type !== 'application/pdf') {
        toast.error('Solo se permiten archivos PDF')
        return
      }
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

  const tiposAMostrar: string[] = tiposVisibles ?? [...TIPOS]

  // Solo documentos visibles (excluye firmas u otros tipos internos)
  const descargables = archivos.filter(a => tiposAMostrar.includes(a.tipo_archivo ?? ''))

  const handleDownloadAll = async () => {
    if (descargables.length === 0) { toast.error('No hay documentos adjuntos'); return }
    setDownloadingAll(true)
    try {
      const carpeta = zipName ?? `solicitud-${solicitudId}`
      const zip = new JSZip()
      const folder = zip.folder(carpeta)!
      const usedNames = new Set<string>()
      for (const archivo of descargables) {
        const url  = await getArchivoUrl(archivo.archivo_path!)
        const res  = await fetch(url)
        const blob = await res.blob()
        const original = archivo.nombre_archivo || `${archivo.tipo_archivo ?? 'documento'}.${(archivo.archivo_path ?? '').split('.').pop() || 'pdf'}`
        // Si el nombre original ya se usó en este ZIP, se le agrega un número para que ambos archivos se incluyan.
        let name = original
        if (usedNames.has(name)) {
          const dot = original.lastIndexOf('.')
          const base = dot > -1 ? original.slice(0, dot) : original
          const ext  = dot > -1 ? original.slice(dot) : ''
          let n = 2
          while (usedNames.has(`${base} (${n})${ext}`)) n++
          name = `${base} (${n})${ext}`
        }
        usedNames.add(name)
        folder.file(name, blob)
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const objUrl = URL.createObjectURL(zipBlob)
      const link = document.createElement('a')
      link.href = objUrl
      link.download = `${carpeta}_documentos.zip`
      link.click()
      URL.revokeObjectURL(objUrl)
      toast.success(`${descargables.length} documento${descargables.length !== 1 ? 's' : ''} descargado${descargables.length !== 1 ? 's' : ''} en ZIP`)
    } catch {
      toast.error('Error al descargar documentos')
    } finally {
      setDownloadingAll(false)
    }
  }

  // Un tipo es opcional si está en TIPOS_OPCIONALES O si el caller lo marcó como opcional
  const esOpcionalFn = (tipo: string) =>
    (TIPOS_OPCIONALES as readonly string[]).includes(tipo) ||
    (tiposOpcionales?.includes(tipo) ?? false)

  const nObligatorios = tiposAMostrar.filter(t => !esOpcionalFn(t)).length
  const nOpcionales   = tiposAMostrar.filter(t =>  esOpcionalFn(t)).length
  const nSubidos      = archivos.filter(a => (tiposAMostrar as readonly string[]).includes(a.tipo_archivo ?? '')).length

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#003D7D] uppercase tracking-wide">
          Documentos requeridos
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {nSubidos} subido{nSubidos !== 1 ? 's' : ''}
            {nObligatorios > 0 && ` · ${nObligatorios} obligatorio${nObligatorios !== 1 ? 's' : ''}`}
            {nOpcionales   > 0 && ` · ${nOpcionales} opcional${nOpcionales !== 1 ? 'es' : ''}`}
          </span>
          {canDownloadAll && descargables.length > 0 && (
            <button
              onClick={handleDownloadAll}
              disabled={downloadingAll}
              className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#003D7D] text-white text-xs font-semibold hover:bg-[#002D5C] disabled:opacity-50 transition-colors"
            >
              {downloadingAll
                ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                : <Download size={13} />}
              Descargar todos ({descargables.length})
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#003D7D] border-t-transparent" />
        </div>
      ) : (
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {tiposAMostrar.map(tipo => {
            const archivo     = byTipo(tipo)
            const isUploading = uploading === tipo
            const esOpcional  = esOpcionalFn(tipo)

            return (
              <div key={tipo} className={`rounded-xl border-2 p-4 flex flex-col gap-3 transition-all ${
                archivo
                  ? 'border-green-200 bg-green-50'
                  : 'border-dashed border-gray-200 bg-gray-50'
              }`}>
                <div className="flex items-center gap-2">
                  {archivo
                    ? <CheckCircle size={15} className="text-green-600 shrink-0" />
                    : <FileText    size={15} className="text-gray-400 shrink-0" />
                  }
                  <span className="text-sm font-semibold text-gray-800">{tipo}</span>
                  {esOpcional
                    ? <span className="ml-auto text-xs text-gray-400 italic">Opcional</span>
                    : <span className="ml-auto text-xs font-medium text-red-400">*</span>
                  }
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
                      accept={ACCEPT[tipo] ?? DEFAULT_ACCEPT}
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
                        : <><Upload size={12} /> {tipo === 'Factura XML' ? 'Subir XML' : 'Subir PDF'}</>
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
