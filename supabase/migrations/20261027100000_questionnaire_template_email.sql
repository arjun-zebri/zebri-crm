-- Questionnaire templates choose the email they are sent with.
--
-- Until now every questionnaire went out in one fixed email ("<business>
-- sent you a few questions"). An MC can now pick one of their own email
-- templates on the questionnaire template; the manual Send button, the
-- resend, and workflow "Send questionnaire" steps all use it. Null keeps
-- the standard email.
--
-- `on delete set null`: deleting the email template quietly returns the
-- questionnaire to the standard email instead of blocking the delete.
--
-- Ownership: a foreign key ignores RLS, so `user_id = auth.uid()` alone
-- would let a client point its own template at another account's email
-- template id. The write check now also requires the email template to
-- belong to the caller. Reads are unchanged, and the senders load the
-- email template scoped to the questionnaire's owner as well.
--
-- Not destructive: adds a nullable column and an index, and replaces one
-- policy with a stricter version of itself.

alter table public.questionnaire_templates
  add column if not exists email_template_id uuid
    references public.email_templates(id) on delete set null;

comment on column public.questionnaire_templates.email_template_id is
  'The MC''s email template sent with this questionnaire (manual send, resend, workflow step). Null = the standard questionnaire email.';

create index if not exists questionnaire_templates_email_template_id_idx
  on public.questionnaire_templates(email_template_id);

drop policy if exists "Users manage own questionnaire_templates" on public.questionnaire_templates;
create policy "Users manage own questionnaire_templates" on public.questionnaire_templates
  for all
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      email_template_id is null
      or exists (
        select 1 from public.email_templates e
        where e.id = email_template_id
          and e.user_id = (select auth.uid())
      )
    )
  );
