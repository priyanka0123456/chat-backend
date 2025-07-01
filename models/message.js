const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId: String,
  sender: String,
  receiver: { type: String, default: null },
  message: String,
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', messageSchema);
