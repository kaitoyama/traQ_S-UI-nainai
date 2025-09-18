import compression from 'compression'
import express from 'express'
import helmet from 'helmet'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { createServer } from 'node:http'

const DEFAULT_TRAQ_ORIGIN = 'https://q.trap.jp/api'
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

const proxyOptions = {
  target: traqOrigin,
  changeOrigin: true,
  ws: true,
  secure: true,
  xfwd: true,
  logLevel: 'warn',
  cookieDomainRewrite: '',
  onProxyReq: proxyReq => {
    proxyReq.setHeader('host', url.host)
    proxyReq.removeHeader('origin')
  },
  onProxyRes: proxyRes => {
    delete proxyRes.headers['access-control-allow-origin']
    delete proxyRes.headers['access-control-allow-credentials']
  }
}

const apiProxy = createProxyMiddleware(proxyOptions)
const authProxy = createProxyMiddleware(proxyOptions)

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
    apiProxy.upgrade(req, socket, head)
    return
  }
  if (authPrefix !== apiPrefix && urlPath.startsWith(authPrefix)) {
    authProxy.upgrade(req, socket, head)
    return
  }
  socket.destroy()
})

server.listen(port, host, () => {
  console.log(`Reverse proxy listening on http://${host}:${port}`)
  console.log(`Forwarding ${apiPrefix} and ${authPrefix} to ${traqOrigin}`)
})
