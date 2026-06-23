import { useEffect, useState } from 'react'
import { useProyectos }         from '../features/proyecto/hooks/useProyectos'
import ProyectosTable            from '../features/proyecto/components/ProyectosTable'
import ProyectoModal             from '../features/proyecto/components/ProyectoModal'
import ProyectoDeleteDialog      from '../features/proyecto/components/ProyectoDeleteDialog'
import ProyectoPartidasPanel     from '../features/proyecto/components/ProyectoPartidasPanel'
import CuentasBancariasPanel    from '../features/proyecto/components/CuentasBancariasPanel'
import { getConsumoByProyectos } from '../features/proyecto/services/proyectoService'
import { useAuthStore }          from '../store/authStore'
import type { Proyecto }         from '../features/proyecto/types/proyecto'
import type { Consumo }          from '../features/proyecto/services/proyectoService'

export default function ProyectosPage() {
  const {
    data, total, page, pageSize, totalPages, loading,
    setPage, setSearch, setEstadoFilter, refresh,
    create, update, remove, toggleEstado,
  } = useProyectos()
  const user = useAuthStore((state) => state.user)
  const userRole = useAuthStore((state) => state.userRole)
  const canVerConsumo = userRole === 1 || userRole === 9
  const [consumo, setConsumo] = useState<Record<number, Consumo>>({})

  useEffect(() => {
    if (!data.length || !canVerConsumo) return
    getConsumoByProyectos(data.map(p => p.id))
      .then(r => setConsumo(r.porProyecto))
      .catch(() => {})
  }, [data, canVerConsumo])

  const [modalOpen,      setModalOpen]      = useState(false)
  const [editTarget,     setEditTarget]     = useState<Proyecto | null>(null)
  const [deleteOpen,     setDeleteOpen]     = useState(false)
  const [deleteTarget,   setDeleteTarget]   = useState<Proyecto | null>(null)
  const [partidasTarget, setPartidasTarget] = useState<Proyecto | null>(null)
  const [cuentasTarget,  setCuentasTarget]  = useState<Proyecto | null>(null)

  const handleCreate   = () => { setEditTarget(null); setModalOpen(true) }
  const handleEdit     = (p: Proyecto) => { setEditTarget(p); setModalOpen(true) }
  const handleDelete   = (p: Proyecto) => { setDeleteTarget(p); setDeleteOpen(true) }
  const handlePartidas = (p: Proyecto) => { setPartidasTarget(p) }
  const handleCuentas  = (p: Proyecto) => { setCuentasTarget(p) }

  const handleModalSubmit = async (data: Parameters<typeof create>[0]) => {
    if (editTarget) await update(editTarget.id, data)
    else await create({ ...data, usuario_creador: user?.id ?? null })
  }

  return (
    <div className="min-h-screen flex justify-center">
      <div className="space-y-4 max-w-6xl w-full px-4">
        <ProyectosTable
          data={data} total={total} page={page} pageSize={pageSize}
          totalPages={totalPages} loading={loading}
          consumo={canVerConsumo ? consumo : undefined}
          onEdit={handleEdit} onDelete={handleDelete} onToggle={toggleEstado}
          onCreate={handleCreate} onPartidas={handlePartidas} onCuentas={handleCuentas}
          onSearch={setSearch} onFilter={setEstadoFilter}
          onPageChange={setPage} onRefresh={refresh}
        />
        <ProyectoModal
          open={modalOpen} proyecto={editTarget}
          onClose={() => setModalOpen(false)} onSubmit={handleModalSubmit}
        />
        <ProyectoDeleteDialog
          open={deleteOpen} proyecto={deleteTarget}
          onClose={() => setDeleteOpen(false)} onConfirm={remove}
        />
        <ProyectoPartidasPanel
          proyecto={partidasTarget}
          mostrarConsumo={canVerConsumo}
          onClose={() => setPartidasTarget(null)}
        />
        <CuentasBancariasPanel
          proyecto={cuentasTarget}
          onClose={() => setCuentasTarget(null)}
        />
      </div>
    </div>
  )
}