const mongoose = require('mongoose');

const QuizResultSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  enrollmentNumber: {
    type: String,
    required: true
  },
  quiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true
  },
  drive: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Drive',
    required: true
  },
  score: {
    type: Number,
    required: true
  },
  totalQuestions: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['Qualified', 'Rejected', 'Pending'],
    default: 'Pending'
  }
}, { timestamps: true });

// Ensure a student can take a quiz for a drive only once
QuizResultSchema.index({ student: 1, quiz: 1 }, { unique: true });

module.exports = mongoose.model('QuizResult', QuizResultSchema);
