alter table public.teams
  drop constraint if exists teams_name_key;

do $$
declare
  duplicate_name_index record;
begin
  for duplicate_name_index in
    select format('%I.%I', namespace_name.nspname, index_name.relname) as qualified_name
    from pg_index index_definition
    inner join pg_class table_name
      on table_name.oid = index_definition.indrelid
    inner join pg_namespace table_namespace
      on table_namespace.oid = table_name.relnamespace
    inner join pg_class index_name
      on index_name.oid = index_definition.indexrelid
    inner join pg_namespace namespace_name
      on namespace_name.oid = index_name.relnamespace
    left join pg_constraint constraint_name
      on constraint_name.conindid = index_definition.indexrelid
    where table_namespace.nspname = 'public'
      and table_name.relname = 'teams'
      and index_definition.indisunique = true
      and constraint_name.oid is null
      and pg_get_indexdef(index_definition.indexrelid) like '%(name)%'
  loop
    execute format('drop index if exists %s', duplicate_name_index.qualified_name);
  end loop;
end $$;
