const { createServer } = require('http')
const { URL } = require('url')
const next = require('next')

const port = parseInt(process.env.PORT || '3000', 10)
const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev, dir: __dirname })
const handle = app.getRequestHandler()

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
})

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      await handle(req, res)
    } catch (err) {
      console.error('Error handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })
    .once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} already in use — waiting for release`)
      } else {
        console.error('[server error]', err)
      }
    })
    .listen(port, () => {
      console.log(`> Ready on port ${port}`)
    })
}).catch((err) => {
  console.error('[app.prepare error]', err)
})
