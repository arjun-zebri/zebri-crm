import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const input = req.nextUrl.searchParams.get('input')
  if (!input || input.trim().length < 2) return NextResponse.json({ suggestions: [] })

  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
    },
    body: JSON.stringify({
      input,
      includedPrimaryTypes: ['establishment'],
      includedRegionCodes: ['au'],
    }),
  })

  const data = await res.json()
  if (!res.ok || data.error) {
    console.error('[places/autocomplete]', data.error ?? data)
  }
  return NextResponse.json(data)
}
