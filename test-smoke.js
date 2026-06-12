require('dotenv').config();
const mongoose = require('mongoose');

console.log('--- PDMS Smoke Test: Loading Database Schemas ---');
try {
  const Student = require('./models/Student');
  console.log('✓ Student model loaded successfully.');
  
  const Company = require('./models/Company');
  console.log('✓ Company model loaded successfully.');
  
  const Drive = require('./models/Drive');
  console.log('✓ Drive model loaded successfully.');
  
  const Quiz = require('./models/Quiz');
  console.log('✓ Quiz model loaded successfully.');
  
  const QuizResult = require('./models/QuizResult');
  console.log('✓ QuizResult model loaded successfully.');

  console.log('\nAll models loaded successfully without syntax errors!');
  
  // Print configured port and connection URI
  console.log(`Configured Server Port: ${process.env.PORT || 5000}`);
  console.log(`Configured Database URI: ${process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pdms'}`);
  
  process.exit(0);
} catch (error) {
  console.error('✗ Test failed: Error loading schemas.');
  console.error(error);
  process.exit(1);
}
