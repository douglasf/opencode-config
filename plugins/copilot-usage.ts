import type { Plugin } from "@opencode-ai/plugin"
import { readFileSync, existsSync } from "fs"
import { join } from "path"

/**
 * Monitors GitHub Copilot premium request consumption.
 * Shows remaining quota via toast on session start and after each task.
 */
export const CopilotUsagePlugin: Plugin = async ({ client }) => {
  const COPILOT_APP_ID = "Iv23ctfURkiMfJ4xr5mv"
  const APPS_PATH = join(process.env.HOME!, ".config/github-copilot/apps.json")

  let previousRemaining: number | null = null

  const getOAuthToken = (): string | null => {
    if (!existsSync(APPS_PATH)) return null

    try {
      const apps = JSON.parse(readFileSync(APPS_PATH, "utf-8"))
      const app = Object.values(apps).find(
        (a: any) => a.githubAppId === COPILOT_APP_ID
      ) as { oauth_token?: string } | undefined
      return app?.oauth_token ?? null
    } catch {
      return null
    }
  }

  const fetchUsage = async (token: string) => {
    const response = await fetch("https://api.github.com/copilot_internal/user", {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) throw new Error(`API request failed: ${response.status}`)
    return response.json()
  }

  const showQuotaToast = async () => {
    const token = getOAuthToken()
    if (!token) return

    try {
      const data = await fetchUsage(token)
      const quota = data.quota_snapshots?.premium_interactions
      if (!quota) return

      const remaining = quota.remaining
      const entitlement = quota.entitlement

      // Show consumed count if requests were used since last check
      let message: string
      if (previousRemaining !== null && remaining < previousRemaining) {
        const consumed = previousRemaining - remaining
        message = `-${consumed} | ${remaining}/${entitlement}`
      } else {
        message = `${remaining}/${entitlement} premium`
      }

      await client.tui.showToast({
        body: { message, variant: "info" },
      })

      previousRemaining = remaining
    } catch {
      // Silently fail - don't interrupt the user
    }
  }

  return {
    event: async ({ event }) => {
      if (event.type === "session.created" || event.type === "session.idle") {
        await showQuotaToast()
      }
    },
  }
}