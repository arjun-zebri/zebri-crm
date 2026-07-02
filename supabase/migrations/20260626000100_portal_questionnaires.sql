-- Surface a couple's questionnaires on the client portal.
--
-- A dedicated read RPC rather than extending get_portal_data: it keeps the
-- large portal payload untouched and lets the portal page fetch questionnaires
-- in a single extra call. Returns only sent/completed questionnaires (drafts
-- stay private to the MC). Token-gated via the shared _resolve_portal_couple
-- helper, so it honours both the primary and secondary partner tokens.

create or replace function get_portal_questionnaires(token uuid)
returns json language sql security definer stable as $$
  select coalesce(
    (
      select json_agg(
        json_build_object(
          'id', q.id,
          'title', q.title,
          'status', q.status,
          'share_token', q.share_token,
          'share_token_enabled', q.share_token_enabled,
          'sent_at', q.sent_at,
          'completed_at', q.completed_at
        )
        order by q.created_at desc
      )
      from couple_questionnaires q
      join _resolve_portal_couple(token) rc on rc.couple_id = q.couple_id
      where q.status in ('sent', 'completed')
        and q.share_token_enabled = true
    ),
    '[]'::json
  );
$$;

grant execute on function get_portal_questionnaires(uuid) to anon;
