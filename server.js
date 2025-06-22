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
      players: {},       // لاعبون: id -> {name, score}
      started: false,
      currentQuestionIndex: 0,
    };

    // المضيف يدخل كـ لاعب تلقائياً
    games[gameCode].players[socket.id] = { name: hostName, score: 0 };

    socket.join(gameCode);
    socket.emit('game-created', { gameCode });
    io.to(gameCode).emit('player-list', Object.values(games[gameCode].players).map(p => p.name)); // إرسال قائمة اللاعبين للجميع
    console.log(`🎮 لعبة جديدة: ${gameCode} أنشأها ${hostName}`);
  });

  socket.on('player-join-game', ({ playerName, gameCode }) => {
    const game = games[gameCode];
    if (!game) {
      socket.emit('error-message', '❌ الكود غير صحيح أو اللعبة غير موجودة');
      return;
    }

    // إذا اللاعب جديد فقط ضيفه
    if (!game.players[socket.id]) {
      game.players[socket.id] = { name: playerName, score: 0 };
      socket.join(gameCode);
      socket.emit('joined-success');
      io.to(game.hostId).emit('player-joined', { playerName });
      io.to(gameCode).emit('player-list', Object.values(game.players).map(p => p.name));
      console.log(`✅ ${playerName} انضم إلى اللعبة ${gameCode}`);
    }
  });

  socket.on('host-start-game', ({ gameCode }) => {
    const game = games[gameCode];
    if (!game) return;

    game.started = true;
    game.currentQuestionIndex = 0;
    io.to(gameCode).emit('game-started');
    console.log(`🚀 بدء اللعبة: ${gameCode}`);
  });

  socket.on('player-answer', ({ gameCode, answer }) => {
    console.log(`📩 إجابة من لاعب في ${gameCode}: ${answer}`);
    // مع الوقت ممكن تضيف تقييم للإجابات وحساب النقاط
  });

  socket.on('disconnect', () => {
    console.log('🔌 قطع الاتصال:', socket.id);
    // إذا اللاعب كان في لعبة، حدّث القائمة وبلّغ المضيف
    for (const [code, game] of Object.entries(games)) {
      if (game.players[socket.id]) {
        const name = game.players[socket.id].name;
        delete game.players[socket.id];
        io.to(game.hostId).emit('player-left', { playerName: name });
        io.to(code).emit('player-list', Object.values(game.players).map(p => p.name));
        console.log(`❌ ${name} خرج من اللعبة ${code}`);
        break;
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`✅ السيرفر شغال على http://localhost:${PORT}`);
});
