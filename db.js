const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'bot.db');
const dbInstance = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Initialize tables
dbInstance.serialize(() => {
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS users (
      userId INTEGER PRIMARY KEY,
      username TEXT,
      joinDate TEXT
    )
  `);

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS balances (
      userId INTEGER PRIMARY KEY,
      balance REAL DEFAULT 0,
      lastUpdated TEXT,
      FOREIGN KEY (userId) REFERENCES users(userId)
    )
  `);

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      senderId INTEGER,
      recipientId INTEGER,
      amount REAL,
      date TEXT,
      FOREIGN KEY (senderId) REFERENCES users(userId),
      FOREIGN KEY (recipientId) REFERENCES users(userId)
    )
  `);
});

// Insert or update user
const addUser = (userId, username, callback) => {
  const joinDate = new Date().toISOString();
  dbInstance.run(
    `
    INSERT INTO users (userId, username, joinDate)
    VALUES (?, ?, ?)
    ON CONFLICT(userId) DO UPDATE SET username = excluded.username
  `,
    [userId, username, joinDate],
    (err) => {
      if (err) {
        console.error('Error adding user:', err);
        callback(err);
      } else {
        dbInstance.run(
          `
          INSERT INTO balances (userId, balance, lastUpdated)
          VALUES (?, 90, ?)
          ON CONFLICT(userId) DO NOTHING
        `,
          [userId, joinDate],
          callback
        );
      }
    }
  );
};

// Get user balance
const getUserBalance = (userId) => {
  return new Promise((resolve, reject) => {
    dbInstance.get(
      'SELECT balance FROM balances WHERE userId = ?',
      [userId],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? row.balance : 0); // Return 0 if no balance found
        }
      }
    );
  });
};

// Update user balance
const updateBalance = (userId, amount) => {
  return new Promise((resolve, reject) => {
    const lastUpdated = new Date().toISOString();
    dbInstance.run(
      `
      UPDATE balances
      SET balance = balance + ?, lastUpdated = ?
      WHERE userId = ?
    `,
      [amount, lastUpdated, userId],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0); // Returns true if a row was updated
        }
      }
    );
  });
};

// Log transaction
const logTransaction = (senderId, recipientId, amount) => {
  return new Promise((resolve, reject) => {
    const date = new Date().toISOString();
    dbInstance.run(
      `
      INSERT INTO transactions (senderId, recipientId, amount, date)
      VALUES (?, ?, ?, ?)
    `,
      [senderId, recipientId, amount, date],
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
};

// Get user by ID
const getUserById = (userId) => {
  return new Promise((resolve, reject) => {
    dbInstance.get(
      'SELECT userId, username FROM users WHERE userId = ?',
      [userId],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      }
    );
  });
};

// Get user by username
const getUserByUsername = (username) => {
  return new Promise((resolve, reject) => {
    dbInstance.get(
      'SELECT userId, username FROM users WHERE username = ?',
      [username],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      }
    );
  });
};

// Export functions
module.exports = {
  addUser,
  getUserBalance,
  updateBalance,
  logTransaction,
  getUserById,
  getUserByUsername,
};
