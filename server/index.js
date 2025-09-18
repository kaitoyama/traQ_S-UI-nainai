import compression from 'compression'
import express from 'express'
import helmet from 'helmet'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { createServer } from 'node:http'

const DEFAULT_TRAQ_ORIGIN = 'https://q.trap.jp'
const DEFAULT_API_PREFIX = '/api/v3'
const DEFAULT_AUTH_PREFIX = '/api/auth'

const traqOrigin = process.env.TRAQ_ORIGIN ?? DEFAULT_TRAQ_ORIGIN
const apiPrefix = process.env.API_PREFIX ?? DEFAULT_API_PREFIX
const authPrefix = process.env.AUTH_PREFIX ?? DEFAULT_AUTH_PREFIX
const port = Number.parseInt(process.env.PORT ?? '4173', 10)
const host = process.env.HOST ?? '0.0.0.0'

const url = new URL(traqOrigin)
if (url.protocol !== 'https:') {
  console.warn(
    `Warning: proxy target ${traqOrigin} is not HTTPS. Consider enabling TLS before deploying.`
  )
}

// Server configuration only - no static file serving

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', true)

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
)
app.use(compression())

const servedPrefixes = new Set([apiPrefix, authPrefix])

const isApiRequest = reqPath => {
  for (const prefix of servedPrefixes) {
    if (reqPath === prefix) return true
    if (reqPath.startsWith(prefix + '/')) return true
  }
  return false
}

const rewriteLocationPath = pathname => {
  const ensurePathPrefix = prefix =>
    pathname === prefix || pathname.startsWith(prefix + '/')

  if (ensurePathPrefix(DEFAULT_API_PREFIX)) {
    const suffix = pathname.slice(DEFAULT_API_PREFIX.length)
    return apiPrefix + suffix
  }
  if (ensurePathPrefix(DEFAULT_AUTH_PREFIX)) {
    const suffix = pathname.slice(DEFAULT_AUTH_PREFIX.length)
    return authPrefix + suffix
  }
  return undefined
}

const proxyOptions = {
  target: traqOrigin,
  changeOrigin: true,
  ws: true,
  secure: true,
  xfwd: true,
  logLevel: 'warn',
  cookieDomainRewrite: '',
  cookiePathRewrite: '/',
  onProxyReq: (proxyReq, req) => {
    proxyReq.setHeader('host', url.host)

    const originHeader = req.headers.origin ?? traqOrigin
    if (originHeader) {
      proxyReq.setHeader('origin', originHeader)
    }

    const refererHeader =
      req.headers.referer ??
      (originHeader && (req.originalUrl ?? req.url)
        ? `${originHeader}${req.originalUrl ?? req.url}`
        : undefined)
    if (refererHeader) {
      proxyReq.setHeader('referer', refererHeader)
    }
    if (req.headers.cookie) {
      proxyReq.setHeader('cookie', req.headers.cookie)
    }
    try {
      const incomingPath = req.originalUrl ?? req.url ?? ''
      const destPath = proxyReq.path ?? ''
      // Log original request path and actual proxied target path
      console.log(`[proxy] ${req.method ?? 'GET'} ${incomingPath} -> ${traqOrigin}${destPath}`)
    } catch {}
  },
  onProxyReqWs: (proxyReq, req) => {
    const originHeader = req.headers.origin ?? traqOrigin
    if (originHeader) {
      proxyReq.setHeader('origin', originHeader)
    }

    const refererHeader =
      req.headers.referer ??
      (originHeader && (req.originalUrl ?? req.url)
        ? `${originHeader}${req.originalUrl ?? req.url}`
        : undefined)
    if (refererHeader) {
      proxyReq.setHeader('referer', refererHeader)
    }
    if (req.headers.cookie) {
      proxyReq.setHeader('cookie', req.headers.cookie)
    }
    try {
      const incomingPath = req.originalUrl ?? req.url ?? ''
      const destPath = proxyReq.path ?? ''
      console.log(`[proxy][ws] ${incomingPath} -> ${traqOrigin}${destPath}`)
    } catch {}
  },
  onProxyRes: proxyRes => {
    delete proxyRes.headers['access-control-allow-origin']
    delete proxyRes.headers['access-control-allow-credentials']

    const location = proxyRes.headers.location
    if (!location) return

    try {
      const resolved = new URL(location, traqOrigin)
      const rewrittenPath = rewriteLocationPath(resolved.pathname)
      if (!rewrittenPath) return

      resolved.pathname = rewrittenPath

      const originalIsRelative = location.startsWith('/') && !location.startsWith('//')
      if (originalIsRelative || resolved.origin === url.origin) {
        proxyRes.headers.location = `${rewrittenPath}${resolved.search}${resolved.hash}`
        return
      }

      proxyRes.headers.location = resolved.toString()
    } catch (error) {
      console.warn('[proxy][location-rewrite] failed', error)
    }
  }
}

const apiProxy = createProxyMiddleware(proxyOptions)
const authProxy = createProxyMiddleware(proxyOptions)

// Log incoming HTTP requests before proxying
app.use(apiPrefix, (req, _res, next) => {
  const originalPath = req.originalUrl ?? req.url ?? ''
  console.log(`[proxy][incoming] ${req.method ?? 'GET'} ${originalPath} -> ${traqOrigin}${originalPath}`)
  next()
})
if (authPrefix !== apiPrefix) {
  app.use(authPrefix, (req, _res, next) => {
    const originalPath = req.originalUrl ?? req.url ?? ''
    console.log(`[proxy][incoming] ${req.method ?? 'GET'} ${originalPath} -> ${traqOrigin}${originalPath}`)
    next()
  })
}

app.use(apiPrefix, apiProxy)
if (authPrefix !== apiPrefix) {
  app.use(authPrefix, authProxy)
}

// Static file serving removed - API proxy only

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' })
})

// Catch-all route removed - API proxy only
app.get('*', (req, res) => {
  if (!isApiRequest(req.path)) {
    res.status(404).json({ error: 'Not Found - API proxy only' })
  }
})

const server = createServer(app)

server.on('upgrade', (req, socket, head) => {
  const urlPath = req.url ?? ''
  if (urlPath.startsWith(apiPrefix)) {
    console.log(`[proxy][ws-incoming] ${urlPath} -> ${traqOrigin}${urlPath}`)
    apiProxy.upgrade(req, socket, head)
    return
  }
  if (authPrefix !== apiPrefix && urlPath.startsWith(authPrefix)) {
    console.log(`[proxy][ws-incoming] ${urlPath} -> ${traqOrigin}${urlPath}`)
    authProxy.upgrade(req, socket, head)
    return
  }
  socket.destroy()
})

server.listen(port, host, () => {
  console.log(`Reverse proxy listening on http://${host}:${port}`)
  console.log(`Forwarding ${apiPrefix} and ${authPrefix} to ${traqOrigin}`)
})
