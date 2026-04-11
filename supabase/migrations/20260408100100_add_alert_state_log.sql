-- Phase 2: Alert state transition logging
-- Tracks status changes on the alerts table for audit and debugging.

create table public.alert_state_log (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts(id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null
);

alter table public.alert_state_log enable row level security;

-- Users can see state history for their own alerts
create policy "Users can view own alert state log"
  on public.alert_state_log for select
  to authenticated
  using (
    exists (
      select 1 from public.alerts
      where alerts.id = alert_state_log.alert_id
        and alerts.user_id = auth.uid()
    )
  );

create policy "Service role can manage alert state log"
  on public.alert_state_log for all
  to service_role using (true);

create index idx_alert_state_log_alert_id
  on public.alert_state_log (alert_id, changed_at desc);

-- ── Trigger: auto-log status changes on alerts ──────────────────

create or replace function public.log_alert_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.alert_state_log (alert_id, old_status, new_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger trg_alert_status_change
  after update of status on public.alerts
  for each row
  execute function public.log_alert_status_change();
