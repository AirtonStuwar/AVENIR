import { create } from 'zustand'

interface SolicitudFiltrosState {
  proyectoFilter: number | null
  areaFilter: number | null
  mesAprobacion: number | null
  pagoFilter: 'pendiente' | 'pagado' | null
  ordenVencimiento: boolean
  setProyectoFilter: (v: number | null) => void
  setAreaFilter: (v: number | null) => void
  setMesAprobacion: (v: number | null) => void
  setPagoFilter: (v: 'pendiente' | 'pagado' | null) => void
  setOrdenVencimiento: (v: boolean) => void
  clear: () => void
}

export const useSolicitudFiltrosStore = create<SolicitudFiltrosState>((set) => ({
  proyectoFilter: null,
  areaFilter: null,
  mesAprobacion: null,
  pagoFilter: null,
  ordenVencimiento: false,
  setProyectoFilter: (v) => set({ proyectoFilter: v }),
  setAreaFilter: (v) => set({ areaFilter: v }),
  setMesAprobacion: (v) => set({ mesAprobacion: v }),
  setPagoFilter: (v) => set({ pagoFilter: v }),
  setOrdenVencimiento: (v) => set({ ordenVencimiento: v }),
  clear: () => set({ proyectoFilter: null, areaFilter: null, mesAprobacion: null, pagoFilter: null, ordenVencimiento: false }),
}))
