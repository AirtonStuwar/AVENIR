-- Rol nuevo "Finanzas" (id 12): SOLO LECTURA (2026-11)
-- Ve Ingreso, Finanzas, Status de Proyecto, Reportes, Areas, Conciliacion bancaria, Plan Contable y las listas/detalles de Egreso,
-- pero NO puede pagar, aprobar, evaluar, crear, editar ni borrar nada.
--
-- Por que una funcion aparte: es_rol_privilegiado() (roles 1,8,9,10) se usa tanto en las reglas de LECTURA como en las de
-- ESCRITURA (insert/update/delete). Si el rol 12 se agregara ahi, podria modificar registros. Por eso se crea es_rol_lectura()
-- y se agrega SOLO a las reglas de lectura (SELECT). Las de escritura no se tocan: el rol 12 queda fuera de ellas.
-- Pegar completo en el SQL Editor de Supabase.

-- 1) El rol
insert into public.roles (id, nombre, descripcion)
values (12, 'Finanzas', 'Solo lectura: Ingreso, Finanzas, Status de Proyecto, Reportes, Areas, Conciliacion y Plan Contable')
on conflict (id) do nothing;

-- 2) Funcion de solo lectura (misma forma que es_rol_privilegiado)
create or replace function public.es_rol_lectura()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (select 1 from public.usuario_rol where usuario = auth.uid() and rol = 12);
$function$;

revoke all on function public.es_rol_lectura() from public, anon;
grant execute on function public.es_rol_lectura() to authenticated;

-- 3) Agregar el rol 12 a las reglas de LECTURA que hoy usan es_rol_privilegiado()
--    (solicitud y su detalle/archivos/pagos, A Rendir, Reembolso, Caja Chica, Devolucion, Cobranza, Conciliacion, Bitacora).
--    No toca las reglas de insert/update/delete. Se salta lo que no se usa (caja_chica_correlativo_inicial, mobysuite_cuota).
do $$
declare
  r record;
  nuevo text;
  n int := 0;
begin
  for r in
    select tablename, policyname, qual
    from pg_policies
    where schemaname = 'public' and cmd = 'SELECT'
      and qual ilike '%es_rol_privilegiado()%'
      and qual not ilike '%es_rol_lectura()%'
      and tablename not in ('caja_chica_correlativo_inicial', 'mobysuite_cuota')
  loop
    nuevo := replace(r.qual, 'es_rol_privilegiado()', '(es_rol_privilegiado() OR es_rol_lectura())');
    execute format('alter policy %I on public.%I using (%s)', r.policyname, r.tablename, nuevo);
    n := n + 1;
  end loop;
  raise notice 'Reglas de lectura actualizadas: %', n;
end $$;

-- 4) La funcion de Finanzas (egresos) tambien acepta el rol 12
do $$
declare
  def text;
  nueva text;
begin
  def := pg_get_functiondef('public.get_finanzas_egresos(date,date)'::regprocedure);
  nueva := replace(def, 'ur.rol in (1, 9)', 'ur.rol in (1, 9, 12)');
  if nueva = def then
    raise exception 'No se encontro la validacion de roles en get_finanzas_egresos; revisar a mano';
  end if;
  execute nueva;
end $$;
