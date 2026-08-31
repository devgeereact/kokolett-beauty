-- Catch any loc service that `0066` missed, and stop new ones being added blind.
--
-- `0066` deactivated five rows by exact name inside the group "Twists and locs",
-- then renamed that group to "Twists". Both `group_name` and `name` are
-- owner-editable from the Services console, so the two statements could
-- disagree: if a row had been renamed at any point (say "Soft locs" to "Soft
-- locs (medium)"), the first statement would not have matched it, while the
-- second still moved it into a group now called "Twists". The result is a loc
-- service, still `active`, filed under a name that reads as safe, and
-- `public_service_menu()` selects `where active`, so it would go straight back
-- onto the marketing site.
--
-- This is a net rather than a repeat: it matches on the word instead of on five
-- exact strings, so it also catches a spelling `0066` never knew about.
-- Idempotent, and a no-op today.

update public.service_menu
set active = false,
    updated_at = now()
where active
  and name ~* '(^|[^a-z])locs?([^a-z]|$)';

-- Same reasoning for the group name, in case a group is ever re-created.
update public.service_menu
set group_name = 'Twists',
    updated_at = now()
where group_name ~* '(^|[^a-z])locs?([^a-z]|$)';
