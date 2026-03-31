export async function sendNudgeDM(
  slackUserId: string,
  firstName: string,
  magicLinkUrl: string
): Promise<void> {
  if (!process.env.SLACK_BOT_TOKEN) throw new Error('SLACK_BOT_TOKEN not set')
  const text = `Hey ${firstName} — it's time to complete your People Review. Click here to get started: ${magicLinkUrl}`

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ channel: slackUserId, text }),
  })

  const data = await res.json()
  if (!data.ok) throw new Error(`Slack error: ${data.error}`)
}

export async function sendRetroDM(
  slackUserId: string,
  firstName: string,
  retroUrl: string,
  cycleName: string
): Promise<void> {
  if (!process.env.SLACK_BOT_TOKEN) throw new Error('SLACK_BOT_TOKEN not set')
  const text = `Hey ${firstName} — it's time to complete your ${cycleName} Retro. Take a few minutes to reflect on the quarter: ${retroUrl}`

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ channel: slackUserId, text }),
  })

  const data = await res.json()
  if (!data.ok) throw new Error(`Slack error: ${data.error}`)
}
