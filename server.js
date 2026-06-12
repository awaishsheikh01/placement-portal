require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');

// Models
const Student = require('./models/Student');
const Company = require('./models/Company');
const Drive = require('./models/Drive');
const Quiz = require('./models/Quiz');
const QuizResult = require('./models/QuizResult');

// Middleware
const { verifyToken, authorizeRole } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretplacementtoken123';

// Express Config
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database connection with graceful fail
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pdms')
  .then(() => console.log('Successfully connected to MongoDB.'))
  .catch(err => {
    console.error('================================================================');
    console.error('DATABASE CONNECTION ERROR: Could not connect to MongoDB.');
    console.error('Please make sure your MongoDB server is running locally (mongod).');
    console.error('The server will continue to run, but database actions will fail.');
    console.error('Error Details:', err.message);
    console.error('================================================================');
  });

// ==========================================
// 1. AUTHENTICATION & REGISTRATION ENDPOINTS
// ==========================================

// Student Registration
app.post('/api/auth/register-student', async (req, res) => {
  try {
    const { name, enrollmentNumber, email, phone, branch, year, cgpa, password } = req.body;

    // Validation
    if (!name || !enrollmentNumber || !email || !phone || !branch || !year || !cgpa || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    // Check duplicates
    const existingStudent = await Student.findOne({ 
      $or: [{ email }, { enrollmentNumber }] 
    });
    if (existingStudent) {
      return res.status(400).json({ message: 'Email or Enrollment Number already registered.' });
    }

    const newStudent = new Student({
      name,
      enrollmentNumber,
      email,
      phone,
      branch,
      year,
      cgpa: parseFloat(cgpa),
      password
    });

    await newStudent.save();
    res.status(201).json({ message: 'Student registered successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during registration.', error: error.message });
  }
});

// Student Login
app.post('/api/auth/login-student', async (req, res) => {
  try {
    const { enrollmentNumber, password } = req.body;
    if (!enrollmentNumber || !password) {
      return res.status(400).json({ message: 'Enrollment Number and Password are required.' });
    }

    const student = await Student.findOne({ enrollmentNumber });
    if (!student) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const isMatch = await student.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: student._id, role: 'student', name: student.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { name: student.name, role: 'student', cgpa: student.cgpa, branch: student.branch } });
  } catch (error) {
    res.status(500).json({ message: 'Server error during login.', error: error.message });
  }
});

// Company Registration
app.post('/api/auth/register-company', async (req, res) => {
  try {
    const { companyName, email, password } = req.body;
    if (!companyName || !email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const existingCompany = await Company.findOne({ email });
    if (existingCompany) {
      return res.status(400).json({ message: 'Company email already registered.' });
    }

    const newCompany = new Company({ companyName, email, password });
    await newCompany.save();

    res.status(201).json({ message: 'Company registered successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during company registration.', error: error.message });
  }
});

// Company Login
app.post('/api/auth/login-company', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and Password are required.' });
    }

    const company = await Company.findOne({ email });
    if (!company) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const isMatch = await company.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: company._id, role: 'company', name: company.companyName },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { name: company.companyName, role: 'company' } });
  } catch (error) {
    res.status(500).json({ message: 'Server error during company login.', error: error.message });
  }
});

