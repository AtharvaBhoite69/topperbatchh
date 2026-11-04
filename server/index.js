// =============================================================================
// TopperBatch - Main Application Server
// Tagline: "ISS SEM, 9 POINTER FIX!"
// =============================================================================

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');

const env = require('./config/env');
const { runMigrations } = require('./database/migrate');
const { seedDatabase } = require('./database/seed');
const { generalLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');
const { startScheduler } = require('./services/scheduler');

// Route modules
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const documentsRoutes = require('./routes/documents');
const chatbotRoutes = require('./routes/chatbot');
const quizRoutes = require('./routes/quiz');
const communityRoutes = require('./routes/community');
const profileRoutes = require('./routes/profile');
const notificationsRoutes = require('./routes/notifications');
const searchRoutes = require('./routes/search');

// Validate environment
env.validateEnv();

// Initialize database schema and default seeds
try {
  runMigrations();
  seedDatabase();
} catch (dbErr) {
  console.error('Database initialization error:', dbErr);
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: [env.CLIENT_URL, 'http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  },
});

// Attach io instance to express app so routes can broadcast
app.set('io', io);

// Security & Parsing Middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Allow PDF embedding in iframe
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: [env.CLIENT_URL, 'http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(generalLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/search', searchRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    platform: 'TopperBatch',
    tagline: 'ISS SEM, 9 POINTER FIX!',
    timestamp: new Date().toISOString(),
  });
});

// Socket.io Realtime Community Connection Handlers
const onlineUsers = new Map();

io.on('connection', (socket) => {
  // Join Channel Room
  socket.on('join_channel', (channelId) => {
    socket.join(channelId);
  });

  socket.on('leave_channel', (channelId) => {
    socket.leave(channelId);
  });

  socket.on('typing', ({ channelId, username, isTyping }) => {
    socket.to(channelId).emit('user_typing', { username, isTyping });
  });

  socket.on('user_connected', (user) => {
    if (user && user.id) {
      onlineUsers.set(socket.id, user);
      io.emit('online_users_count', new Set(Array.from(onlineUsers.values()).map((u) => u.id)).size);
    }
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    io.emit('online_users_count', new Set(Array.from(onlineUsers.values()).map((u) => u.id)).size);
  });
});

// Serve frontend build if exists in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(clientDist, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).json({ message: 'TopperBatch API Server Running. Start frontend client on port 5173.' });
    }
  });
});

// Global Error Handler
app.use(errorHandler);

// Start background cron jobs
startScheduler();

// Start Server
const PORT = env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`
  ==============================================================
   💥 TOPPERBATCH SERVER ACTIVE 💥
   Tagline: "ISS SEM, 9 POINTER FIX!"
   Port: ${PORT}
   Mode: ${env.NODE_ENV}
   Admins: ${env.ADMIN_EMAILS.join(', ')}
  ==============================================================
  `);
});

module.exports = { app, server };

