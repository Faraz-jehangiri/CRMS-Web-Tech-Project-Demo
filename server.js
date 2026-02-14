const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Serve static files from public folder
app.use(express.static('public'));

// ==================== DEMO DATA (NO DATABASE) ====================

// Hardcoded CR/Admin demo account
const demoAdmin = {
  id: 1,
  roll_number: '2023F-BCS-096', // matches your placeholder style
  full_name: 'Demo CR Admin',
  password: 'hellocr',          // easy CR demo password
  role: 'cr'
};

// Demo students (start with one, teacher can also register new ones)
let demoStudents = [
  {
    id: 1,
    roll_number: 'STUDENT123',
    full_name: 'Demo Student',
    age: 20,
    password: 'Student123', // fits your password rule (capital + letters/digits)
    role: 'student'
  }
];

// Demo dashboard/session data
let demoDashboardStats = {
  sessionId: 1,
  presentCount: 15,
  absentCount: 5,
  flaggedCount: 2
};

let demoRecentActivity = [
  {
    id: 1,
    student_roll_no: '2023F-BCS-001',
    full_name: 'Ali Ahmed',
    course: 'Web Technologies',
    timestamp: new Date(),
    device_id: 'device-123',
    latitude: 24.8607,
    longitude: 67.0011,
    flag_reason: null,
    status: 'approved'
  },
  {
    id: 2,
    student_roll_no: '2023F-BCS-002',
    full_name: 'Sara Khan',
    course: 'Web Technologies',
    timestamp: new Date(),
    device_id: 'device-456',
    latitude: 24.8607,
    longitude: 67.0011,
    flag_reason: 'Shared device',
    status: 'pending'
  }
];

// ==================== AUTH (DEMO) ====================

// STUDENT REGISTRATION (DEMO)
// Frontend sends: { rollNo, fullName, password, role: 'student' }
app.post('/register', (req, res) => {
  const { rollNo, fullName, password, role = 'student' } = req.body;

  if (!rollNo || !fullName || !password) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  // Simple duplicate check
  const existing = demoStudents.find((s) => s.roll_number === rollNo);
  if (existing) {
    return res
      .status(400)
      .json({ message: 'You are already enrolled (demo).' });
  }

  const newStudent = {
    id: demoStudents.length + 1,
    roll_number: rollNo,
    full_name: fullName,
    age: null,
    password: password,
    role
  };
  demoStudents.push(newStudent);

  res.json({
    message: 'Account created successfully! (Demo)',
    studentId: newStudent.id
  });
});

// LOGIN (DEMO)
// Student page sends: role: 'student'
// Admin page sends:   role: 'cr'
app.post('/login', (req, res) => {
  const { username, password, role } = req.body;

  console.log('🔐 Demo login attempt:', { username, role });

  // CR/Admin login
  if (role === 'cr') {
    if (
      username === demoAdmin.roll_number &&
      password === demoAdmin.password
    ) {
      console.log('🎉 Demo CR login success:', demoAdmin.roll_number);
      return res.json({
        message: 'CR/Admin login successful',
        token: 'demo-admin-token',
        user: {
          id: demoAdmin.id,
          username: demoAdmin.roll_number,
          role: demoAdmin.role,
          name: demoAdmin.full_name
        }
      });
    }

    console.log('❌ Demo CR login failed');
    return res
      .status(401)
      .json({ message: 'Invalid CR/admin username or password' });
  }

  // Student login
  if (role === 'student') {
    const student = demoStudents.find(
      (s) =>
        s.roll_number === username && s.password === password
    );

    if (!student) {
      console.log('❌ Demo STUDENT login failed');
      return res
        .status(401)
        .json({ message: 'Invalid student username or password' });
    }

    console.log('🎉 Demo STUDENT login success:', student.roll_number);

    return res.json({
      message: 'Student login successful',
      token: 'demo-student-token',
      user: {
        id: student.id,
        username: student.roll_number,
        role: student.role,
        name: student.full_name
      }
    });
  }

  return res.status(400).json({ message: 'Invalid role' });
});

// ==================== ATTENDANCE SESSION (DEMO) ====================

app.post('/api/create-session', (req, res) => {
  const { course, duration, createdBy } = req.body;

  const sessionCode =
    'SESS-' + Math.random().toString(36).substr(2, 8).toUpperCase();
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + (duration || 30) * 60000);

  demoDashboardStats = {
    sessionId: 1,
    presentCount: 10,
    absentCount: 10,
    flaggedCount: 1
  };

  res.json({
    message: 'Demo session created successfully!',
    sessionId: 1,
    sessionCode,
    startTime,
    endTime
  });
});

app.get('/api/active-sessions', (req, res) => {
  res.json([
    {
      id: 1,
      session_code: 'SESS-DEMO1234',
      course: 'Web Technologies',
      duration_minutes: 30,
      start_time: new Date(),
      end_time: new Date(new Date().getTime() + 30 * 60000),
      created_by: demoAdmin.roll_number,
      status: 'active'
    }
  ]);
});

app.post('/api/end-session/:sessionId', (req, res) => {
  res.json({ message: 'Demo session ended successfully!' });
});

// ==================== DASHBOARD DATA (DEMO) ====================

app.get('/api/dashboard-stats', (req, res) => {
  res.json(demoDashboardStats);
});

app.get('/api/recent-activity', (req, res) => {
  res.json(demoRecentActivity);
});

// ==================== ATTENDANCE ACTIONS (DEMO) ====================

app.post('/api/attendance/:id/approve', (req, res) => {
  res.json({ message: 'Demo: Attendance approved successfully' });
});

app.post('/api/attendance/:id/remove', (req, res) => {
  res.json({ message: 'Demo: Attendance removed successfully' });
});

// ==================== MARK ATTENDANCE (DEMO) ====================

app.post('/api/mark-attendance', (req, res) => {
  const { sessionCode, studentRollNo, deviceId, latitude, longitude } =
    req.body;

  if (!sessionCode || !studentRollNo || !deviceId) {
    return res.status(400).json({
      message: 'sessionCode, studentRollNo and deviceId are required'
    });
  }

  demoRecentActivity.unshift({
    id: demoRecentActivity.length + 1,
    student_roll_no: studentRollNo,
    full_name: 'Demo Student ' + studentRollNo,
    course: 'Web Technologies',
    timestamp: new Date(),
    device_id: deviceId,
    latitude: latitude || 24.8607,
    longitude: longitude || 67.0011,
    flag_reason: null,
    status: 'pending'
  });

  res.json({
    message: 'Demo: Attendance marked successfully! ✅',
    flagReason: null
  });
});

// ==================== STUDENTS LIST (DEMO) ====================

app.get('/api/students', (req, res) => {
  const list = demoStudents.map((s) => ({
    id: s.id,
    roll_number: s.roll_number,
    full_name: s.full_name
  }));
  res.json(list);
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Demo server running on http://localhost:${PORT}`);
  console.log('');
  console.log('🎯 DEMO LOGINS:');
  console.log('   CR/Admin (admin-login.html):');
  console.log('     roll number: 2023F-BCS-096');
  console.log('     password:    hellocr');
  console.log('     role:        cr');
  console.log('   Student (student-login.html pre-created):');
  console.log('     roll number: STUDENT123');
  console.log('     password:    Student123');
  console.log('     role:        student');
  console.log('');
  console.log('➕ Teacher can also register new students on student-register.html (saves in demo memory).');
});