// Admin Login
app.post('/api/auth/login-admin', (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

  if (username === adminUser && password === adminPass) {
    const token = jwt.sign(
      { id: 'admin', role: 'admin', name: 'System Administrator' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    return res.json({ token, user: { name: 'Admin', role: 'admin' } });
  }

  res.status(400).json({ message: 'Invalid Admin credentials.' });
});

// ==========================================
// 2. STUDENT DASHBOARD ENDPOINTS
// ==========================================

// Get student profile details
app.get('/api/student/profile', verifyToken, authorizeRole(['student']), async (req, res) => {
  try {
    const student = await Student.findById(req.user.id).select('-password');
    if (!student) return res.status(404).json({ message: 'Student not found.' });
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// Update student profile details
app.put('/api/student/profile', verifyToken, authorizeRole(['student']), async (req, res) => {
  try {
    const { name, email, phone, branch, year, cgpa } = req.body;
    const student = await Student.findById(req.user.id);
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    // Check duplicate email if changed
    if (email && email.toLowerCase() !== student.email.toLowerCase()) {
      const existingEmail = await Student.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ message: 'Email is already registered by another student.' });
      }
    }

    student.name = name || student.name;
    student.email = email || student.email;
    student.phone = phone || student.phone;
    student.branch = branch || student.branch;
    student.year = year || student.year;
    if (cgpa !== undefined) {
      student.cgpa = parseFloat(cgpa);
    }

    await student.save();
    res.json({ message: 'Profile updated successfully!', student });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// Get drives list for student (Approved only, annotated with application status and eligibility status)
app.get('/api/student/drives', verifyToken, authorizeRole(['student']), async (req, res) => {
  try {
    const student = await Student.findById(req.user.id);
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    const drives = await Drive.find({ status: 'Approved' }).sort({ driveDate: 1 });

    const formattedDrives = drives.map(drive => {
      // Check if student applied
      const application = drive.applicants.find(app => app.student.toString() === student._id.toString());
      const hasApplied = !!application;
      const applicationStatus = hasApplied ? application.status : null;

      // Check Eligibility (CGPA and branch)
      const branchMatches = drive.eligibleBranches.some(b => b.trim().toLowerCase() === student.branch.trim().toLowerCase());
      const cgpaMatches = student.cgpa >= drive.minimumCgpa;
      const isEligible = branchMatches && cgpaMatches;

      return {
        _id: drive._id,
        companyName: drive.companyName,
        jobRole: drive.jobRole,
        package: drive.package,
        jobDescription: drive.jobDescription || '',
        eligibleBranches: drive.eligibleBranches,
        minimumCgpa: drive.minimumCgpa,
        driveDate: drive.driveDate,
        applicationDeadline: drive.applicationDeadline,
        isClosed: drive.isClosed,
        hasApplied,
        applicationStatus,
        isEligible,
        eligibilityReason: !isEligible ? 
          (!branchMatches ? `Branch '${student.branch}' not eligible.` : `CGPA ${student.cgpa} below minimum requirement of ${drive.minimumCgpa}.`) 
          : 'Eligible'
      };
    });

    res.json(formattedDrives);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// Apply for a placement drive
app.post('/api/student/drives/:id/apply', verifyToken, authorizeRole(['student']), async (req, res) => {
  try {
    const driveId = req.params.id;
    const studentId = req.user.id;

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    const drive = await Drive.findById(driveId);
    if (!drive) return res.status(404).json({ message: 'Placement drive not found.' });

    if (drive.status !== 'Approved') {
      return res.status(400).json({ message: 'Cannot apply for a drive that is not approved.' });
    }

    if (drive.isClosed || new Date() > new Date(drive.applicationDeadline)) {
      return res.status(400).json({ message: 'Application deadline has passed or drive is closed.' });
    }

    // Check Eligibility
    const branchMatches = drive.eligibleBranches.some(b => b.trim().toLowerCase() === student.branch.trim().toLowerCase());
    const cgpaMatches = student.cgpa >= drive.minimumCgpa;
    if (!branchMatches || !cgpaMatches) {
      return res.status(400).json({ message: 'You are not eligible to apply for this drive.' });
    }

    // Check if already applied
    const alreadyApplied = drive.applicants.some(app => app.student.toString() === studentId.toString());
    if (alreadyApplied) {
      return res.status(400).json({ message: 'You have already applied for this placement drive.' });
    }

    drive.applicants.push({ student: studentId });
    await drive.save();

    res.json({ message: 'Applied successfully!', driveStatus: 'Applied' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// Fetch quiz questions (without answers)
app.get('/api/student/quizzes/drive/:driveId', verifyToken, authorizeRole(['student']), async (req, res) => {
  try {
    const { driveId } = req.params;
    const studentId = req.user.id;

    // Verify application status
    const drive = await Drive.findById(driveId);
    if (!drive) return res.status(404).json({ message: 'Drive not found.' });

    const applied = drive.applicants.some(app => app.student.toString() === studentId.toString());
    if (!applied) {
      return res.status(403).json({ message: 'Please apply to this drive before attempting the assessment.' });
    }

    // Find quiz
    const quiz = await Quiz.findOne({ drive: driveId });
    if (!quiz) {
      return res.status(404).json({ message: 'No quiz configured for this drive.' });
    }

    // Check if already attempted
    const alreadyAttempted = await QuizResult.findOne({ student: studentId, quiz: quiz._id });
    if (alreadyAttempted) {
      return res.status(400).json({ message: 'You have already attempted this assessment.', result: alreadyAttempted });
    }

    // Strip out the correct answers for security
    const secureQuestions = quiz.questions.map(q => ({
      _id: q._id,
      questionText: q.questionText,
      options: q.options
    }));

    res.json({
      _id: quiz._id,
      title: quiz.title,
      duration: quiz.duration,
      questions: secureQuestions
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// Submit quiz answers and calculate results
app.post('/api/student/quizzes/:id/submit', verifyToken, authorizeRole(['student']), async (req, res) => {
  try {
    const quizId = req.params.id;
    const studentId = req.user.id;
    const { answers } = req.body; // Map of question index -> option index or array of options

    const quiz = await Quiz.findById(quizId).populate('drive');
    if (!quiz) return res.status(404).json({ message: 'Quiz not found.' });

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    // Check if already attempted
    const alreadyAttempted = await QuizResult.findOne({ student: studentId, quiz: quizId });
    if (alreadyAttempted) {
      return res.status(400).json({ message: 'You have already submitted answers for this quiz.' });
    }

    // Evaluate score
    let score = 0;
    const totalQuestions = quiz.questions.length;

    quiz.questions.forEach((question, index) => {
      // User submitted answer could be a string or index. We assume index.
      const submittedAnswer = answers[index];
      if (submittedAnswer !== undefined && parseInt(submittedAnswer) === question.correctAnswerIndex) {
        score++;
      }
    });

    // Auto status: Qualified if score is 50% or more, else Rejected (Company can override)
    const threshold = totalQuestions / 2;
    const status = score >= threshold ? 'Qualified' : 'Rejected';

    const newResult = new QuizResult({
      student: studentId,
      studentName: student.name,
      enrollmentNumber: student.enrollmentNumber,
      quiz: quizId,
      drive: quiz.drive._id,
      score,
      totalQuestions,
      status
    });

    await newResult.save();

    // Also update Drive applicant status to reflect the result
    const drive = await Drive.findById(quiz.drive._id);
    if (drive) {
      const applicantIndex = drive.applicants.findIndex(app => app.student.toString() === studentId.toString());
      if (applicantIndex !== -1) {
        drive.applicants[applicantIndex].status = status === 'Qualified' ? 'Shortlisted' : 'Rejected';
        await drive.save();
      }
    }

    res.status(201).json({
      message: 'Quiz submitted successfully!',
      score,
      totalQuestions,
      status
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during submission.', error: error.message });
  }
});

// View student's quiz results
app.get('/api/student/results', verifyToken, authorizeRole(['student']), async (req, res) => {
  try {
    const results = await QuizResult.find({ student: req.user.id })
      .populate('quiz', 'title')
      .populate('drive', 'companyName jobRole package')
      .sort({ createdAt: -1 });

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ==========================================
// 3. COMPANY DASHBOARD ENDPOINTS
// ==========================================

// Create placement drive
app.post('/api/company/drives', verifyToken, authorizeRole(['company']), async (req, res) => {
  try {
    const { jobRole, package, jobDescription, eligibleBranches, minimumCgpa, driveDate, applicationDeadline } = req.body;

    if (!jobRole || !package || !eligibleBranches || !driveDate || !applicationDeadline) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const newDrive = new Drive({
      company: req.user.id,
      companyName: req.user.name,
      jobRole,
      package,
      jobDescription: jobDescription || '',
      eligibleBranches: Array.isArray(eligibleBranches) ? eligibleBranches : eligibleBranches.split(',').map(b => b.trim()),
      minimumCgpa: minimumCgpa ? parseFloat(minimumCgpa) : 0,
      driveDate: new Date(driveDate),
      applicationDeadline: new Date(applicationDeadline),
      status: 'Pending' // Admin approval required
    });

    await newDrive.save();
    res.status(201).json({ message: 'Placement drive created! Awaiting Admin approval.', drive: newDrive });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// Get company's placement drives
app.get('/api/company/drives', verifyToken, authorizeRole(['company']), async (req, res) => {
  try {
    const drives = await Drive.find({ company: req.user.id })
      .populate('applicants.student', 'name enrollmentNumber email phone branch cgpa')
      .sort({ createdAt: -1 });
    res.json(drives);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// Edit placement drive
app.put('/api/company/drives/:id', verifyToken, authorizeRole(['company']), async (req, res) => {
  try {
    const driveId = req.params.id;
    const { jobRole, package, jobDescription, eligibleBranches, minimumCgpa, driveDate, applicationDeadline } = req.body;

    const drive = await Drive.findOne({ _id: driveId, company: req.user.id });
    if (!drive) return res.status(404).json({ message: 'Placement drive not found or unauthorized.' });

    drive.jobRole = jobRole || drive.jobRole;
    drive.package = package || drive.package;
    if (jobDescription !== undefined) drive.jobDescription = jobDescription;
    if (eligibleBranches) {
      drive.eligibleBranches = Array.isArray(eligibleBranches) ? eligibleBranches : eligibleBranches.split(',').map(b => b.trim());
    }
    if (minimumCgpa !== undefined) drive.minimumCgpa = parseFloat(minimumCgpa);
    if (driveDate) drive.driveDate = new Date(driveDate);
    if (applicationDeadline) drive.applicationDeadline = new Date(applicationDeadline);

    // Reset status to Pending on modifications
    drive.status = 'Pending';

    await drive.save();
    res.json({ message: 'Placement drive updated and sent for Admin re-approval.', drive });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// Delete placement drive
app.delete('/api/company/drives/:id', verifyToken, authorizeRole(['company']), async (req, res) => {
  try {
    const drive = await Drive.findOneAndDelete({ _id: req.params.id, company: req.user.id });
    if (!drive) return res.status(404).json({ message: 'Drive not found or unauthorized.' });

    // Clean up related quizzes and results
    await Quiz.deleteOne({ drive: drive._id });
    await QuizResult.deleteMany({ drive: drive._id });

    res.json({ message: 'Placement drive and associated test metrics deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// Close placement drive
app.post('/api/company/drives/:id/close', verifyToken, authorizeRole(['company']), async (req, res) => {
  try {
    const drive = await Drive.findOne({ _id: req.params.id, company: req.user.id });
    if (!drive) return res.status(404).json({ message: 'Drive not found or unauthorized.' });

    drive.isClosed = true;
    await drive.save();
    res.json({ message: 'Drive closed successfully.', drive });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// Create or update quiz
app.post('/api/company/quizzes', verifyToken, authorizeRole(['company']), async (req, res) => {
  try {
    const { driveId, title, duration, questions } = req.body;

    if (!driveId || !title || !duration || !questions || !questions.length) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const drive = await Drive.findOne({ _id: driveId, company: req.user.id });
    if (!drive) return res.status(404).json({ message: 'Associated drive not found or unauthorized.' });

    let quiz = await Quiz.findOne({ drive: driveId });

    if (quiz) {
      quiz.title = title;
      quiz.duration = parseInt(duration);
      quiz.questions = questions;
      await quiz.save();
      res.json({ message: 'Quiz updated successfully!', quiz });
    } else {
      quiz = new Quiz({
        drive: driveId,
        title,
        duration: parseInt(duration),
        questions
      });
      await quiz.save();
      res.status(201).json({ message: 'Quiz created successfully!', quiz });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// Fetch quiz for a drive
app.get('/api/company/quizzes/drive/:driveId', verifyToken, authorizeRole(['company']), async (req, res) => {
  try {
    const drive = await Drive.findOne({ _id: req.params.driveId, company: req.user.id });
    if (!drive) return res.status(404).json({ message: 'Drive not found or unauthorized.' });

    const quiz = await Quiz.findOne({ drive: req.params.driveId });
    if (!quiz) return res.status(404).json({ message: 'No quiz exists for this drive.' });

    res.json(quiz);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// View Student Results for a specific drive
app.get('/api/company/results/drive/:driveId', verifyToken, authorizeRole(['company']), async (req, res) => {
  try {
    const drive = await Drive.findOne({ _id: req.params.driveId, company: req.user.id });
    if (!drive) return res.status(404).json({ message: 'Drive not found or unauthorized.' });

    const results = await QuizResult.find({ drive: req.params.driveId })
      .populate('student', 'name enrollmentNumber email branch cgpa')
      .sort({ score: -1 });

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// Shortlist/Reject Candidate manually
app.post('/api/company/shortlist', verifyToken, authorizeRole(['company']), async (req, res) => {
  try {
    const { driveId, studentId, status } = req.body; // status: 'Shortlisted' or 'Rejected'

    if (!driveId || !studentId || !['Shortlisted', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid data parameters.' });
    }

    const drive = await Drive.findOne({ _id: driveId, company: req.user.id });
    if (!drive) return res.status(404).json({ message: 'Drive not found or unauthorized.' });

    // Find applicant and update status
    const applicantIndex = drive.applicants.findIndex(app => app.student.toString() === studentId.toString());
    if (applicantIndex === -1) {
      return res.status(404).json({ message: 'Applicant not found in this drive.' });
    }

    drive.applicants[applicantIndex].status = status;
    await drive.save();

    // Also update associated QuizResult status if exists
    const quiz = await Quiz.findOne({ drive: driveId });
    if (quiz) {
      const result = await QuizResult.findOne({ student: studentId, quiz: quiz._id });
      if (result) {
        result.status = status === 'Shortlisted' ? 'Qualified' : 'Rejected';
        await result.save();
      }
    }

    res.json({ message: `Candidate application status updated to ${status}.` });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ==========================================
// 4. ADMIN DASHBOARD ENDPOINTS
// ==========================================

// Get all drives for approval system
app.get('/api/admin/drives', verifyToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const drives = await Drive.find().sort({ createdAt: -1 });
    res.json(drives);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// Approve Drive
app.post('/api/admin/drives/:id/approve', verifyToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const drive = await Drive.findById(req.params.id);
    if (!drive) return res.status(404).json({ message: 'Drive not found.' });

    drive.status = 'Approved';
    await drive.save();
    res.json({ message: 'Drive approved successfully.', drive });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// Reject Drive
app.post('/api/admin/drives/:id/reject', verifyToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const drive = await Drive.findById(req.params.id);
    if (!drive) return res.status(404).json({ message: 'Drive not found.' });

    drive.status = 'Rejected';
    await drive.save();
    res.json({ message: 'Drive rejected successfully.', drive });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// User Management (Fetch list of students and companies)
app.get('/api/admin/users', verifyToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const students = await Student.find().select('-password').sort({ createdAt: -1 });
    const companies = await Company.find().select('-password').sort({ createdAt: -1 });
    res.json({ students, companies });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// Dashboard Analytics Statistics
app.get('/api/admin/stats', verifyToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments();
    const totalCompanies = await Company.countDocuments();
    const totalDrives = await Drive.countDocuments();
    const approvedDrives = await Drive.countDocuments({ status: 'Approved' });
    const pendingDrives = await Drive.countDocuments({ status: 'Pending' });
    const totalQuizzes = await Quiz.countDocuments();

    // Calculate total applications
    const drives = await Drive.find();
    let totalApplications = 0;
    drives.forEach(drive => {
      totalApplications += drive.applicants.length;
    });

    res.json({
      totalStudents,
      totalCompanies,
      totalDrives,
      approvedDrives,
      pendingDrives,
      totalQuizzes,
      totalApplications
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// Wildcard route to serve landing page for all unknown frontend pages
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`PDMS Server running on port ${PORT}`);
});
