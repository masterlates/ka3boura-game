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
    // سجل المضيف كلاعب في اللعبة مباشرة
    games[gameCode].players[socket.id] = { name: hostName, score: 0 };
    socket.emit('game-created', { gameCode });
    console.log(`🎮 لعبة جديدة: ${gameCode} أنشأها ${hostName}`);
  });

  socket.on('player-join-game', ({ playerName, gameCode }) => {
    const game = games[gameCode];
    if (!game) {
      socket.emit('error-message', '❌ الكود غير صحيح أو اللعبة غير موجودة');
      return;
    }

    // إذا كان اللاعب مسجل مسبقاً (مثل المضيف) لا تعيد التسجيل
    if (!game.players[socket.id]) {
      game.players[socket.id] = { name: playerName, score: 0 };
    }

    socket.join(gameCode);
    socket.emit('joined-success');

    // أرسل تحديث للاعبين للمضيف فقط حتى لا يكرر أسماء
    io.to(game.hostId).emit('player-joined', { playerName });

    console.log(`✅ ${playerName} انضم إلى اللعبة ${gameCode}`);
  });

  socket.on('host-start-game', ({ gameCode }) => {
    const game = games[gameCode];
    if (!game) return;

    game.started = true;
    game.currentQuestionIndex = 0;

    // أبث بدء اللعبة لكل اللاعبين في الغرفة
    io.to(gameCode).emit('game-started');

    console.log(`🚀 بدء اللعبة: ${gameCode}`);
  });

  socket.on('player-answer', ({ gameCode, answer }) => {
    console.log(`📩 إجابة من لاعب في ${gameCode}: ${answer}`);
    // هنا يمكنك حساب النقاط أو التحقق من صحة الإجابة
  });

  socket.on('disconnect', () => {
    console.log('🔌 قطع الاتصال:', socket.id);
    // يمكنك هنا إزالة اللاعب من اللعبة إذا رغبت بذلك
    for (const code in games) {
      const game = games[code];
      if (game.players[socket.id]) {
        const playerName = game.players[socket.id].name;
        delete game.players[socket.id];
        io.to(game.hostId).emit('player-left', { playerName });
        console.log(`❌ ${playerName} غادر اللعبة ${code}`);
        break;
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`✅ السيرفر شغال على http://localhost:${PORT}`);
});
