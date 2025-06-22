const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

let games = {}; // خزن الألعاب كائن مع رموزها

io.on('connection', (socket) => {
  console.log('مستخدم متصل: ' + socket.id);

  socket.on('host-create-game', ({ hostName, category, questionCount, questionTime }) => {
    // رمز اللعبة يتكون من 4 حروف كبيرة (A-Z و أرقام بدون O و 0 لتجنب الالتباس)
    const generateGameCode = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    let gameCode = generateGameCode();

    // تأكد ما يتكررش الكود (نادراً يصير، بس الأفضل)
    while (games[gameCode]) {
      gameCode = generateGameCode();
    }

    games[gameCode] = {
      hostId: socket.id,
      hostName,
      category,
      questionCount,
      questionTime,
      players: {}, // قائمة اللاعبين { socket.id: { name, score } }
      started: false,
      currentQuestionIndex: 0,
    };

    socket.join(gameCode);
    socket.emit('game-created', { gameCode });
    console.log(`لعبة جديدة: ${gameCode} بواسطة ${hostName}`);
  });

  socket.on('player-join-game', ({ playerName, gameCode }) => {
    if (!games[gameCode]) {
      socket.emit('error-message', 'الكود غير صحيح أو اللعبة غير موجودة');
      return;
    }
    if (games[gameCode].started) {
      socket.emit('error-message', 'اللعبة بدأت بالفعل ولا يمكن الانضمام الآن');
      return;
    }

    games[gameCode].players[socket.id] = {
      name: playerName,
      score: 0,
    };
    socket.join(gameCode);

    // نرسل للمضيف فقط لاعبين جدد
    io.to(games[gameCode].hostId).emit('player-joined', { playerId: socket.id, playerName });
    socket.emit('joined-success');
    console.log(`${playerName} انضم للعبة ${gameCode}`);
  });

  socket.on('host-start-game', ({ gameCode }) => {
    if (!games[gameCode]) {
      socket.emit('error-message', 'اللعبة غير موجودة');
      return;
    }
    if (games[gameCode].started) {
      socket.emit('error-message', 'اللعبة بدأت بالفعل');
      return;
    }

    games[gameCode].started = true;
    games[gameCode].currentQuestionIndex = 0;

    io.to(gameCode).emit('game-started');
    console.log(`اللعبة ${gameCode} بدأت`);
  });

  socket.on('player-answer', ({ gameCode, answer }) => {
    if (!games[gameCode]) return;
    const player = games[gameCode].players[socket.id];
    if (!player) return;

    // هنا ممكن تضيف منطق التحقق من الاجابة وتحديث النقاط
    console.log(`جواب من لاعب ${player.name} في ${gameCode}: ${answer}`);

    // كمثال: رد للاعب بالنجاح (يمكن تعديله حسب المنطق)
    socket.emit('answer-received', { message: 'تم استقبال جوابك' });
  });

  socket.on('disconnect', () => {
    console.log('مستخدم فصل: ' + socket.id);
    // حذف اللاعب من كل الألعاب اللي هو فيها
    for (const code in games) {
      if (games[code].players[socket.id]) {
        const playerName = games[code].players[socket.id].name;
        delete games[code].players[socket.id];
        // أخبر المضيف عن خروج لاعب
        io.to(games[code].hostId).emit('player-left', { playerId: socket.id, playerName });
        console.log(`${playerName} خرج من اللعبة ${code}`);
      }
      // لو المضيف قطع الاتصال، نحذف اللعبة كلها:
      if (games[code].hostId === socket.id) {
        io.to(code).emit('game-ended', 'انتهت اللعبة لأن المضيف غادر');
        delete games[code];
        console.log(`اللعبة ${code} أُغلقت لأن المضيف غادر`);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`السيرفر شغال على المنفذ ${PORT}`);
});
