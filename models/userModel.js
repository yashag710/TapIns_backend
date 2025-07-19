const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  payerId : {
    type : Number,
    required: true,
    unique: true,
  },
  phone: {
    type: String,
    required: true,
    unique: true, 
    match: /^\+\d{10,15}$/
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model("User", userSchema);

module.exports = User;
