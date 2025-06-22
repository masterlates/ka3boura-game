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
    const gameCode = Math.random().toString(36).substring(2, 6).toUpperCase();
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
    // أضف المضيف كلاعب عادي مع النقاط صفر
    games[gameCode].players[socket.id] = { name: hostName, score: 0 };
    socket.emit('game-created', { gameCode });
    io.to(gameCode).emit('player-list', Object.values(games[gameCode].players).map(p => p.name));
    console.log(`🎮 لعبة جديدة: ${gameCode} أنشأها ${hostName}`);
  });

  socket.on('player-join-game', ({ playerName, gameCode }) => {
    const game = games[gameCode];
    if (!game) {
      socket.emit('error-message', '❌ الكود غير صحيح أو اللعبة غير موجود');
      return;
    }
    game.players[socket.id] = { name: playerName, score: 0 };
    socket.join(gameCode);
    socket.emit('joined-success');
    io.to(gameCode).emit('player-list', Object.values(game.players).map(p => p.name));
    console.log(`✅ ${playerName} انضم إلى اللعبة ${gameCode}`);
  });

  socket.on('host-start-game', ({ gameCode }) => {
    const game = games[gameCode];
    if (!game) return;
    if (game.started) return; // لا تبدأ مرتين
    game.started = true;
    game.currentQuestionIndex = 0;
    io.to(gameCode).emit('game-started');
    console.log(`🚀 بدء اللعبة: ${gameCode}`);
  });

  socket.on('player-answer', ({ gameCode, answer }) => {
    const game = games[gameCode];
    if (!game) return;
    // هنا ممكن تضيف حساب النقاط حسب الإجابة
    console.log(`📩 جواب من لاعب في ${gameCode}: ${answer}`);
  });

  socket.on('disconnect', () => {
    // حذف اللاعب من أي لعبة كان فيها
    for (const code in games) {
      if (games[code].players[socket.id]) {
        const playerName = games[code].players[socket.id].name;
        delete games[code].players[socket.id];
        io.to(code).emit('player-list', Object.values(games[code].players).map(p => p.name));
        console.log(`🔌 قطع الاتصال: ${playerName} من اللعبة ${code}`);
        break;
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`✅ السيرفر شغال على http://localhost:${PORT}`);
});
