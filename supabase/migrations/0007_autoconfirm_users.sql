-- 0007_autoconfirm_users.sql
-- Auto-confirm new signups at the database level so the app works without
-- requiring SMTP or the "Confirm email" dashboard toggle. New users get
-- email_confirmed_at set on insert, allowing immediate password sign-in.
--
-- Remove this migration (and the trigger) if you enable real email
-- confirmation with an SMTP provider in production.

create or replace function public.auto_confirm_user()
returns trigger
language plpgsql
security definer
set search_path = auth
as $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_autoconfirm on auth.users;
create trigger on_auth_user_autoconfirm
  before insert on auth.users
  for each row execute function public.auto_confirm_user();
