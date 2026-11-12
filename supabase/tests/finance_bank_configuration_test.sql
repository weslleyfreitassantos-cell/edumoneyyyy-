-- Execute apenas em banco descartável com a migration aplicada.
begin;
insert into auth.users(id, email) values
 ('10000000-0000-0000-0000-000000000001', 'director-a@example.invalid'),
 ('10000000-0000-0000-0000-000000000002', 'secretary-a@example.invalid'),
 ('10000000-0000-0000-0000-000000000003', 'director-b@example.invalid');
insert into public.profiles(id, full_name, email, role) values
 ('10000000-0000-0000-0000-000000000001', 'Diretor A', 'director-a@example.invalid', 'DIRECTOR'),
 ('10000000-0000-0000-0000-000000000002', 'Secretaria A', 'secretary-a@example.invalid', 'SECRETARY'),
 ('10000000-0000-0000-0000-000000000003', 'Diretor B', 'director-b@example.invalid', 'DIRECTOR');
insert into public.institutions(id, name, plan) values
 ('20000000-0000-0000-0000-000000000001', 'Escola A ficticia', 'PROFESSIONAL'),
 ('20000000-0000-0000-0000-000000000002', 'Escola B ficticia', 'PROFESSIONAL');
insert into public.memberships(profile_id, institution_id, role) values
 ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'DIRECTOR'),
 ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'SECRETARY'),
 ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'DIRECTOR');
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select public.finance_set_bank_configuration('20000000-0000-0000-0000-000000000001', '033', '1234', '123456', '0', '12345', '101');
do $$ begin
 if (public.finance_get_bank_configuration('20000000-0000-0000-0000-000000000001')->>'bank_code') <> '033' then raise exception 'director read failed'; end if;
 begin perform public.finance_get_bank_configuration('20000000-0000-0000-0000-000000000002'); raise exception 'cross-tenant read allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
do $$ begin
 if (public.finance_get_bank_configuration('20000000-0000-0000-0000-000000000001')->>'bank_code') <> '033' then raise exception 'secretary read failed'; end if;
 begin perform public.finance_set_bank_configuration('20000000-0000-0000-0000-000000000001', '237', '1234', '123456', '0', '12345', '101'); raise exception 'secretary write allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
do $$ begin
 begin perform public.finance_get_bank_configuration('20000000-0000-0000-0000-000000000001'); raise exception 'other director read allowed'; exception when insufficient_privilege then null; end;
 begin perform public.finance_set_bank_configuration('20000000-0000-0000-0000-000000000001', '033', '1234', '123456', '0', '12345', '101'); raise exception 'other director write allowed'; exception when insufficient_privilege then null; end;
end $$;
rollback;
