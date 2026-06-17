import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Lazy service-role Supabase client.
 *
 * Constructing at module top throws when env vars are missing (e.g.
 * Next's "collect page data" build step in CI). The lazy singleton
 * lets the module import cleanly in any environment and only requires
 * the keys when an upload actually arrives — runtime behaviour
 * unchanged.
 */
let _adminClient: SupabaseClient | undefined
function adminClient(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _adminClient
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const type = searchParams.get('type') ?? 'file' // 'file' | 'audio'

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  // Validate token. Either partner's link is accepted: the primary's
  // `portal_token` or the secondary's `secondary_portal_token`. We then
  // pin all storage/RPC writes to the canonical `portal_token` so every
  // file for a couple lives under one folder regardless of who uploaded.
  const { data: couple, error: coupleErr } = await adminClient()
    .from('couples')
    .select('id, user_id, portal_token, portal_token_enabled')
    .or(`portal_token.eq.${token},secondary_portal_token.eq.${token}`)
    .single()

  if (coupleErr || !couple || !couple.portal_token_enabled) {
    return NextResponse.json({ error: 'Invalid or inactive portal link' }, { status: 403 })
  }

  const canonicalToken = couple.portal_token

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg']
  const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
  const MIME_TO_EXT: Record<string, string> = {
    'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/wav': 'wav', 'audio/webm': 'webm', 'audio/ogg': 'ogg',
    'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic',
  }

  const allowed = type === 'audio' ? ALLOWED_AUDIO_TYPES : ALLOWED_FILE_TYPES
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
  }

  const bucket = type === 'audio' ? 'portal-audio' : 'portal-files'
  const maxSize = type === 'audio' ? 10 * 1024 * 1024 : 20 * 1024 * 1024

  if (file.size > maxSize) {
    const mb = maxSize / 1024 / 1024
    return NextResponse.json({ error: `File must be under ${mb}MB` }, { status: 400 })
  }

  const ext = MIME_TO_EXT[file.type] ?? 'bin'
  const fileId = crypto.randomUUID()
  const path = `${canonicalToken}/${fileId}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await adminClient().storage
    .from(bucket)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: urlData } = adminClient().storage.from(bucket).getPublicUrl(path)
  const publicUrl = urlData.publicUrl

  // For file uploads, also record in portal_files via RPC
  if (type === 'file') {
    await adminClient().rpc('save_portal_file', {
      p_token: canonicalToken,
      p_id: fileId,
      p_name: file.name,
      p_file_url: publicUrl,
      p_file_size: file.size,
    })
  }

  return NextResponse.json({ url: publicUrl, fileId, name: file.name })
}
