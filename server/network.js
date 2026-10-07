import { readFileSync } from "node:fs";

// Read managed policy only. Network access must be changed through environment settings.
export function openAIBlockedReason(path = "/etc/codex/network-policy.json") {
  try {
    const policy = JSON.parse(readFileSync(path, "utf8")).http_network_policy;
    if (policy?.type === "unrestricted") return null;
    if (policy?.type !== "restricted")
      return "Live AI is unavailable because the environment network policy could not be verified.";
    const allowed = policy.egress_rules?.some(
      ({ host }) => host === "api.openai.com" || host === "*.openai.com",
    );
    return allowed
      ? null
      : "Live AI is blocked by this environment's network settings. Allow api.openai.com and restart the app. Local commands remain available.";
  } catch (error) {
    if (error.code === "ENOENT") return null;
    return "Live AI is unavailable because the environment network policy could not be read.";
  }
}
