const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const User = require('./models/User');
const Room = require('./models/Room');
const Message = require('./models/Message');

const app = express();
app.use(cors());
app.use(express.json());

// ✅ MongoDB Atlas connection
mongoose.connect('mongodb+srv://priyankarar4595:Manish%40123@cluster0.gsh52qh.mongodb.net/chatapp?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB Atlas connected'))
.catch(err => console.error('❌ MongoDB error:', err));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = new Map(); // socket => { username, roomId }

wss.on('connection', (socket) => {
  console.log('🔌 New client connected');

  socket.on('message', async (raw) => {
    const data = JSON.parse(raw);
    const { type } = data;

    // ✅ Create Room
    if (type === 'create-room') {
      const roomId = uuidv4();
      await Room.create({ roomId, createdBy: data.username, roomName: data.roomName });

      clients.set(socket, { username: data.username, roomId });

      await User.deleteMany({ username: data.username });
      await User.create({ username: data.username, socketId: socket._socket.remotePort, roomId });

      socket.send(JSON.stringify({ type: 'room-created', roomId, roomName: data.roomName }));
      socket.send(JSON.stringify({ type: 'room-info', roomName: data.roomName }));
      socket.send(JSON.stringify({ type: 'room-history', messages: [] }));

      broadcastToRoom(roomId, {
        type: 'system',
        message: `${data.username} created and joined the room`,
        timestamp: new Date()
      });

      broadcastUserList(roomId);
    }

    // ✅ Join Room
    if (type === 'join-room') {
      const { username, roomId } = data;
      clients.set(socket, { username, roomId });

      await User.deleteMany({ username });
      await User.create({ username, socketId: socket._socket.remotePort, roomId });

      const messages = await Message.find({ roomId }).sort({ timestamp: 1 });
      socket.send(JSON.stringify({ type: 'room-history', messages }));

      const room = await Room.findOne({ roomId });
      if (room) {
        socket.send(JSON.stringify({ type: 'room-info', roomName: room.roomName }));
      }

      broadcastToRoom(roomId, {
        type: 'system',
        message: `${username} joined the chat`,
        timestamp: new Date()
      });

      broadcastUserList(roomId);
    }

    // ✅ Handle Message
    if (type === 'message') {
      const { message, roomId, sender, receiver } = data;

      const msg = await Message.create({
        roomId,
        sender,
        receiver,
        message,
        timestamp: new Date()
      });

      console.log("📥 Message saved:", msg);

      const payload = {
        type: receiver ? 'private-message' : 'message',
        sender,
        receiver: receiver || null,
        message,
        timestamp: msg.timestamp
      };

      clients.forEach((info, clientSocket) => {
        const shouldSend =
          receiver
            ? (info.username === sender || info.username === receiver)
            : info.roomId === roomId;

        if (shouldSend && clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify(payload));
        }
      });
    }

    // ✅ Typing Indicator
    if (type === 'typing') {
      const { sender, receiver, roomId } = data;

      clients.forEach((info, clientSocket) => {
        const isTarget =
          receiver
            ? info.username === receiver
            : info.roomId === roomId && info.username !== sender;

        if (isTarget && clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify({
            type: 'typing',
            sender,
            receiver
          }));
        }
      });
    }
  });

  // ✅ On Disconnect
  socket.on('close', async () => {
    const userInfo = clients.get(socket);
    if (userInfo) {
      await User.deleteOne({ username: userInfo.username });
      clients.delete(socket);

      broadcastToRoom(userInfo.roomId, {
        type: 'system',
        message: `${userInfo.username} left the chat`,
        timestamp: new Date()
      });

      broadcastUserList(userInfo.roomId);
    }
  });
});

// ✅ Utility: Broadcast to all in room
function broadcastToRoom(roomId, payload) {
  clients.forEach((info, socket) => {
    if (info.roomId === roomId && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  });
}

// ✅ Utility: Send updated user list
async function broadcastUserList(roomId) {
  const users = await User.find({ roomId }).select('username -_id');
  broadcastToRoom(roomId, {
    type: 'user-list',
    users: users.map(u => u.username)
  });
}

// ✅ Start server
server.listen(5000, () => {
  console.log('🚀 Server running on http://localhost:5000');
});
