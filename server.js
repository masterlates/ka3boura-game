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
  console.log('✅ مستخدم متصل: ' + socket.id);

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
    };
    socket.join(gameCode);
    socket.emit('game-created', { gameCode });
    console.log(`🎮 لعبة جديدة: ${gameCode} بواسطة ${hostName}`);
  });

  socket.on('player-join-game', ({ playerName, gameCode }) => {
    if (!games[gameCode]) {
      socket.emit('error-message', '❌ الكود غير صحيح أو اللعبة غير موجودة');
      return;
    }

    games[gameCode].players[socket.id] = {
      name: playerName,
      score: 0,
    };

    socket.join(gameCode);
    io.to(games[gameCode].hostId).emit('player-joined', { playerId: socket.id, playerName });
    socket.emit('joined-success');
    console.log(`✅ ${playerName} انضم للعبة ${gameCode}`);
  });

  socket.on('host-start-game', ({ gameCode }) => {
    if (!games[gameCode]) return;
    games[gameCode].started = true;
    io.to(gameCode).emit('game-started');
    console.log(`🚀 بدء اللعبة ${gameCode}`);
  });

  socket.on('player-answer', ({ gameCode, answer }) => {
    console.log(`📩 جواب من لاعب في ${gameCode}: ${answer}`);
  });

  socket.on('disconnect', () => {
    console.log('❎ مستخدم فصل: ' + socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 السيرفر شغال على المنفذ ${PORT}`);
});
