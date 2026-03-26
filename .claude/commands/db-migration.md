---
description: Write a Supabase schema migration following Zebri database conventions
---

@.claude/docs/database-schema.md
@.claude/docs/authentication.md

You are writing a database migration for Zebri CRM. Follow these rules exactly:

## Migration File Naming
```
YYYYMMDD_description.sql
```
Example: `20260326_add_vendor_notes.sql`

## Every Table Must Have
```sql
id          uuid primary key default gen_random_uuid(),
user_id     uuid not null references auth.users(id) on delete cascade,
created_at  timestamptz not null default now()
```

## Column Rules
- snake_case column names only
- Never rename existing columns (break API contracts)
- Add `NOT NULL` with a default where possible
- Use `text` over `varchar` for strings

## RLS — Required on Every New Table
```sql
alter table [table_name] enable row level security;

create policy "[table_name]_user_isolation" on [table_name]
  for all using (auth.uid() = user_id);
```

## Index Recommendations
- Foreign keys should have an index: `create index on [table] ([fk_col]);`
- Columns used in WHERE filters: add index if table will grow large

## After Writing the Migration
- [ ] Update `.claude/docs/database-schema.md` with the new table/columns
- [ ] Confirm RLS is enabled
- [ ] Check if any TypeScript types need updating

## Checklist Before Writing
- [ ] Does this table already exist? Check database-schema.md first
- [ ] Are all column names snake_case?
- [ ] Does it include id, user_id, created_at?
- [ ] Does it have RLS?

Now write the migration: $ARGUMENTS
