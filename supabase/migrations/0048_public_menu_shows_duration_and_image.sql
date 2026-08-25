-- The public service menu gains duration and a photo.
--
-- `0031_service_menu_duration_and_image.sql` added `duration_min` and
-- `image_path` to `service_menu`, for the owner's dashboard preview
-- (`ServicesCatalogue.tsx`). `public_service_menu()` was never updated to
-- expose either one — the marketing rebrand's Gallery and Services pages
-- need both: a real duration instead of a price (docs/PRD.md §7: "no fixed
-- price... what it costs is agreed in the chair"), and the owner's uploaded
-- photo once she has added one, falling back to a placeholder in the
-- frontend until she does.

create or replace function public.public_service_menu()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(g order by g->>'sort_order', g->>'group_name'),
    '[]'::jsonb
  )
  from (
    select jsonb_build_object(
             'group_name', group_name,
             'sort_order', lpad(min(sort_order)::text, 6, '0'),
             'items', jsonb_agg(
                        jsonb_build_object(
                          'name', name,
                          'note', note,
                          'duration_min', duration_min,
                          'image_path', image_path
                        )
                        order by sort_order, name)
           ) as g
      from public.service_menu
     where active
     group by group_name
  ) grouped;
$$;

grant execute on function public.public_service_menu() to anon, authenticated;
