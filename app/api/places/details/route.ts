import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get('place_id')
  if (!placeId) return NextResponse.json({ error: 'No place_id' }, { status: 400 })

  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
      'X-Goog-FieldMask': 'displayName,nationalPhoneNumber,websiteUri,location',
    },
  })

  const data = await res.json()
  return NextResponse.json(data)
}
