import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import SolicitudesTable from '../features/solicitud/components/SolicitudesTable'
import { useSolicitudes } from '../features/solicitud/hooks/useSolicitudes'
import type { Solicitud } from '../features/solicitud/types/solicitud'

const ESTADO_CANCELADO = 5

export default function SolicitudesPage() {
	const navigate = useNavigate()
	const { data, total, page, pageSize, totalPages, loading, setPage, setSearch, refresh, update } = useSolicitudes()

	const handleCancel = async (s: Solicitud) => {
		if (!confirm(`¿Cancelar la solicitud ${s.codigo ?? `#${s.id}`}? Esta acción no se puede deshacer.`)) return
		try {
			await update(s.id, { estado_id: ESTADO_CANCELADO })
			toast.success('Solicitud cancelada')
		} catch {
			toast.error('No se pudo cancelar la solicitud')
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
				onCancel={handleCancel}
			/>
		</div>
	)
}
