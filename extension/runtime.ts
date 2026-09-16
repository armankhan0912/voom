import type { VoomRuntimeMessage } from "./messages";

export function sendVoomMessage<T = unknown>(message: VoomRuntimeMessage) {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}
