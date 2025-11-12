const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: [
    'http://localhost',
    'http://127.0.0.1',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
  ],
  credentials: true
}));

app.use(session({
  secret: 'gdlux-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));


// MySQL bootstrap: ensure database and tables exist
const mysqlConfig = { host: 'localhost', user: 'root', password: '' };
const dbName = 'gdlux_store';

function ensureDatabaseAndTables(callback) {
  const root = mysql.createConnection(mysqlConfig);
  root.connect(err => {
    if (err) {
      console.error('MySQL root connection error:', err);
      return callback(err);
    }
    root.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`` , (err) => {
      if (err) {
        console.error('Error creating database:', err);
        root.end();
        return callback(err);
      }

      // Connect to target DB
      const db = mysql.createConnection({ ...mysqlConfig, database: dbName, multipleStatements: true });
      db.connect(err => {
        if (err) {
          console.error('MySQL DB connection error:', err);
          root.end();
          return callback(err);
        }

        const createUsers = `
          CREATE TABLE IF NOT EXISTS users (
            user_id INT AUTO_INCREMENT PRIMARY KEY,
            fullname VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            role ENUM('user','admin') NOT NULL DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_email (email)
          );
        `;

        db.query(createUsers, async (err) => {
          if (err) {
            console.error('Error creating users table:', err);
            root.end();
            db.end();
            return callback(err);
          }

          // Ensure schema columns exist (e.g., role)
          ensureUsersSchema(db, dbName, async (migErr) => {
            if (migErr) {
              console.error('Error ensuring users schema:', migErr);
              root.end();
              db.end();
              return callback(migErr);
            }

            // Seed default admin if missing
            const adminEmail = 'admin@gdlux.com';
            const adminPass = 'admin123';
            const adminName = 'Site Admin';
            db.query('SELECT user_id FROM users WHERE email = ?', [adminEmail], async (err, rows) => {
              if (err) {
                console.error('Error checking admin user:', err);
                root.end();
                db.end();
                return callback(err);
              }
              if (rows.length === 0) {
                const hash = await bcrypt.hash(adminPass, 10);
                db.query('INSERT INTO users (fullname, email, password, role) VALUES (?, ?, ?, ?)',
                  [adminName, adminEmail, hash, 'admin'], (err) => {
                    if (err) console.error('Error seeding admin:', err);
                    root.end();
                    return callback(null, db);
                  });
              } else {
                root.end();
                return callback(null, db);
              }
            });
          });
        });
      });
    });
  });
}

// Ensure users table has expected columns, migrate if needed
function ensureUsersSchema(db, schemaName, cb) {
  // Check if 'role' column exists
  const checkRole = `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'`;
  db.query(checkRole, [schemaName], (err, rows) => {
    if (err) return cb(err);
    const hasRole = rows.length > 0;
    const tasks = [];

    if (!hasRole) {
      tasks.push(new Promise((resolve, reject) => {
        db.query("ALTER TABLE users ADD COLUMN role ENUM('user','admin') NOT NULL DEFAULT 'user' AFTER password", (e) => {
          if (e) return reject(e);
          resolve();
        });
      }));
    }

    // Ensure email is UNIQUE (older table might miss constraint)
    tasks.push(new Promise((resolve) => {
      db.query("SHOW INDEX FROM users WHERE Key_name = 'email'", (e, idx) => {
        if (e) return resolve();
        const hasUnique = Array.isArray(idx) && idx.some(i => i.Column_name === 'email' && i.Non_unique === 0);
        if (!hasUnique) {
          db.query('ALTER TABLE users ADD UNIQUE KEY `email` (email)', () => resolve());
        } else {
          resolve();
        }
      });
    }));

    Promise.all(tasks).then(() => cb(null)).catch(cb);
  });
}

let db; // will hold the connected DB

ensureDatabaseAndTables((err, connectedDb) => {
  if (err) {
    console.error('Failed to initialize database.');
    process.exit(1);
  }
  db = connectedDb;
  console.log('MySQL ready. Database and tables ensured.');
});

// Auth helpers
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ message: 'Unauthorized' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
}

// Routes: Signup
app.post('/signup', async (req, res) => {
  try {
    const { fullname, email, password } = req.body;
    if (!fullname || !email || !password) {
      return res.status(400).json({ message: 'fullname, email, and password are required' });
    }

    db.query('SELECT user_id FROM users WHERE email = ?', [email], async (err, rows) => {
      if (err) return res.status(500).json({ message: 'DB error' });
      if (rows.length > 0) return res.status(409).json({ message: 'Email already registered' });

      const hash = await bcrypt.hash(password, 10);
      db.query('INSERT INTO users (fullname, email, password, role) VALUES (?, ?, ?, ?)',
        [fullname, email, hash, 'user'], (err, result) => {
          if (err) return res.status(500).json({ message: 'DB error' });
          res.json({ message: 'Signup successful', user_id: result.insertId });
        });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Routes: Signin (matches SignIn.html expects /signin)
app.post('/signin', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'email and password are required' });

  db.query('SELECT user_id, fullname, email, password, role FROM users WHERE email = ?', [email], async (err, rows) => {
    if (err) return res.status(500).json({ message: 'DB error' });
    if (rows.length === 0) return res.status(401).json({ message: 'Invalid credentials' });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    req.session.user = { id: user.user_id, fullname: user.fullname, email: user.email, role: user.role };
    res.json({ message: 'Signed in', fullname: user.fullname, role: user.role });
  });
});

// Routes: Signout
app.post('/signout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Signed out' });
  });
});

// Routes: Current user
app.get('/auth/me', (req, res) => {
  if (!req.session.user) return res.status(200).json({ authenticated: false });
  res.json({ authenticated: true, user: req.session.user });
});


// Example admin-protected route
app.get('/admin/secure-check', requireAdmin, (req, res) => {
  res.json({ ok: true, message: 'Admin access granted' });
});

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

// Start server
const PORT = 5000;
app.listen(PORT, () => console.log(`Auth API running on port ${PORT}`));

const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Test route — send email
app.post('/send-email', async (req, res) => {
  const { to, subject, text } = req.body;

  // 1️⃣ Configure the mail transporter
  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'youremail@gmail.com',   // ✨ your Gmail
      pass: 'your-app-password'      // ✨ your App Password (not normal password)
    }
  });

  // 2️⃣ Set up the email options
  let mailOptions = {
    from: '"G&D LUX" <youremail@gmail.com>',
    to,
    subject,
    text
  };

  // 3️⃣ Send the email
  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully');
    res.json({ message: 'Email sent successfully!' });
  } catch (err) {
    console.error('❌ Error sending email:', err);
    res.status(500).json({ message: 'Error sending email' });
  }
});

// Run the server
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
// Example in server.js
app.post('/signup', async (req, res) => {
  const { fullname, email, password } = req.body;

  // Normally you'd hash password and save user
  // Here, just for demo:
  const otp = "111"; // <-- Fixed OTP for testing

  // Save user temporarily with OTP
  await User.create({ fullname, email, password, otp });

  res.status(200).json({ message: "Signup successful! OTP sent to email.", otp });
});
