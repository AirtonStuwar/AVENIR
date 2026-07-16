import { useEffect, useState } from 'react'
import { Users, Plus, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getUsuariosConRol, cambiarRolUsuario, crearUsuario,
  type UsuarioConRol,
} from '../features/usuario/services/usuarioService'
import { ROLES } from '../features/solicitud/types/solicitud'

const ROLE_LABELS: Record<number, string> = {
  1:  'Administrador',
  8:  'Evaluador',
  9:  'Aprobador',
  10: 'Visualizador',
  11: 'Usuario',
}

const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([id, label]) => ({ id: Number(id), label }))

const INPUT = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 focus:border-[#003D7D]/50 focus:bg-white transition-all'
const LABEL = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1'

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioConRol[]>([])
  const [loading,  setLoading]  = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [email,     setEmail]     = useState('')
  const [nombres,   setNombres]   = useState('')
  const [apellidos, setApellidos] = useState('')
  const [cargo,     setCargo]     = useState('')
  const [dni,       setDni]       = useState('')
  const [rol,       setRol]       = useState<number>(ROLES.USUARIO)
  const [creating,  setCreating]  = useState(false)

  const load = () => {
    setLoading(true)
    getUsuariosConRol()
      .then(setUsuarios)
      .catch(() => toast.error('Error al cargar usuarios'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const resetForm = () => {
    setEmail(''); setNombres(''); setApellidos(''); setCargo(''); setDni(''); setRol(ROLES.USUARIO)
  }

  const handleCrear = async () => {
    if (!email.trim() || !nombres.trim() || !apellidos.trim()) {
      toast.error('Completa correo, nombres y apellidos'); return
    }
    setCreating(true)
    try {
      await crearUsuario({
        email: email.trim(),
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        cargo: cargo.trim() || undefined,
        dni: dni.trim() || undefined,
        rol,
      })
      toast.success('Usuario invitado — recibirá un correo para crear su contraseña')
      setModalOpen(false)
      resetForm()
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear usuario')
    } finally {
      setCreating(false)
    }
  }

  const handleCambiarRol = async (usuarioId: string, nuevoRol: number) => {
    setSavingId(usuarioId)
    try {
      await cambiarRolUsuario(usuarioId, nuevoRol)
      setUsuarios(prev => prev.map(u => u.id === usuarioId ? { ...u, rol: nuevoRol } : u))
      toast.success('Rol actualizado')
    } catch {
      toast.error('Error al cambiar el rol')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-5 flex items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Users size={20} className="text-[#003D7D]" />
          <div>
            <h1 className="text-base font-semibold text-gray-900">Usuarios</h1>
            <p className="text-xs text-gray-400">{usuarios.length} usuarios registrados</p>
          </div>
        </div>
        <button onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 h-10 px-4 rounded-xl bg-[#003D7D] text-white text-sm font-semibold hover:bg-[#002D5C] transition-colors">
          <Plus size={15} /> Nuevo usuario
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <Loader2 size={22} className="animate-spin mr-2" /> Cargando...
            </div>
          ) : usuarios.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
              <Users size={32} className="text-gray-200" />
              <p className="text-sm">Sin usuarios registrados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Correo</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cargo</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {usuarios.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{u.nombre_completo ?? ([u.nombres, u.apellidos].filter(Boolean).join(' ') || '—')}</td>
                      <td className="px-4 py-3 text-gray-600">{u.correo ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{u.cargo ?? '—'}</td>
                      <td className="px-4 py-3">
                        <select
                          value={u.rol ?? ''}
                          disabled={savingId === u.id}
                          onChange={e => handleCambiarRol(u.id, Number(e.target.value))}
                          className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#003D7D]/20 disabled:opacity-50 ${u.rol ? 'border-gray-200 bg-white text-gray-700' : 'border-amber-300 bg-amber-50 text-amber-700'}`}
                        >
                          <option value="" disabled>Sin rol asignado</option>
                          {ROLE_OPTIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal crear usuario */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Nuevo usuario</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Se enviará un correo de invitación para que el usuario cree su propia contraseña.
            </p>

            <div>
              <label className={LABEL}>Correo *</label>
              <input type="email" className={INPUT} value={email} onChange={e => setEmail(e.target.value)} placeholder="nombre@avenir.pe" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Nombres *</label>
                <input className={INPUT} value={nombres} onChange={e => setNombres(e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Apellidos *</label>
                <input className={INPUT} value={apellidos} onChange={e => setApellidos(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Cargo</label>
                <input className={INPUT} value={cargo} onChange={e => setCargo(e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>DNI</label>
                <input className={INPUT} value={dni} maxLength={8} onChange={e => setDni(e.target.value.replace(/\D/g, ''))} />
              </div>
            </div>
            <div>
              <label className={LABEL}>Rol *</label>
              <select className={INPUT} value={rol} onChange={e => setRol(Number(e.target.value))}>
                {ROLE_OPTIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setModalOpen(false)} disabled={creating}
                className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleCrear} disabled={creating}
                className="flex-1 h-10 rounded-xl bg-[#003D7D] text-white text-sm font-semibold hover:bg-[#002D5C] disabled:opacity-50 flex items-center justify-center gap-2">
                {creating ? <Loader2 size={14} className="animate-spin" /> : null}
                Invitar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
