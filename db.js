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
      walletaddress TEXT,
      balance REAL DEFAULT 0,
      joinDate TEXT
    )
  `);

});

// Insert or update user
const addUser = (userId, username, walletaddress, callback) => {
  const joinDate = new Date().toISOString();
  dbInstance.run(
    `
    INSERT INTO users (userId, username, walletaddress, joinDate)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(userId) DO UPDATE SET username = excluded.username, walletaddress = excluded.walletaddress
  `,
    [userId, username, walletaddress, joinDate],
    (err) => {
      if (err) {
        console.error('Error adding user:', err);
        callback(err);
      } else {
        callback(null);
      }
    }
  );
};

// Get user balance
const getUserBalance = (userId) => {
  return new Promise((resolve, reject) => {
    dbInstance.get(
      'SELECT balance FROM users WHERE userId = ?',
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
      UPDATE users
      SET balance = ?
      WHERE userId = ?
    `,
      [amount, userId],
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

// Get walletaddress by ID
const getWalletById = (userId) => {
  return new Promise((resolve, reject) => {
    dbInstance.get(
      'SELECT walletaddress FROM users WHERE userId = ?',
      [userId],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? row.walletaddress : null); // Return null if no walletaddress found
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
  getWalletById,
};
