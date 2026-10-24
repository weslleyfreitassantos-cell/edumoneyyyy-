-- The psychologist role is institution-scoped through memberships. Existing
-- profiles keep their other institution roles and no role is reassigned here.
alter type public.user_role add value if not exists 'PSYCHOLOGIST';
