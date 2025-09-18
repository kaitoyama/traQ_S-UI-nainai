import type {
  ChannelEvent,
  ChannelEventTypeEnum,
  ChildCreatedEvent,
  ForcedNotificationChangedEvent,
  NameChangedEvent,
  ParentChangedEvent,
  PinAddedEvent,
  PinRemovedEvent,
  Session,
  SubscribersChangedEvent,
  TopicChangedEvent,
  VisibilityChangedEvent
} from '@traptitech/traq'
import { Apis, Configuration } from '@traptitech/traq'
import type { FileId } from '/@/types/entity-ids'
import { DEV_SERVER } from '/@/lib/define'
import type { AxiosError } from 'axios'
import { constructFilesPath } from '/@/lib/routerPaths'
import {
  DEFAULT_API_BASE_URL,
  DEFAULT_AUTH_BASE_URL
} from '/@/lib/constants/endpoints'

const isAbsoluteUrl = (value: string) =>
  /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value)

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')
const trimLeadingSlash = (value: string) => value.replace(/^\/+/, '')

const ensureLeadingSlash = (value: string) =>
  value.startsWith('/') ? value : `/${value}`

const normalizeBaseUrl = (value: string, fallback: string) => {
  const trimmed = trimTrailingSlash(value.trim())
  if (trimmed === '') return fallback
  if (isAbsoluteUrl(trimmed)) return trimmed
  return ensureLeadingSlash(trimmed)
}

const joinUrl = (base: string, path: string) => {
  const normalizedBase = trimTrailingSlash(base)
  const normalizedPath = trimLeadingSlash(path)
  if (!normalizedBase) return `/${normalizedPath}`
  return `${normalizedBase}/${normalizedPath}`
}

export const API_BASE_URL = normalizeBaseUrl(
  (import.meta.env['VITE_TRAQ_API_BASE_URL'] as string | undefined) ??
    DEFAULT_API_BASE_URL,
  normalizeBaseUrl(DEFAULT_API_BASE_URL, DEFAULT_API_BASE_URL)
)

export const AUTH_BASE_URL = normalizeBaseUrl(
  (import.meta.env['VITE_TRAQ_AUTH_BASE_URL'] as string | undefined) ??
    DEFAULT_AUTH_BASE_URL,
  normalizeBaseUrl(DEFAULT_AUTH_BASE_URL, DEFAULT_AUTH_BASE_URL)
)

const withApiBase = (path: string) => joinUrl(API_BASE_URL, path)
const withAuthBase = (path: string) => joinUrl(AUTH_BASE_URL, path)

export type { Session as WebRTCUserStateSessions }

export const BASE_PATH = API_BASE_URL
export const WEBSOCKET_ENDPOINT = withApiBase('ws')

const apis = new Apis(
  new Configuration({
    basePath: BASE_PATH,
    baseOptions: {
      withCredentials: true
    }
  })
)

export default apis

export const embeddingOrigin =
  DEV_SERVER !== '' &&
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? DEV_SERVER
    : `${location.protocol}//${location.host}`

const ensureAbsoluteFromAppOrigin = (path: string) =>
  isAbsoluteUrl(path) ? path : `${embeddingOrigin}${path}`

export const buildFilePath = (fileId: FileId, withDlParam = false) => {
  const base = withApiBase(`files/${fileId}`)
  return withDlParam ? `${base}?dl=1` : base
}

export const buildUserIconPath = (userIconFileId: FileId) =>
  withApiBase(`files/${userIconFileId}`)

export const buildFileThumbnailPath = (fileId: FileId) =>
  withApiBase(`files/${fileId}/thumbnail`)

export const buildFileWaveformPath = (fileId: FileId) =>
  `${buildFileThumbnailPath(fileId)}?type=waveform`

export const buildFilePathForPost = (fileId: FileId) =>
  `${embeddingOrigin}${constructFilesPath(fileId)}`

/**
 * アイコンが変わったあとにすぐに変わらないので
 * 使える場合は`buildUserIconPath`を優先して使う
 */
export const buildUserIconPathPublic = (username: string) =>
  ensureAbsoluteFromAppOrigin(withApiBase(`public/icon/${username}`))

export const OAuthDecidePath = withApiBase('oauth2/authorize/decide')

export const buildAuthProviderUrl = (provider: string) =>
  withAuthBase(provider)

export const buildApiUrl = (path: string) => withApiBase(path)

/**
 * サーバーでの処理が必要なURLかどうかを判定する
 *
 * 例えば、`/api/v3/oauth2/authorize`は`router.replace`ではなくサーバーへのGETが必要
 * ([詳細](https://github.com/traPtitech/traQ/pull/1413))
 *
 * @param url 判定するURL (相対URLだった場合はlocation.hrefをbaseとして絶対URLに変換して判定する)
 */
const oauthAuthorizeUrl = withApiBase('oauth2/authorize')

export const isServerRequestUrl = (url: string) => {
  try {
    const targetUrl = new URL(url, location.href)
    const authorizeUrl = new URL(oauthAuthorizeUrl, location.href)
    if (
      targetUrl.origin === authorizeUrl.origin &&
      targetUrl.pathname === authorizeUrl.pathname
    ) {
      return true
    }
  } catch {}
  return false
}

export const formatResizeError = (e: unknown, defaultMessage: string) => {
  if (typeof e === 'string') return e

  if (typeof e !== 'object' || e === null) return defaultMessage
  if (!('response' in e)) return defaultMessage

  const response = (e as AxiosError<{ message: string }>).response
  if (!response) return defaultMessage

  const message = response.data.message
  if (message === 'too large image') {
    return '画像が大きすぎます'
  }
  if (message === 'bad image') {
    return '不正な画像です'
  }
  return defaultMessage
}

type BaseChannelEvent<Type, Detail> = {
  type: Type
  datetime: string
  detail: Detail
}

export type ParsedChannelEvent =
  | BaseChannelEvent<
      typeof ChannelEventTypeEnum.TopicChanged,
      TopicChangedEvent
    >
  | BaseChannelEvent<
      typeof ChannelEventTypeEnum.SubscribersChanged,
      SubscribersChangedEvent
    >
  | BaseChannelEvent<typeof ChannelEventTypeEnum.PinAdded, PinAddedEvent>
  | BaseChannelEvent<typeof ChannelEventTypeEnum.PinRemoved, PinRemovedEvent>
  | BaseChannelEvent<typeof ChannelEventTypeEnum.NameChanged, NameChangedEvent>
  | BaseChannelEvent<
      typeof ChannelEventTypeEnum.ParentChanged,
      ParentChangedEvent
    >
  | BaseChannelEvent<
      typeof ChannelEventTypeEnum.VisibilityChanged,
      VisibilityChangedEvent
    >
  | BaseChannelEvent<
      typeof ChannelEventTypeEnum.ForcedNotificationChanged,
      ForcedNotificationChangedEvent
    >
  | BaseChannelEvent<
      typeof ChannelEventTypeEnum.ChildCreated,
      ChildCreatedEvent
    >

export const parseChannelEvent = (event: ChannelEvent): ParsedChannelEvent =>
  event as ParsedChannelEvent
