-- Rename display labels only. Stable title codes, criteria, ACL and existing awards are unchanged.
do $rename$
declare definition text;
 old_labels constant text := $old$title_label:=case next_title when 'svoya' then 'Своя' when 'active' then 'Активна своя' when 'inspirer' then 'Натхненниця' else 'Амбасадорка' end;$old$;
 new_labels constant text := $new$title_label:=case next_title when 'svoya' then 'Дама' when 'active' then 'Леді' when 'inspirer' then 'Графиня' else 'Княгиня' end;$new$;
begin
 definition:=pg_get_functiondef('svoya_private.set_member_title(uuid,text,text,text)'::regprocedure);
 if (length(definition)-length(replace(definition,old_labels,'')))<>length(old_labels) then
  raise exception 'Unexpected member title function: rename stopped';
 end if;
 execute replace(definition,old_labels,new_labels);
end $rename$;
