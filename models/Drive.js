const mongoose = require('mongoose');

const DriveSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  jobRole: {
    type: String,
    required: true,
    trim: true
  },
  package: {
    type: String, // e.g., "12 LPA" or "800,000 INR"
    required: true,
    trim: true
  },
  jobDescription: {
    type: String,
    trim: true,
    default: ''
  },
  eligibleBranches: [{
    type: String,
    trim: true
  }],
  minimumCgpa: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  },
  driveDate: {
    type: Date,
    required: true
  },
  applicationDeadline: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  isClosed: {
    type: Boolean,
    default: false
  },
  applicants: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student'
    },
    appliedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['Applied', 'Shortlisted', 'Rejected'],
      default: 'Applied'
    }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Drive', DriveSchema);
