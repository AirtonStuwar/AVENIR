# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server with HMR
npm run build      # TypeScript check + Vite production build
npm run lint       # Run ESLint
npm run preview    # Preview production build locally
```

No test framework is configured.

## Architecture

**Stack:** React 19 + TypeScript, Vite, React Router v7, Zustand, Tailwind CSS v4, Supabase (auth + database), lucide-react, react-hot-toast.

**Feature-driven structure:** Code is organized under `src/features/<domain>/` — each domain contains `components/`, `services/`, `hooks/`, and `types/` subfolders. Pages live in `src/pages/` and are thin route-level components. Layout shells (`MainLayout`, `Sidebar`, `Topbar`, `ProtectedRoute`) are in `src/components/layout/`.

**Authentication & roles:** Supabase Auth (email/password). On login, `authStore.ts` (Zustand) calls `fetchUserRole()` which queries the `usuario_rol` table to get a numeric role ID (1=Gerencia, 2=Admin, 3=Contabilidad). The role gates sidebar items and dashboard panels. `ProtectedRoute` redirects unauthenticated users to `/login`. The store also listens to `onAuthStateChange` for session refresh/logout.

**Data access pattern:** Feature-level service files (`*Service.ts`) wrap Supabase queries. Custom hooks (`useSolicitudes`, `useProyectos`) own local state for pagination and filters, call the services, and expose data + handlers to page components.

**Routing** (`App.tsx`):
- `/login` — public
- `/dashboard`, `/solicitudes`, `/solicitudes/nueva`, `/solicitudes/:id`, `/proyectos`, `/proveedores` — all behind `ProtectedRoute`
- Catch-all redirects to `/dashboard`

**Key Supabase tables:** `usuario_rol`, `solicitud`, `solicitud_detalle`, `solicitud_tipo`, `estado_soli`, `proyecto`.

**Env vars** (`.env.local`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Supabase client is initialized in `src/api/supabase.ts`.

**TypeScript config:** strict mode with `noUnusedLocals` and `noUnusedParameters` enabled — unused variables will cause build errors.
