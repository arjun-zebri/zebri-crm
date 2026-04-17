import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://iinwixcgsrqwcpgbfodp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpbndpeGNnc3Jxd2NwZ2Jmb2RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTAzNjIxNywiZXhwIjoyMDkwNjEyMjE3fQ.o6VqnhDisWHQlMj3IXAwjbFyC1Yslu0CNU_jM4piC2k',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const EMAIL = 'apunekar95@gmail.com'
const PLAN  = 'pro' // change to 'max' if needed

const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers()
if (listErr) { console.error(listErr); process.exit(1) }

const user = users.find(u => u.email === EMAIL)
if (!user) { console.error('User not found:', EMAIL); process.exit(1) }

const { error } = await supabase.auth.admin.updateUserById(user.id, {
  user_metadata: {
    ...user.user_metadata,
    subscription_status: 'trialing',
    subscription_plan: PLAN,
    stripe_customer_id: 'cus_sim_placeholder',
    trial_end: trialEnd,
  },
})

if (error) { console.error(error); process.exit(1) }
console.log(`Done — ${EMAIL} is now trialing ${PLAN} until ${trialEnd}`)
