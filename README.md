# AVENIR — Sistema de Gestión de Solicitudes

Plataforma web para la gestión y aprobación de solicitudes de compra/servicio, con flujo de trabajo por roles, seguimiento de estados, encuesta de proveedores y panel de indicadores.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript |
| Build | Vite |
| Estilos | Tailwind CSS v4 |
| Routing | React Router v7 |
| Estado global | Zustand |
| Backend / Auth / Storage | Supabase |
| Gráficos | Recharts |
| Exportación | exceljs |
| Notificaciones | react-hot-toast |
| PDF | @react-pdf/renderer |

## Requisitos previos

- Node.js 18+
- Cuenta y proyecto en [Supabase](https://supabase.com)

## Configuración

1. Clona el repositorio e instala dependencias:

```bash
git clone <repo-url>
cd AVENIR
npm install
```

2. Crea el archivo `.env.local` en la raíz con tus credenciales:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
DECOLECTA_API_KEY=tu-api-key   # Solo para el proxy de consulta RUC en desarrollo
```

3. Inicia el servidor de desarrollo:

```bash
npm run dev
```

## Comandos

```bash
npm run dev       # Servidor de desarrollo con HMR
npm run build     # Verificación TypeScript + build de producción
npm run preview   # Vista previa del build de producción
npm run lint      # ESLint
```

## Flujo de aprobación

Las solicitudes siguen el siguiente flujo de estados:

```
Pendiente ──────────────────────────────────── Cancelado
    │
    │ enviarARevision (USUARIO/ADMIN)
    ▼
En Revision ──── devolverSolicitud ──────────► Pendiente
    │
    │ marcarEvaluado (EVALUADOR/ADMIN)
    ▼
Evaluado ──────── rechazarSolicitud ─────────► Rechazado
    │
    │ aprobarSolicitud (APROBADOR/ADMIN)
    ▼
 Aprobado  ◄── estado final positivo
 (encuesta de proveedor disponible al llegar aquí)
```

> Los estados "Facturación Pendiente" y "Completado" fueron eliminados. **Aprobado** es el estado terminal positivo.

## Roles y permisos

| Rol | ID | Dashboard | Solicitudes visibles | Acciones |
|---|---|---|---|---|
| Admin | 1 | KPIs globales + gráficas + métricas proveedores | Todas | Todas |
| Evaluador | 8 | Cola de revisión + promedio espera | En Revision / Evaluado / Pendiente | Marcar evaluado, Devolver |
| Aprobador | 9 | Cola de aprobación + métricas proveedores | Evaluado / Aprobado / Rechazado | Aprobar, Rechazar |
| Visualizador | 10 | Solicitudes aprobadas + montos | Aprobadas | Solo lectura, exportar Excel |
| Usuario | 11 | Mis solicitudes por estado + monto aprobado | Propias | Crear, Editar (Pendiente), Enviar, Cancelar, Encuestar proveedor |

### Módulos por rol

| Módulo | Admin | Evaluador | Aprobador | Visualizador | Usuario |
|---|---|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Solicitudes | ✅ | ✅ | ✅ | ✅ | ✅ |
| Proveedores | ✅ | — | — | — | ✅ |
| Proyectos | ✅ | — | — | — | — |

## Wizard de nueva solicitud (4 pasos)

1. **Datos generales** — proveedor, datos bancarios, proyecto, forma de pago, porcentajes de contrato, fechas y condiciones.
2. **Detalles** — ítems de la solicitud (descripción, cantidad, valor unitario). Muestra subtotal, IGV (18%) y total.
3. **Documentos** — subida de archivos obligatorios (Contrato, Cotización, Sustento) y opcional (Cuadro Comparativo). No permite avanzar sin los 3 obligatorios.
4. **Factura** *(opcional)* — Factura XML y/o Factura PDF, número de factura, motivo, fecha de emisión y fecha de vencimiento. Se puede omitir y completar desde el detalle de la solicitud.

## Documentos por solicitud

Los archivos se almacenan en el bucket de Supabase Storage `solicitud-archivos` con la ruta `{solicitudId}/{tipoArchivo}/{timestamp}.{ext}`.

| Tipo | Formato | Paso | Obligatorio |
|---|---|---|---|
| Contrato | PDF | Step 3 | ✅ |
| Cotizacion | PDF | Step 3 | ✅ |
| Sustento | PDF | Step 3 | ✅ |
| Cuadro Comparativo | PDF | Step 3 | — |
| Factura XML | XML | Step 4 | — |
| Factura PDF | PDF | Step 4 | — |

## Módulo de Proveedores

Accesible en `/proveedores` para ADMIN y USUARIO. Muestra todos los proveedores que han tenido solicitudes aprobadas, con métricas agregadas de encuestas internas:

- Promedio general (escala 1–5)
- Promedios por criterio: Calidad, Tiempo de entrega, Precio, Comunicación
- Porcentaje que recomendaría al proveedor
- Total de encuestas y solicitudes

La **encuesta de satisfacción** se habilita en el detalle de la solicitud cuando el estado es **Aprobado** (solo para el creador o ADMIN). Evalúa 4 criterios en escala 1–5 y pregunta si recomendaría al proveedor.

## Estructura del proyecto

```
src/
├── api/
│   └── supabase.ts                   # Cliente Supabase
├── assets/                           # Imágenes estáticas (logo, etc.)
├── components/
│   ├── layout/                       # MainLayout, Sidebar, Topbar, ProtectedRoute
│   └── ui/                           # DataTable compartido
├── features/
│   ├── dashboard/
│   │   └── services/                 # getDashboardData, getAprobadorData,
│   │                                 # getEvaluadorData, getVisualizadorData,
│   │                                 # getUsuarioData, getProveedorMetricas
│   ├── proyecto/
│   │   ├── components/               # ProyectoModal, ProyectoDeleteDialog, ProyectosTable
│   │   ├── hooks/                    # useProyectos
│   │   ├── services/                 # proyectoService
│   │   └── types/                    # Proyecto
│   ├── proveedor/
│   │   ├── components/               # EncuestaProveedorForm
│   │   ├── services/                 # proveedorService (métricas + encuesta CRUD)
│   │   └── types/                    # Proveedor, ProveedorConMetricas, Encuesta
│   └── solicitud/
│       ├── components/               # SolicitudesTable, SolicitudArchivos (tiposVisibles),
│       │                             # SolicitudModal, RechazoModal, ConfirmModal,
│       │                             # FirmaModal, OrdenCompraPDF, ...
│       ├── constants/                # bancos.ts (lista + helpers CCI/cuenta)
│       ├── hooks/                    # useSolicitudes
│       ├── services/                 # solicitudService (CRUD + flujo), rucService
│       └── types/                    # Solicitud, ROLES, SolicitudFiltros, ...
├── pages/                            # SolicitudesPage, SolicitudDetallePage,
│                                     # SolicitudNuevaPage (4-step wizard),
│                                     # DashboardPage, ProyectosPage, ProveedoresPage
└── store/
    └── authStore.ts                  # Zustand: usuario autenticado + rol
```

## Tablas principales en Supabase

| Tabla | Descripción |
|---|---|
| `solicitud` | Solicitudes de compra / servicio |
| `solicitud_detalle` | Ítems de cada solicitud |
| `solicitud_archivo` | Archivos adjuntos (bucket `solicitud-archivos`) |
| `estado_soli` | Catálogo de estados del flujo |
| `solicitud_tipo` | Tipos de solicitud |
| `solicitud_forma_pago` | Formas de pago seleccionables |
| `proyecto` | Proyectos asociables a solicitudes |
| `usuario` | Perfil extendido 1:1 con auth.users |
| `usuario_rol` | Rol asignado a cada usuario |
| `area_usuario` | Área a la que pertenece cada usuario |
| `proveedor` | Registro de proveedores (indexados por RUC) |
| `encuesta_proveedor` | Encuestas de satisfacción por solicitud |

### Campos de factura en `solicitud`

| Campo | Tipo | Descripción |
|---|---|---|
| `numero_factura` | TEXT | Número de factura (ej: F001-00123) |
| `motivo_factura` | TEXT | Concepto o motivo de la factura |
| `fecha_emision_factura` | DATE | Fecha de emisión de la factura |
| `fecha_vencimiento_factura` | DATE | Fecha de vencimiento de la factura |
