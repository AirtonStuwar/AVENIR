-- Caja Chica: anexos al documento sustento (2026-11)
-- El dueño (o un ADMIN) puede AGREGAR documentos anexos en cualquier estado menos Rechazado/Cancelado,
-- sin tocar el sustento original. Un anexo no se edita; solo un ADMIN puede borrarlo (queda en la Bitacora).
-- Pegar completo en el SQL Editor de Supabase.

create table if not exists public.caja_chica_anexo (
  id bigint generated always as identity primary key,
  caja_chica_id integer not null references public.caja_chica(id) on delete cascade,
  archivo_path text not null,
  nombre_archivo text,
  usuario_id uuid not null default auth.uid(),
  fecha_creacion timestamptz not null default now()
);
create index if not exists caja_chica_anexo_caja_idx on public.caja_chica_anexo(caja_chica_id);

alter table public.caja_chica_anexo enable row level security;

-- Ver: quien puede ver la caja chica (el responsable o un rol privilegiado; la RLS de caja_chica aplica dentro del EXISTS)
drop policy if exists caja_chica_anexo_select on public.caja_chica_anexo;
create policy caja_chica_anexo_select on public.caja_chica_anexo for select to authenticated
  using (exists (select 1 from public.caja_chica c where c.id = caja_chica_anexo.caja_chica_id));

-- Agregar: el responsable de la caja o un ADMIN, en cualquier estado salvo Rechazado/Cancelado, siempre a nombre propio
drop policy if exists caja_chica_anexo_insert on public.caja_chica_anexo;
create policy caja_chica_anexo_insert on public.caja_chica_anexo for insert to authenticated
  with check (
    usuario_id = auth.uid()
    and exists (
      select 1 from public.caja_chica c
      where c.id = caja_chica_anexo.caja_chica_id
        and c.estado not in ('Rechazado', 'Cancelado')
        and (c.responsable_id = auth.uid()
             or exists (select 1 from public.usuario_rol ur where ur.usuario = auth.uid() and ur.rol = 1))
    )
  );

-- Borrar: solo ADMIN. No hay policy de UPDATE: un anexo no se edita.
drop policy if exists caja_chica_anexo_delete on public.caja_chica_anexo;
create policy caja_chica_anexo_delete on public.caja_chica_anexo for delete to authenticated
  using (exists (select 1 from public.usuario_rol ur where ur.usuario = auth.uid() and ur.rol = 1));

grant select, insert, delete on public.caja_chica_anexo to authenticated;

-- Bitacora: un evento por cada anexo agregado o eliminado (un fallo nunca bloquea la operacion)
create or replace function public.fn_bitacora_caja_chica_anexo()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  begin
    if TG_OP = 'INSERT' then
      insert into public.bitacora_evento (modulo, registro_id, tipo, usuario_id, fecha, detalle, origen)
      values ('caja_chica', NEW.caja_chica_id, 'anexo', NEW.usuario_id, now(), coalesce(NEW.nombre_archivo, 'Anexo'), 'trigger');
      return NEW;
    else
      insert into public.bitacora_evento (modulo, registro_id, tipo, usuario_id, fecha, detalle, origen)
      values ('caja_chica', OLD.caja_chica_id, 'anexo_eliminado', auth.uid(), now(), coalesce(OLD.nombre_archivo, 'Anexo'), 'trigger');
      return OLD;
    end if;
  exception when others then
    if TG_OP = 'INSERT' then return NEW; else return OLD; end if;
  end;
end;
$function$;

drop trigger if exists trg_bitacora_caja_chica_anexo_ins on public.caja_chica_anexo;
create trigger trg_bitacora_caja_chica_anexo_ins after insert on public.caja_chica_anexo
  for each row execute function public.fn_bitacora_caja_chica_anexo();
drop trigger if exists trg_bitacora_caja_chica_anexo_del on public.caja_chica_anexo;
create trigger trg_bitacora_caja_chica_anexo_del after delete on public.caja_chica_anexo
  for each row execute function public.fn_bitacora_caja_chica_anexo();

revoke all on function public.fn_bitacora_caja_chica_anexo() from public, anon, authenticated;
