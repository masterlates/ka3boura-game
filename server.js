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

  // المضيف ينشئ اللعبة
  socket.on('host-create-game', ({ hostName, category, questionCount, questionTime }) => {
    const gameCode = Math.random().toString(36).substr(2, 4).toUpperCase();

    games[gameCode] = {
      hostId: socket.id,
      hostName,
      category,
      questionCount,
      questionTime,
      players: {
        [socket.id]: { name: hostName, score: 0 }
      },
      started: false,
      currentQuestionIndex: 0,
    };

    socket.join(gameCode);
    socket.emit('game-created', { gameCode });

    // أرسل قائمة اللاعبين (فيها المضيف) للمضيف فقط
    io.to(socket.id).emit('player-list', Object.values(games[gameCode].players).map(p => p.name));

    console.log(`🎮 لعبة جديدة: ${gameCode} أنشأها ${hostName}`);
  });

  // لاعب ينضم للعبة
  socket.on('player-join-game', ({ playerName, gameCode }) => {
    const game = games[gameCode];
    if (!game) {
      socket.emit('error-message', '❌ الكود غير صحيح أو اللعبة غير موجودة');
      return;
    }

    game.players[socket.id] = { name: playerName, score: 0 };
    socket.join(gameCode);
    socket.emit('joined-success');

    // أرسل قائمة اللاعبين لجميع المشاركين
    const playerNames = Object.values(game.players).map(p => p.name);
    io.to(gameCode).emit('player-list', playerNames);

    console.log(`✅ ${playerName} انضم إلى اللعبة ${gameCode}`);
  });

  // المضيف يبدأ اللعبة
  socket.on('host-start-game', ({ gameCode }) => {
    const game = games[gameCode];
    if (!game) return;

    game.started = true;
    game.currentQuestionIndex = 0;
    io.to(gameCode).emit('game-started');

    console.log(`🚀 بدء اللعبة: ${gameCode}`);
  });

  // استقبال إجابات اللاعبين (يمكنك تطويرها لحساب النقاط)
  socket.on('player-answer', ({ gameCode, answer }) => {
    const game = games[gameCode];
    if (!game) return;

    const player = game.players[socket.id];
    if (!player) return;

    console.log(`📩 إجابة من ${player.name} في ${gameCode}: ${answer}`);

    // مثال: إذا جواب صحيح زد نقطة (في هذا المثال: دائماً صحيحة "تونس")
    // يمكنك تطويرها حسب الأسئلة والجواب الحقيقي
    // if (answer.toLowerCase() === "تونس") {
    //   player.score += 1;
    // }

    // أرسل تحديث النقاط لجميع اللاعبين (يمكن تطويره)
    // io.to(gameCode).emit('score-update', { players: game.players });
  });

  socket.on('disconnect', () => {
    console.log('🔌 قطع الاتصال:', socket.id);
    // حذف اللاعب من أي لعبة كان فيها
    for (const code in games) {
      const game = games[code];
      if (game.players[socket.id]) {
        delete game.players[socket.id];
        io.to(code).emit('player-list', Object.values(game.players).map(p => p.name));
        console.log(`❌ لاعب خرج من اللعبة ${code}`);
        break;
      }
      if (game.hostId === socket.id) {
        // المضيف قطع الاتصال - ممكن تحذف اللعبة
        delete games[code];
        io.to(code).emit('error-message', 'تم إلغاء اللعبة لأن المضيف خرج.');
        console.log(`❌ المضيف خرج وتم حذف اللعبة ${code}`);
        break;
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`✅ السيرفر شغال على http://localhost:${PORT}`);
});
