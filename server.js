const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'host.html'));
});

let games = {};

io.on('connection', (socket) => {
  console.log('🟢 اتصال جديد:', socket.id);

  socket.on('host-create-game', ({ hostName, category, questionCount, questionTime }) => {
    const gameCode = Math.random().toString(36).substr(2, 4).toUpperCase();
    games[gameCode] = {
      hostId: socket.id,
      hostName,
      category,
      questionCount,
      questionTime,
      players: {},
      started: false,
      currentQuestionIndex: 0,
    };
    socket.join(gameCode);
    socket.emit('game-created', { gameCode });
  });

  socket.on('player-join-game', ({ playerName, gameCode }) => {
    const game = games[gameCode];
    if (!game) return socket.emit('error-message', '❌ الكود غير صحيح أو اللعبة غير موجودة');
    game.players[socket.id] = { name: playerName, score: 0 };
    socket.join(gameCode);
    socket.emit('joined-success');
    io.to(game.hostId).emit('player-joined', { playerName });
  });

  socket.on('host-start-game', ({ gameCode }) => {
    const game = games[gameCode];
    if (!game) return;
    game.started = true;
    game.currentQuestionIndex = 0;
    io.to(gameCode).emit('game-started');
  });

  socket.on('player-answer', ({ gameCode, answer }) => {
    console.log(`📩 إجابة من ${gameCode}: ${answer}`);
  });

  socket.on('disconnect', () => {
    console.log('🔌 قطع الاتصال:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`✅ السيرفر شغال على http://localhost:${PORT}`);
});
