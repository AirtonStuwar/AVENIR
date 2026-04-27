import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import SolicitudesTable from '../features/solicitud/components/SolicitudesTable'
import ConfirmModal from '../features/solicitud/components/ConfirmModal'
import { useSolicitudes } from '../features/solicitud/hooks/useSolicitudes'
import { cancelarSolicitud } from '../features/solicitud/services/solicitudService'
import { useAuthStore } from '../store/authStore'
import { ROLES } from '../features/solicitud/types/solicitud'
import type { Solicitud } from '../features/solicitud/types/solicitud'

export default function SolicitudesPage() {
	const navigate = useNavigate()
	const { userRole } = useAuthStore()
	const { data, total, page, pageSize, totalPages, loading, setPage, setSearch, refresh } = useSolicitudes()

	const [confirmOpen, setConfirmOpen] = useState(false)
	const [confirmMsg,  setConfirmMsg]  = useState('')
	const [pendingSol,  setPendingSol]  = useState<Solicitud | null>(null)

	const canCancelFromList = userRole === ROLES.ADMIN || userRole === ROLES.USUARIO

	const handleCancel = (s: Solicitud) => {
		setConfirmMsg(`¿Cancelar la solicitud ${s.codigo ?? `#${s.id}`}? Esta acción no se puede deshacer.`)
		setPendingSol(s)
		setConfirmOpen(true)
	}

	const confirmCancel = async () => {
		if (!pendingSol) return
		setConfirmOpen(false)
		try {
			await cancelarSolicitud(pendingSol.id)
			toast.success('Solicitud cancelada')
			refresh()
		} catch (err: unknown) {
			toast.error(err instanceof Error ? err.message : 'No se pudo cancelar la solicitud')
		}
	}

	return (
		<div className="p-6">
			<SolicitudesTable
				data={data}
				total={total}
				page={page}
				pageSize={pageSize}
				totalPages={totalPages}
				loading={loading}
				onSearch={setSearch}
				onPageChange={(p) => setPage(p)}
				onRefresh={refresh}
				onCreate={() => navigate('/solicitudes/nueva')}
				onView={(s) => navigate(`/solicitudes/${s.id}`)}
				onCancel={canCancelFromList ? handleCancel : undefined}
			/>

			<ConfirmModal
				open={confirmOpen}
				title="Cancelar solicitud"
				message={confirmMsg}
				confirmLabel="Cancelar solicitud"
				variant="red"
				onConfirm={confirmCancel}
				onCancel={() => setConfirmOpen(false)}
			/>
		</div>
	)
}
