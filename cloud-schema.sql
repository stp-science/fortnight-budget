-- Dedicated personal project. No browser role can access budget data.
create table public.budget_documents (
 owner text primary key,
 revision integer not null check (revision > 0),
 state jsonb not null,
 updated_at timestamptz not null default now()
);
create table public.budget_history (
 owner text not null,
 revision integer not null,
 state jsonb not null,
 saved_at timestamptz not null default now(),
 primary key (owner, revision)
);
alter table public.budget_documents enable row level security;
alter table public.budget_history enable row level security;
revoke all on public.budget_documents, public.budget_history from public, anon, authenticated;
grant select, insert, update on public.budget_documents to service_role;
grant select, insert on public.budget_history to service_role;

create function public.read_budget(p_owner text) returns jsonb
language sql security invoker set search_path = '' as $$
 select coalesce((select jsonb_build_object('revision',revision,'state',state,'updatedAt',updated_at)
 from public.budget_documents where owner=p_owner),jsonb_build_object('revision',0,'state',null));
$$;
create function public.save_budget(p_owner text,p_revision integer,p_state jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare doc public.budget_documents;
begin
 -- Serialise first saves as well as updates. Revision checks prevent lost edits.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner,0));
 select * into doc from public.budget_documents where owner=p_owner for update;
 if coalesce(doc.revision,0)<>p_revision then
  return jsonb_build_object('conflict',true,'revision',doc.revision,'state',doc.state);
 end if;
 if pg_catalog.octet_length(p_state::text)>2000000 then raise exception 'Budget too large'; end if;
 insert into public.budget_documents(owner,revision,state) values(p_owner,1,p_state)
 on conflict(owner) do update set revision=public.budget_documents.revision+1,state=excluded.state,updated_at=now()
 returning * into doc;
 insert into public.budget_history(owner,revision,state) values(doc.owner,doc.revision,doc.state);
 return jsonb_build_object('revision',doc.revision,'state',doc.state,'updatedAt',doc.updated_at);
end;
$$;
revoke all on function public.read_budget(text),public.save_budget(text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.read_budget(text),public.save_budget(text,integer,jsonb) to service_role;

-- Restrict the optional dashboard-created automatic-RLS event helper.
do $$ begin if pg_catalog.to_regprocedure('public.rls_auto_enable()') is not null then execute 'revoke execute on function public.rls_auto_enable() from public,anon,authenticated'; end if; end $$;
