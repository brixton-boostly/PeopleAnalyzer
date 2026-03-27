import { WebClient } from '@slack/web-api'

const slack = new WebClient(process.env.SLACK_BOT_TOKEN)

export async function sendNudgeDM(
  slackUserId: string,
  firstName: string,
  magicLinkUrl: string
): Promise<void> {
  await slack.chat.postMessage({
    channel: slackUserId,
    text: `Hey ${firstName} — it's time to complete your People Review. Click here to get started: ${magicLinkUrl}`,
  })
}
