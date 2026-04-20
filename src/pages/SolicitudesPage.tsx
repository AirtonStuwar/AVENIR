import { useState } from 'react'
import SolicitudesTable from '../features/solicitud/components/SolicitudesTable'
import SolicitudDetalleEditor from '../features/solicitud/components/SolicitudDetalleEditor'
import { useSolicitudes } from '../features/solicitud/hooks/useSolicitudes'
import SolicitudModal from '../features/solicitud/components/SolicitudModal'

export default function SolicitudesPage() {
	const { data, total, page, pageSize, totalPages, loading, setPage, setSearch, refresh, create } = useSolicitudes()
	const [modalOpen, setModalOpen] = useState(false)
	const [detalleOpen, setDetalleOpen] = useState(false)
	const [currentSolicitudId, setCurrentSolicitudId] = useState<number | null>(null)

	const handleCreate = async (payload: any) => {
		const nuevo = await create(payload)
		if (nuevo && nuevo.id) {
			setCurrentSolicitudId(nuevo.id)
			setDetalleOpen(true)
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
				onCreate={() => setModalOpen(true)}
			/>

			<SolicitudModal open={modalOpen} onClose={() => setModalOpen(false)} onCreate={handleCreate} />

			{currentSolicitudId !== null && (
				<SolicitudDetalleEditor
					solicitudId={currentSolicitudId}
					open={detalleOpen}
					onClose={() => { setDetalleOpen(false); setCurrentSolicitudId(null); refresh() }}
				/>
			)}
		</div>
	)
}
