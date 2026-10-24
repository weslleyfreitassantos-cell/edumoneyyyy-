begin;

create or replace function private.psychology_can_access_realtime_topic(target_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_session_text text;
begin
  if auth.uid() is null or not private.is_current_profile_active()
    or target_topic is null
    or split_part(target_topic, ':', 1) <> 'psychology-session' then
    return false;
  end if;

  target_session_text := split_part(target_topic, ':', 2);
  if target_session_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or target_topic <> 'psychology-session:' || target_session_text then
    return false;
  end if;

  return private.psychology_can_access_session(target_session_text::uuid);
end;
$$;

revoke all on function private.psychology_can_access_realtime_topic(text) from public, anon;
grant execute on function private.psychology_can_access_realtime_topic(text) to authenticated, service_role;

drop policy if exists psychology_session_broadcast_read on realtime.messages;
create policy psychology_session_broadcast_read on realtime.messages
  for select to authenticated
  using (
    extension = 'broadcast'
    and private.psychology_can_access_realtime_topic(topic)
  );

create or replace function private.psychology_broadcast_message_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('message_id', new.id),
    'psychology_message',
    'psychology-session:' || new.session_id::text,
    true
  );
  return new;
end;
$$;

revoke all on function private.psychology_broadcast_message_id() from public, anon, authenticated;
drop trigger if exists psychology_message_broadcast_after_insert on public.psychology_messages;
create trigger psychology_message_broadcast_after_insert
  after insert on public.psychology_messages
  for each row execute function private.psychology_broadcast_message_id();

commit;
