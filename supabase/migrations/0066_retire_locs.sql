-- The salon does not do locs.
--
-- `0018` seeded a "Twists and locs" group holding five twist styles and five
-- loc styles. The loc half was never a service the owner offers, and it has
-- been advertised on the marketing site, in the structured data, on the Google
-- profile and in the AI assistant's own grounding prompt since launch. A
-- customer booking on the strength of it arrives for something Christy does not
-- do, which is worse than any missed search.
--
-- Deactivated rather than deleted. `service_menu.active` is the flag the
-- console and every public surface already read, so `active = false` removes
-- them everywhere in one step and is reversible from the dashboard if this
-- turns out to be wrong. Deleting the rows would also take their `image_path`
-- with them, and those photographs are real work.
--
-- The five twist styles stay. Twists are not locs, and she does them.

update public.service_menu
set active = false,
    updated_at = now()
where group_name = 'Twists and locs'
  and name in (
    'Faux locs',
    'Butterfly locs',
    'Soft locs',
    'Starter locs',
    'Loc retwist and styling'
  );

-- The group name has to follow, or a menu of five twist styles still announces
-- itself as a loc service.
update public.service_menu
set group_name = 'Twists',
    updated_at = now()
where group_name = 'Twists and locs';
