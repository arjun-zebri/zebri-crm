import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const type = searchParams.get('type') ?? 'file' // 'file' | 'audio'

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  // Validate token
  const { data: couple, error: coupleErr } = await adminClient
    .from('couples')
    .select('id, user_id, portal_token_enabled')
    .eq('portal_token', token)
    .single()

  if (coupleErr || !couple || !couple.portal_token_enabled) {
    return NextResponse.json({ error: 'Invalid or inactive portal link' }, { status: 403 })
  }

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
  const path = `${token}/${fileId}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await adminClient.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: urlData } = adminClient.storage.from(bucket).getPublicUrl(path)
  const publicUrl = urlData.publicUrl

  // For file uploads, also record in portal_files via RPC
  if (type === 'file') {
    await adminClient.rpc('save_portal_file', {
      p_token: token,
      p_id: fileId,
      p_name: file.name,
      p_file_url: publicUrl,
      p_file_size: file.size,
    })
  }

  return NextResponse.json({ url: publicUrl, fileId, name: file.name })
}
