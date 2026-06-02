import { useRef, useState, useEffect, useCallback } from 'react'
import {
  X, Trash2, PenLine, Upload, CheckCircle, UserCircle,
  AlertCircle, Lock, User,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import {
  getUserFirmaUrl,
  saveUserFirma,
  deleteUserFirma,
  updateUsuarioPerfil,
  changePassword,
} from '../../features/usuario/services/usuarioService'

type Tab     = 'datos' | 'firma' | 'password'
type FirmaTab = 'dibujar' | 'subir'

interface Props {
  open: boolean
  onClose: () => void
}

export default function UserProfileModal({ open, onClose }: Props) {
  const { user, usuarioProfile, refreshProfile } = useAuthStore()

  // ── Tabs ──────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>('datos')

  // ═══════════════════════════════════════════════
  // TAB: DATOS
  // ═══════════════════════════════════════════════
  const [nombres,   setNombres]   = useState('')
  const [apellidos, setApellidos] = useState('')
  const [cargo,     setCargo]     = useState('')
  const [savingDatos, setSavingDatos] = useState(false)

  // Sincronizar con perfil cuando abre
  useEffect(() => {
    if (!open) return
    setTab('datos')
    setNombres(usuarioProfile?.nombres   ?? '')
    setApellidos(usuarioProfile?.apellidos ?? '')
    setCargo(usuarioProfile?.cargo        ?? '')
  }, [open, usuarioProfile])

  const handleSaveDatos = async () => {
    if (!user?.id) return
    setSavingDatos(true)
    try {
      await updateUsuarioPerfil(user.id, {
        nombres:   nombres.trim()   || null,
        apellidos: apellidos.trim() || null,
        cargo:     cargo.trim()     || null,
      })
      await refreshProfile()
      toast.success('Perfil actualizado')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo actualizar el perfil')
    } finally {
      setSavingDatos(false)
    }
  }

  const datosDirty =
    nombres.trim()   !== (usuarioProfile?.nombres   ?? '') ||
    apellidos.trim() !== (usuarioProfile?.apellidos ?? '') ||
    cargo.trim()     !== (usuarioProfile?.cargo     ?? '')

  // ═══════════════════════════════════════════════
  // TAB: FIRMA
  // ═══════════════════════════════════════════════
  const [firmaTab,       setFirmaTab]       = useState<FirmaTab>('dibujar')
  const [firmaPreviewUrl, setFirmaPreviewUrl] = useState<string | null>(null)
  const [loadingFirma,   setLoadingFirma]   = useState(false)
  const [savingFirma,    setSavingFirma]    = useState(false)
  const [deletingFirma,  setDeletingFirma]  = useState(false)

  // Canvas
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const lastPos    = useRef<{ x: number; y: number } | null>(null)
  const [drawing,  setDrawing]  = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  // Subir imagen
  const fileRef        = useRef<HTMLInputElement>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBlob,    setImageBlob]    = useState<Blob | null>(null)

  // Cargar firma actual al abrir / cambiar a tab firma
  useEffect(() => {
    if (!open || tab !== 'firma') return
    setFirmaTab('dibujar')
    setHasDrawn(false)
    setImagePreview(null)
    setImageBlob(null)
    setFirmaPreviewUrl(null)

    if (usuarioProfile?.firma_path) {
      setLoadingFirma(true)
      getUserFirmaUrl(usuarioProfile.firma_path)
        .then(url => setFirmaPreviewUrl(url))
        .catch(() => setFirmaPreviewUrl(null))
        .finally(() => setLoadingFirma(false))
    }
  }, [open, tab, usuarioProfile?.firma_path])

  const resetCanvas = useCallback(() => {
    requestAnimationFrame(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = '#1e3a5f'
      ctx.lineWidth   = 2.5
      ctx.lineCap     = 'round'
      ctx.lineJoin    = 'round'
    })
    setHasDrawn(false)
    lastPos.current = null
  }, [])

  useEffect(() => {
    if (open && tab === 'firma' && firmaTab === 'dibujar') resetCanvas()
  }, [open, tab, firmaTab, resetCanvas])

  function getPos(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect   = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      const t = e.touches[0]
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  function startDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault(); setDrawing(true); lastPos.current = getPos(e)
  }
  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    if (!drawing || !lastPos.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y); ctx.stroke()
    lastPos.current = pos
    if (!hasDrawn) setHasDrawn(true)
  }
  function endDraw() { setDrawing(false); lastPos.current = null }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageBlob(file)
    const reader = new FileReader()
    reader.onload = ev => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSaveFirma() {
    if (!user?.id) return
    setSavingFirma(true)
    try {
      let blob: Blob
      if (firmaTab === 'dibujar') {
        const canvas = canvasRef.current
        if (!canvas || !hasDrawn) return
        blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
        )
      } else {
        if (!imageBlob) return
        blob = imageBlob
      }
      await saveUserFirma(user.id, blob)
      await refreshProfile()
      const updated = useAuthStore.getState().usuarioProfile
      if (updated?.firma_path) {
        const url = await getUserFirmaUrl(updated.firma_path)
        setFirmaPreviewUrl(url)
      }
      toast.success('Firma guardada correctamente')
      resetCanvas()
      setImagePreview(null)
      setImageBlob(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar la firma')
    } finally {
      setSavingFirma(false)
    }
  }

  async function handleDeleteFirma() {
    if (!user?.id) return
    setDeletingFirma(true)
    try {
      await deleteUserFirma(user.id)
      await refreshProfile()
      setFirmaPreviewUrl(null)
      toast.success('Firma eliminada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar la firma')
    } finally {
      setDeletingFirma(false)
    }
  }

  const canSaveFirma = firmaTab === 'dibujar' ? hasDrawn : !!imageBlob

  // ═══════════════════════════════════════════════
  // TAB: CONTRASEÑA
  // ═══════════════════════════════════════════════
  const [newPass,     setNewPass]     = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [savingPass,  setSavingPass]  = useState(false)

  useEffect(() => {
    if (!open) { setNewPass(''); setConfirmPass('') }
  }, [open])

  const passMatch  = newPass === confirmPass
  const passStrong = newPass.length >= 8
  const canSavePass = newPass.length > 0 && passMatch && passStrong

  async function handleSavePassword() {
    if (!canSavePass) return
    setSavingPass(true)
    try {
      await changePassword(newPass)
      toast.success('Contraseña actualizada correctamente')
      setNewPass('')
      setConfirmPass('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña')
    } finally {
      setSavingPass(false)
    }
  }

  if (!open) return null

  const correo = usuarioProfile?.correo ?? user?.email ?? '—'

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'datos',    label: 'Datos',       icon: <User size={13} /> },
    { key: 'firma',    label: 'Firma',        icon: <PenLine size={13} /> },
    { key: 'password', label: 'Contraseña',   icon: <Lock size={13} /> },
  ]

  const INPUT = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]/50 focus:bg-white transition-all'
  const LABEL = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#003D7D] flex items-center justify-center shrink-0">
              <UserCircle size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Mi perfil</h2>
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[260px]">{correo}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 px-4 pt-3 pb-0 shrink-0 border-b border-gray-100">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-t-xl border-b-2 transition-all
                ${tab === t.key
                  ? 'border-[#003D7D] text-[#003D7D] bg-[#003D7D]/5'
                  : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="overflow-y-auto flex-1 px-6 py-5">

          {/* ────────── TAB: DATOS ────────── */}
          {tab === 'datos' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Nombres</label>
                  <input
                    type="text"
                    value={nombres}
                    onChange={e => setNombres(e.target.value)}
                    placeholder="Ej: José"
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className={LABEL}>Apellidos</label>
                  <input
                    type="text"
                    value={apellidos}
                    onChange={e => setApellidos(e.target.value)}
                    placeholder="Ej: García López"
                    className={INPUT}
                  />
                </div>
              </div>
              <div>
                <label className={LABEL}>Cargo</label>
                <input
                  type="text"
                  value={cargo}
                  onChange={e => setCargo(e.target.value)}
                  placeholder="Ej: Jefe de Compras"
                  className={INPUT}
                />
              </div>
              <div>
                <label className={LABEL}>Correo electrónico</label>
                <input
                  type="email"
                  value={correo}
                  disabled
                  className={`${INPUT} opacity-60 cursor-not-allowed`}
                />
                <p className="mt-1 text-[11px] text-gray-400">El correo no se puede modificar.</p>
              </div>
            </div>
          )}

          {/* ────────── TAB: FIRMA ────────── */}
          {tab === 'firma' && (
            <div className="space-y-4">

              {/* Firma actual */}
              <div>
                <p className={LABEL}>Firma guardada</p>
                {loadingFirma ? (
                  <div className="h-24 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#003D7D] border-t-transparent" />
                  </div>
                ) : firmaPreviewUrl ? (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-3 flex items-center justify-between gap-3">
                    <img src={firmaPreviewUrl} alt="Firma guardada" className="h-16 object-contain" />
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-green-700">
                        <CheckCircle size={12} /> Activa
                      </span>
                      <button
                        onClick={handleDeleteFirma}
                        disabled={deletingFirma}
                        className="flex items-center gap-1 text-[11px] text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
                      >
                        <Trash2 size={11} /> {deletingFirma ? 'Eliminando…' : 'Eliminar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="h-16 rounded-xl border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center gap-2 text-gray-400">
                    <AlertCircle size={14} />
                    <span className="text-xs">Sin firma guardada</span>
                  </div>
                )}
              </div>

              {/* Editor */}
              <div>
                <p className={LABEL}>{firmaPreviewUrl ? 'Reemplazar firma' : 'Nueva firma'}</p>

                {/* Sub-tabs dibujar / subir */}
                <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-3">
                  {([
                    { key: 'dibujar', label: 'Dibujar',       icon: <PenLine size={13} /> },
                    { key: 'subir',   label: 'Subir imagen',  icon: <Upload size={13} /> },
                  ] as { key: FirmaTab; label: string; icon: React.ReactNode }[]).map(t => (
                    <button
                      key={t.key}
                      onClick={() => setFirmaTab(t.key)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all
                        ${firmaTab === t.key ? 'bg-white text-[#003D7D] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>

                {firmaTab === 'dibujar' && (
                  <div className="space-y-2">
                    <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 overflow-hidden">
                      <canvas
                        ref={canvasRef}
                        width={460} height={150}
                        className="w-full touch-none cursor-crosshair select-none"
                        onMouseDown={startDraw} onMouseMove={draw}
                        onMouseUp={endDraw}      onMouseLeave={endDraw}
                        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
                      />
                    </div>
                    {!hasDrawn
                      ? <p className="text-xs text-gray-400 italic text-center">— Traza tu firma con el cursor o tu dedo —</p>
                      : <button onClick={resetCanvas} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors">
                          <Trash2 size={12} /> Limpiar
                        </button>
                    }
                  </div>
                )}

                {firmaTab === 'subir' && (
                  <div className="space-y-2">
                    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} className="hidden" />
                    {imagePreview ? (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 flex items-center gap-3">
                        <img src={imagePreview} alt="Preview" className="h-14 object-contain rounded" />
                        <button
                          onClick={() => { setImagePreview(null); setImageBlob(null); if (fileRef.current) fileRef.current.value = '' }}
                          className="ml-auto flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
                        >
                          <Trash2 size={12} /> Quitar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileRef.current?.click()}
                        className="w-full h-20 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100
                          flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <Upload size={18} />
                        <span className="text-xs">Haz clic para seleccionar imagen</span>
                        <span className="text-[10px] text-gray-300">PNG, JPG o WEBP — máx. 2 MB</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ────────── TAB: CONTRASEÑA ────────── */}
          {tab === 'password' && (
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Nueva contraseña</label>
                <input
                  type="password"
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className={INPUT}
                  autoComplete="new-password"
                />
                {newPass.length > 0 && !passStrong && (
                  <p className="mt-1 text-[11px] text-red-500">Mínimo 8 caracteres.</p>
                )}
              </div>
              <div>
                <label className={LABEL}>Confirmar contraseña</label>
                <input
                  type="password"
                  value={confirmPass}
                  onChange={e => setConfirmPass(e.target.value)}
                  placeholder="Repite la nueva contraseña"
                  className={`${INPUT} ${confirmPass.length > 0 && !passMatch ? 'border-red-300 ring-red-200 focus:ring-red-200 focus:border-red-400' : ''}`}
                  autoComplete="new-password"
                />
                {confirmPass.length > 0 && !passMatch && (
                  <p className="mt-1 text-[11px] text-red-500">Las contraseñas no coinciden.</p>
                )}
              </div>
              {canSavePass && (
                <div className="flex items-center gap-1.5 text-[11px] text-green-600">
                  <CheckCircle size={12} /> Contraseña válida — lista para guardar.
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition-all"
          >
            Cerrar
          </button>

          {tab === 'datos' && (
            <button
              onClick={handleSaveDatos}
              disabled={!datosDirty || savingDatos}
              className="px-5 py-2 rounded-xl bg-[#003D7D] text-white text-sm font-medium flex items-center gap-2
                hover:bg-[#002D5C] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {savingDatos
                ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Guardando…</>
                : <><CheckCircle size={14} /> Guardar datos</>
              }
            </button>
          )}

          {tab === 'firma' && (
            <button
              onClick={handleSaveFirma}
              disabled={!canSaveFirma || savingFirma}
              className="px-5 py-2 rounded-xl bg-[#003D7D] text-white text-sm font-medium flex items-center gap-2
                hover:bg-[#002D5C] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {savingFirma
                ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Guardando…</>
                : <><CheckCircle size={14} /> Guardar firma</>
              }
            </button>
          )}

          {tab === 'password' && (
            <button
              onClick={handleSavePassword}
              disabled={!canSavePass || savingPass}
              className="px-5 py-2 rounded-xl bg-[#003D7D] text-white text-sm font-medium flex items-center gap-2
                hover:bg-[#002D5C] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {savingPass
                ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Guardando…</>
                : <><Lock size={14} /> Cambiar contraseña</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
