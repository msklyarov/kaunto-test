module.exports = {
  server: {
    port: process.env.PORT || 3001,
    routePrefix: '/api',
    cacheTimeoutInMs: 1 * 60 * 1000 // 3 mins in milliseconds
  },
  db: {
    mongoUrl: 'mongodb://localhost:27017',
    name: 'kaunto'
  }
};
