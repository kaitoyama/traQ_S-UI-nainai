import type { Message } from '@traptitech/traq'
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { MessageId } from '/@/types/entity-ids'
import {
  classifyMessageContent,
  type GroqMessageClassification
} from '/@/lib/groqMessageClassifier'

const parseThreshold = () => {
  const raw = import.meta.env.VITE_GROQ_SANITY_THRESHOLD
  const parsed = raw ? Number(raw) : NaN
  if (Number.isFinite(parsed)) {
    return Math.min(Math.max(parsed, 0), 1)
  }
  return 0.7
}

const SANITY_THRESHOLD = parseThreshold()

export const useMessageFilterStore = defineStore('domain/messageFilter', () => {
  const visibilityMap = ref(new Map<MessageId, boolean>())
  const classificationMap = ref(new Map<MessageId, GroqMessageClassification>())
  const inflightMap = new Map<MessageId, Promise<boolean>>()

  const isEnabled = computed(() => Boolean(import.meta.env.VITE_GROQ_API_KEY))

  const evaluateMessage = async (message: Message): Promise<boolean> => {
    const cached = visibilityMap.value.get(message.id)
    if (cached !== undefined) {
      return cached
    }

    const inflight = inflightMap.get(message.id)
    if (inflight) {
      return inflight
    }

    const promise = (async () => {
      if (!isEnabled.value) {
        visibilityMap.value.set(message.id, true)
        return true
      }

      const classification = await classifyMessageContent(message.content)
      if (!classification) {
        visibilityMap.value.set(message.id, true)
        return true
      }

      classificationMap.value.set(message.id, classification)

      const visible =
        classification.sanityScore < SANITY_THRESHOLD &&
        !classification.isWorkRelated

      visibilityMap.value.set(message.id, visible)
      return visible
    })()

    inflightMap.set(message.id, promise)
    try {
      return await promise
    } finally {
      inflightMap.delete(message.id)
    }
  }

  const filterVisibleMessages = async (messages: Message[]) => {
    if (!isEnabled.value) {
      return messages
    }

    const results = await Promise.all(
      messages.map(async message => ({
        message,
        visible: await evaluateMessage(message)
      }))
    )

    return results.filter(result => result.visible).map(result => result.message)
  }

  const isMessageVisible = (messageId: MessageId) =>
    visibilityMap.value.get(messageId)

  return {
    isEnabled,
    evaluateMessage,
    filterVisibleMessages,
    isMessageVisible,
    classificationMap
  }
})
