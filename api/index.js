// =============================================================================
// TopperBatch - Vercel Serverless Function Entry Point with Error Catching
// =============================================================================

let app;
let initError = null;

try {
  const server = require('../server/index');
  app = server.app;
} catch (err) {
  initError = err;
  console.error('Vercel Serverless Function Init Error:', err);
}

module.exports = (req, res) => {
  if (initError) {
    return res.status(500).json({
      error: 'Backend initialization failed on Vercel',
      message: initError.message,
      stack: initError.stack,
    });
  }

  if (typeof app === 'function') {
    return app(req, res);
  }

  return res.status(500).json({
    error: 'App handler not found',
  });
};
