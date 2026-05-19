export interface SlackBlock {
  type: string
  text?: {
    type: string
    text: string
  }
  fields?: Array<{
    type: string
    text: string
  }>
}

export interface SlackPayload {
  text: string
  blocks?: SlackBlock[]
}

export async function sendSlackAlert(payload: SlackPayload): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) return

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  } catch {
    console.error("[slack] Failed to send alert")
  }
}
