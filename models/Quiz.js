const mongoose = require('mongoose');

const QuizSchema = new mongoose.Schema({
  drive: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Drive',
    required: true,
    unique: true // One quiz per placement drive
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  duration: {
    type: Number, // duration in minutes
    required: true,
    min: 1
  },
  questions: [{
    questionText: {
      type: String,
      required: true
    },
    options: [{
      type: String,
      required: true
    }],
    correctAnswerIndex: {
      type: Number,
      required: true,
      min: 0
    }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Quiz', QuizSchema);
