import { setCacheNameDetails } from 'workbox-core'
import { buildApiUrl } from '/@/lib/apis'
import {
  precacheAndRoute,
  createHandlerBoundToURL,
  cleanupOutdatedCaches
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

/**
 * workbox設定
 */
export const setupWorkbox = () => {
  setCacheNameDetails({ prefix: 'traQ_S' })

  const escapeRegExp = (value: string) =>
    value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

  const buildPathname = (path: string) =>
    new URL(path, self.location.href).pathname.replace(/\/+$/, '')

  const apiBasePath = buildPathname(buildApiUrl(''))
  const filesPathPrefix = buildPathname(buildApiUrl('files/'))
  const uuidPattern = '[0-9a-fA-F-]{36}'

  /* アップデート */
  self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      self.skipWaiting()
    }
  })

  /* ルーティングのキャッシュ関係 */
  cleanupOutdatedCaches()
  // 静的ファイルのprecache
  precacheAndRoute(self.__WB_MANIFEST)

  registerRoute(
    new RegExp('/assets/.+\\.mp3$'),
    // ファイル名にハッシュが付与されているのでCacheFirst
    new CacheFirst({
      cacheName: 'assets-custom-cache',
      plugins: [
        new CacheableResponsePlugin({
          statuses: [0, 200]
        })
      ]
    })
  )

  // index.htmlが返ってくる箇所は予め指定 (refs src/router/index.ts)
  const navigationDenylist = [
    new RegExp('/widget/'),
    new RegExp('/api/'),
    new RegExp('/.well-known/')
  ]

  if (
    apiBasePath !== '' &&
    apiBasePath !== '/' &&
    !/^\/api\b/.test(apiBasePath)
  ) {
    navigationDenylist.push(new RegExp(`^${escapeRegExp(apiBasePath)}/`))
  }

  registerRoute(
    new NavigationRoute(createHandlerBoundToURL('/index.html'), {
      allowlist: [
        new RegExp('/channels/'),
        new RegExp('/users/'),
        new RegExp('/messages/'),
        new RegExp('/files/'),
        new RegExp('/clip-folders/'),
        new RegExp('/group-manager/'),
        new RegExp('/settings/'),
        new RegExp('/share-target'),
        new RegExp('/login'),
        new RegExp('/registration'),
        new RegExp('/consent')
      ],
      denylist: navigationDenylist
    })
  )

  // ファイルAPIのキャッシュ設定
  registerRoute(
    new RegExp(`${escapeRegExp(filesPathPrefix)}/${uuidPattern}$`),
    new CacheFirst({
      cacheName: 'files-cache',
      plugins: [
        new CacheableResponsePlugin({
          statuses: [0, 200],
          headers: {
            'X-TRAQ-FILE-CACHE': 'true'
          }
        })
        // スタンプの画像もここに入るので最大数を制限しない
      ]
    })
  )
  registerRoute(
    new RegExp(
      `${escapeRegExp(filesPathPrefix)}/${uuidPattern}/thumbnail$`
    ),
    new CacheFirst({
      cacheName: 'thumbnail-cache',
      plugins: [
        new CacheableResponsePlugin({
          statuses: [0, 200]
        }),
        new ExpirationPlugin({
          maxEntries: 500
        })
      ]
    })
  )

  // google font
  registerRoute(
    ({ url }) => url.origin === 'https://fonts.googleapis.com',
    new StaleWhileRevalidate({
      cacheName: 'google-fonts-stylesheets'
    })
  )
  registerRoute(
    ({ url }) => url.origin === 'https://fonts.gstatic.com',
    new CacheFirst({
      cacheName: 'google-fonts-webfonts',
      plugins: [
        new CacheableResponsePlugin({
          statuses: [0, 200]
        }),
        new ExpirationPlugin({
          maxEntries: 30
        })
      ]
    })
  )
}
