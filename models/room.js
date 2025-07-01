const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomId: String,
  createdBy: String,
  roomName: String 
});

module.exports = mongoose.model('Room', roomSchema);
