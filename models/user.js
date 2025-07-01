const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: String,
  socketId: String,
  roomId: String
});

module.exports = mongoose.model('User', userSchema);
