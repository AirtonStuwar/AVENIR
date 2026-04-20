import { useState } from 'react'
import { useProyectos }     from '../features/proyecto/hooks/useProyectos'
import ProyectosTable       from '../features/proyecto/components/ProyectosTable'
import ProyectoModal        from '../features/proyecto/components/ProyectoModal'
import ProyectoDeleteDialog from '../features/proyecto/components/ProyectoDeleteDialog'
import type { Proyecto }    from '../features/proyecto/types/proyecto'

export default function ProyectosPage() {
  const {
    data, total, page, pageSize, totalPages, loading,
    setPage, setSearch, setEstadoFilter, refresh,
    create, update, remove, toggleEstado,
  } = useProyectos()

  const [modalOpen,    setModalOpen]    = useState(false)
  const [editTarget,   setEditTarget]   = useState<Proyecto | null>(null)
  const [deleteOpen,   setDeleteOpen]   = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Proyecto | null>(null)

  const handleCreate = () => { setEditTarget(null); setModalOpen(true) }
  const handleEdit   = (p: Proyecto) => { setEditTarget(p); setModalOpen(true) }
  const handleDelete = (p: Proyecto) => { setDeleteTarget(p); setDeleteOpen(true) }

  const handleModalSubmit = async (data: Parameters<typeof create>[0]) => {
    if (editTarget) await update(editTarget.id, data)
    else await create(data)
  }

  return (
    <div className="min-h-screen flex  justify-center">
  <div className="space-y-4 max-w-6xl w-full px-4">
      <ProyectosTable
        data={data} total={total} page={page} pageSize={pageSize}
        totalPages={totalPages} loading={loading}
        onEdit={handleEdit} onDelete={handleDelete} onToggle={toggleEstado}
        onCreate={handleCreate} onSearch={setSearch} onFilter={setEstadoFilter}
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
    </div>
</div>
  )
}