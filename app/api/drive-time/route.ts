import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const originLat = req.nextUrl.searchParams.get('origin_lat')
  const originLng = req.nextUrl.searchParams.get('origin_lng')
  const destLat = req.nextUrl.searchParams.get('dest_lat')
  const destLng = req.nextUrl.searchParams.get('dest_lng')

  if (!originLat || !originLng || !destLat || !destLng) {
    return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 })
  }

  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
      'X-Goog-FieldMask': 'routes.duration',
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: parseFloat(originLat), longitude: parseFloat(originLng) } } },
      destination: { location: { latLng: { latitude: parseFloat(destLat), longitude: parseFloat(destLng) } } },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
    }),
  })

  const data = await res.json()
  if (!res.ok || data.error) {
    console.error('[drive-time]', data.error ?? data)
    return NextResponse.json({ error: 'Failed to compute route' }, { status: 500 })
  }

  const durationStr: string = data.routes?.[0]?.duration ?? '0s'
  const duration_seconds = parseInt(durationStr.replace('s', ''), 10)

  return NextResponse.json({ duration_seconds })
}
