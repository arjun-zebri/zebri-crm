import { NextResponse, type NextRequest } from "next/server"
import { sendSlackAlert, type SlackPayload } from "@/lib/slack"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SlackPayload
    await sendSlackAlert(body)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}
