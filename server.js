const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// MySQL Database Connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'farazop321',
  database: 'attendance_system'
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.log('❌ Database connection failed: ', err);
    return;
  }
  console.log('✅ Connected to MySQL Database!');
});

const SECRET_KEY = 'class_attendance_secret';

// ==================== AUTH ====================

// REGISTRATION ENDPOINT
app.post('/register', async (req, res) => {
  const { rollNo, fullName, password, role = 'student' } = req.body;

  try {
    const checkQuery = 'SELECT * FROM students WHERE roll_number = ?';
    db.query(checkQuery, [rollNo], async (err, results) => {
      if (err) {
        console.log('Database error:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      if (results.length > 0) {
        return res
          .status(400)
          .json({ message: 'You are already enrolled, you idiot! 🤦‍♂️' });
      }

      // 1) Password rule (example):
      // - 8 to 16 characters
      // - only letters and numbers (no special chars)
      // - at least one capital letter
      const passwordRegex = /^(?=.*[A-Z])[A-Za-z0-9]{8,16}$/;

      if (!passwordRegex.test(password)) {
        return res.status(400).json({
        message:
        'Password must be 8–16 characters, only letters and digits, and contain at least one capital letter.'
       });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const insertQuery =
        'INSERT INTO students (roll_number, full_name, password, role) VALUES (?, ?, ?, ?)';
      db.query(
        insertQuery,
        [rollNo, fullName, hashedPassword, role],
        (err2, insertRes) => {
          if (err2) {
            console.log('Insert error:', err2);
            return res.status(500).json({ message: 'Registration failed' });
          }

          res.json({
            message: 'Account created successfully! Welcome to the squad! 🎉',
            studentId: insertRes.insertId
          });
        }
      );
    });
  } catch (error) {
    console.log('Server error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// LOGIN ENDPOINT
app.post('/login', async (req, res) => {
  const { username, password, role } = req.body;

  console.log('🔐 Login attempt:', { username, role, password });

  try {
    const query = 'SELECT * FROM students WHERE roll_number = ?';
    db.query(query, [username], async (err, results) => {
      if (err) {
        console.log('❌ Database error:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      if (results.length === 0) {
        console.log('❌ User not found:', username);
        return res.status(401).json({ message: 'Invalid username or password' });
      }

      const user = results[0];
      console.log(
        '✅ User found:',
        user.roll_number,
        'Role:',
        user.role,
        'Password in DB:',
        user.password
      );

      if (user.role !== role) {
        console.log('❌ Role mismatch. Expected:', role, 'Got:', user.role);
        return res.status(401).json({ message: 'Invalid role selection' });
      }

      let isPasswordValid = false;

      if (user.roll_number === '2023F-BCS-096') {
        console.log(
          '🔑 CR Login - Input password:',
          password,
          'Expected: hellocr'
        );
        isPasswordValid = password === 'hellocr';
        console.log('🔑 CR Password match:', isPasswordValid);
      } else {
        isPasswordValid = await bcrypt.compare(password, user.password);
        console.log('🔑 Student Password match:', isPasswordValid);
      }

      if (!isPasswordValid) {
        console.log('❌ Password validation failed');
        return res.status(401).json({ message: 'Invalid username or password' });
      }

      const token = jwt.sign(
        {
          id: user.id,
          username: user.roll_number,
          role: user.role
        },
        SECRET_KEY,
        { expiresIn: '1h' }
      );

      console.log('🎉 Login successful for:', user.roll_number);

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.roll_number,
          role: user.role,
          name: user.full_name
        }
      });
    });
  } catch (error) {
    console.log('❌ Server error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== ATTENDANCE SESSION ENDPOINTS ====================

// CREATE ATTENDANCE SESSION
app.post('/api/create-session', (req, res) => {
  const { course, duration, createdBy } = req.body;

  const sessionCode =
    'SESS-' + Math.random().toString(36).substr(2, 8).toUpperCase();
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + duration * 60000);

  const query = `
    INSERT INTO attendance_sessions (session_code, course, duration_minutes, start_time, end_time, created_by, status) 
    VALUES (?, ?, ?, ?, ?, ?, 'active')
  `;

  db.query(
    query,
    [sessionCode, course, duration, startTime, endTime, createdBy],
    (err, results) => {
      if (err) {
        console.log('❌ Session creation failed:', err);
        return res.status(500).json({ message: 'Failed to create session' });
      }

      console.log('✅ Session created:', sessionCode, 'for course:', course);
      res.json({
        message: 'Session created successfully!',
        sessionId: results.insertId,
        sessionCode: sessionCode,
        startTime: startTime,
        endTime: endTime
      });
    }
  );
});

// GET ACTIVE SESSIONS
app.get('/api/active-sessions', (req, res) => {
  const query =
    'SELECT * FROM attendance_sessions WHERE status = "active" AND end_time > NOW()';

  db.query(query, (err, results) => {
    if (err) {
      console.log('❌ Failed to fetch active sessions:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    res.json(results);
  });
});

// END SESSION
app.post('/api/end-session/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;

  const query = 'UPDATE attendance_sessions SET status = "ended" WHERE id = ?';

  db.query(query, [sessionId], (err) => {
    if (err) {
      console.log('❌ Failed to end session:', err);
      return res.status(500).json({ message: 'Failed to end session' });
    }

    res.json({ message: 'Session ended successfully!' });
  });
});

// ==================== DASHBOARD DATA ENDPOINTS ====================

// GET DASHBOARD STATS (per current active session)
app.get('/api/dashboard-stats', (req, res) => {
  const activeSessionQuery = `
    SELECT * 
    FROM attendance_sessions 
    WHERE status = "active" 
      AND end_time > NOW()
    ORDER BY start_time DESC
    LIMIT 1
  `;

  db.query(activeSessionQuery, (err, sessionResults) => {
    if (err) {
      console.log('❌ Dashboard stats: active session error:', err);
      return res.status(500).json({ message: 'Failed to fetch dashboard stats' });
    }

    if (sessionResults.length === 0) {
      return res.json({
        sessionId: null,
        presentCount: 0,
        absentCount: 0,
        flaggedCount: 0
      });
    }

    const session = sessionResults[0];

    // count only non-removed records
   const presentAndFlaggedQuery = `
  SELECT
    COUNT(*) AS presentCount,
    SUM(
      CASE 
        WHEN flag_reason IS NOT NULL AND status = 'pending' THEN 1 
        ELSE 0 
      END
    ) AS flaggedCount
  FROM attendance_records
  WHERE session_id = ?
    AND status <> 'removed'
`;


    const totalStudentsQuery = `SELECT COUNT(*) AS totalStudents FROM students`;

    Promise.all([
      db.promise().query(presentAndFlaggedQuery, [session.id]),
      db.promise().query(totalStudentsQuery)
    ])
      .then(([presentRows, totalRows]) => {
        const presentCount = presentRows[0][0].presentCount || 0;
        const flaggedCount = presentRows[0][0].flaggedCount || 0;
        const totalStudents = totalRows[0][0].totalStudents || 0;
        const absentCount = Math.max(totalStudents - presentCount, 0);

        res.json({
          sessionId: session.id,
          presentCount,
          absentCount,
          flaggedCount
        });
      })
      .catch((err2) => {
        console.log('❌ Dashboard stats error:', err2);
        res
          .status(500)
          .json({ message: 'Failed to fetch dashboard stats' });
      });
  });
});

// GET RECENT ATTENDANCE ACTIVITY
app.get('/api/recent-activity', (req, res) => {
  const query = `
    SELECT 
      ar.id,
      ar.student_roll_no,
      s.full_name,
      ases.course,
      ar.timestamp,
      ar.device_id,
      ar.latitude,
      ar.longitude,
      ar.flag_reason,
      ar.status
    FROM attendance_records ar
    JOIN students s ON ar.student_roll_no = s.roll_number
    JOIN attendance_sessions ases ON ar.session_id = ases.id
    ORDER BY ar.timestamp DESC
    LIMIT 10
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.log('❌ Recent activity error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    res.json(results);
  });
});

// ==================== ATTENDANCE ADMIN ACTIONS ====================

// Approve attendance (set status = 'approved')
app.post('/api/attendance/:id/approve', (req, res) => {
  const id = req.params.id;

  const query = `
    UPDATE attendance_records
    SET status = 'approved'
    WHERE id = ?
  `;

  db.query(query, [id], (err, result) => {
    if (err) {
      console.log('❌ Approve attendance error:', err);
      return res.status(500).json({ message: 'Failed to approve attendance' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    res.json({ message: 'Attendance approved successfully' });
  });
});

// Remove attendance (set status = 'removed')
app.post('/api/attendance/:id/remove', (req, res) => {
  const id = req.params.id;

  const query = `
    UPDATE attendance_records
    SET status = 'removed'
    WHERE id = ?
  `;

  db.query(query, [id], (err, result) => {
    if (err) {
      console.log('❌ Remove attendance error:', err);
      return res.status(500).json({ message: 'Failed to remove attendance' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    res.json({ message: 'Attendance removed successfully' });
  });
});


// ==================== ATTENDANCE MARKING ENDPOINT ====================

// MARK ATTENDANCE
app.post('/api/mark-attendance', (req, res) => {
  const { sessionCode, studentRollNo, deviceId, latitude, longitude } = req.body;

  if (!sessionCode || !studentRollNo || !deviceId) {
    return res
      .status(400)
      .json({ message: 'sessionCode, studentRollNo and deviceId are required' });
  }

  const sessionQuery = `
    SELECT * 
    FROM attendance_sessions 
    WHERE session_code = ? 
      AND status = "active" 
      AND end_time > NOW()
  `;

  db.query(sessionQuery, [sessionCode], (err, sessionResults) => {
    if (err) {
      console.log('❌ Session lookup error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (sessionResults.length === 0) {
      return res
        .status(400)
        .json({ message: 'Invalid or expired session code' });
    }

    const session = sessionResults[0];

    const studentCheckQuery = `
      SELECT * 
      FROM attendance_records 
      WHERE session_id = ? 
        AND student_roll_no = ?
        AND status <> 'removed'
    `;

    db.query(
      studentCheckQuery,
      [session.id, studentRollNo],
      (err2, attendanceResults) => {
        if (err2) {
          console.log('❌ Student attendance check error:', err2);
          return res.status(500).json({ message: 'Database error' });
        }

        if (attendanceResults.length > 0) {
          return res
            .status(400)
            .json({ message: 'Attendance already marked for this session' });
        }

        const deviceCheckQuery = `
          SELECT student_roll_no 
          FROM attendance_records 
          WHERE session_id = ? 
            AND device_id = ? 
            AND student_roll_no <> ?
            AND status <> 'removed'
        `;

        db.query(
          deviceCheckQuery,
          [session.id, deviceId, studentRollNo],
          (err3, deviceResults) => {
            if (err3) {
              console.log('❌ Device check error:', err3);
              return res.status(500).json({ message: 'Database error' });
            }

            let flagReason = null;

            if (deviceResults.length > 0) {
              flagReason = 'Shared device';
            }

            const insertQuery = `
              INSERT INTO attendance_records 
                (session_id, student_roll_no, device_id, latitude, longitude, timestamp, flag_reason, status) 
              VALUES (?, ?, ?, ?, ?, NOW(), ?, 'pending')
            `;

            db.query(
              insertQuery,
              [session.id, studentRollNo, deviceId, latitude, longitude, flagReason],
              (err4) => {
                if (err4) {
                  console.log('❌ Attendance marking failed:', err4);
                  return res
                    .status(500)
                    .json({ message: 'Failed to mark attendance' });
                }

                console.log(
                  '✅ Attendance marked:',
                  studentRollNo,
                  'session:',
                  sessionCode,
                  flagReason ? '(FLAGGED: ' + flagReason + ')' : ''
                );

                if (flagReason) {
                  return res.json({
                    message:
                      'Marked present. Note: this device is already used by another student in this session and will be reviewed by CR.',
                    flagReason
                  });
                }

                res.json({
                  message: 'Attendance marked successfully! ✅',
                  flagReason: null
                });
              }
            );
          }
        );
      }
    );
  });
});

// ==================== DEBUG ROUTES ====================

// Real students list for admin dashboard (no passwords)
app.get('/api/students', (req, res) => {
  const query = `
    SELECT 
      id,
      roll_number,
      full_name
    FROM students
    ORDER BY roll_number ASC
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.log('❌ Students list error:', err);
      return res.status(500).json({ message: 'Failed to fetch students' });
    }
    res.json(results);
  });
});


app.get('/debug-user/:rollNo', (req, res) => {
  const rollNo = req.params.rollNo;
  db.query(
    'SELECT * FROM students WHERE roll_number = ?',
    [rollNo],
    (err, results) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json(results);
    }
  );
});

// ==================== START SERVER ====================

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('📊 Database: MySQL (attendance_system)');
  console.log('🔧 Debug routes available:');
  console.log('   GET /students - View all users');
  console.log('   GET /debug-user/:rollNo - Check specific user');
  console.log('');
  console.log('🎯 CR Login should work with:');
  console.log('   Username: 2023F-BCS-096');
  console.log('   Password: hellocr');
  console.log('   Role: cr');
  console.log('');
  console.log('🆕 ADMIN ENDPOINTS:');
  console.log('   POST /api/create-session');
  console.log('   GET  /api/active-sessions');
  console.log('   POST /api/end-session/:sessionId');
  console.log('   GET  /api/dashboard-stats');
  console.log('   GET  /api/recent-activity');
  console.log('   POST /api/mark-attendance');
});
