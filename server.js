/* ==========================================================================
   EliteMess - Premium Full-Stack Node.js (Express) & PostgreSQL API Server
   ========================================================================== */

const express = require('express');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Express Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================================================
// PostgreSQL Database Configuration & Connection Pool
// ==========================================================================
const isProduction = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;

// Link database using Railway's DATABASE_URL or fall back to local PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

// Helper: Formats Date objects to YYYY-MM-DD
function formatDate(date) {
  const d = new Date(date);
  let month = '' + (d.getMonth() + 1);
  let day = '' + d.getDate();
  const year = d.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('-');
}

// ==========================================================================
// Automatic Database Schema Initialization
// ==========================================================================
async function initDB() {
  console.log("Checking database tables and initializing schemas...");
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // 1. Create Members Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS members (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        email VARCHAR(100),
        password VARCHAR(100) DEFAULT '1234'
      );
    `);

    // Run migration to add password column to existing databases
    await client.query(`
      ALTER TABLE members ADD COLUMN IF NOT EXISTS password VARCHAR(100) DEFAULT '1234';
    `);

    // 2. Create Deposits Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS deposits (
        id VARCHAR(50) PRIMARY KEY,
        member_id VARCHAR(50) REFERENCES members(id) ON DELETE CASCADE,
        amount NUMERIC NOT NULL,
        date DATE NOT NULL,
        notes TEXT
      );
    `);

    // 3. Create Bazaar Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bazaar (
        id VARCHAR(50) PRIMARY KEY,
        member_id VARCHAR(50) REFERENCES members(id) ON DELETE CASCADE,
        amount NUMERIC NOT NULL,
        date DATE NOT NULL,
        items TEXT NOT NULL
      );
    `);

    // 4. Create Other Expenses Table (Shared bills)
    await client.query(`
      CREATE TABLE IF NOT EXISTS other_expenses (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL,
        amount NUMERIC NOT NULL,
        date DATE NOT NULL
      );
    `);

    // 5. Create Meals Table (Matrix)
    await client.query(`
      CREATE TABLE IF NOT EXISTS meals (
        date DATE NOT NULL,
        member_id VARCHAR(50) REFERENCES members(id) ON DELETE CASCADE,
        breakfast NUMERIC DEFAULT 0,
        lunch NUMERIC DEFAULT 0,
        dinner NUMERIC DEFAULT 0,
        PRIMARY KEY (date, member_id)
      );
    `);

    await client.query('COMMIT');
    console.log("Database schema verification completed successfully.");

    // Check if new database. If empty, seed mock data immediately
    const checkMembers = await client.query('SELECT COUNT(*) FROM members');
    if (parseInt(checkMembers.rows[0].count) === 0) {
      console.log("New database detected. Seeding beautiful initial mock dataset...");
      await seedMockData(client);
    }

  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error("Rollback failed!", rollbackErr);
      }
    }
    console.error("Database schema initialization failed! Server is running, but database connection is unavailable.", err);
  } finally {
    if (client) client.release();
  }
}

// ==========================================================================
// Mock Data Seeding (PostgreSQL Seed Transaction)
// ==========================================================================
async function seedMockData(client) {
  const today = new Date();
  const dStr = (offset) => {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    return formatDate(d);
  };

  try {
    // 1. Seed Members
    await client.query(`
      INSERT INTO members (id, name, phone, email) VALUES
      ('mem-1', 'Rakib Ahmed', '01711223344', 'rakib@gmail.com'),
      ('mem-2', 'Abir Hasan', '01999887766', 'abir@gmail.com'),
      ('mem-3', 'Sajid Islam', '01555443322', 'sajid@gmail.com');
    `);

    // 2. Seed Deposits
    await client.query(`
      INSERT INTO deposits (id, member_id, amount, date, notes) VALUES
      ('dep-1', 'mem-1', 3000, '${dStr(5)}', 'Bkash Deposit'),
      ('dep-2', 'mem-2', 2500, '${dStr(5)}', 'Cash Deposit'),
      ('dep-3', 'mem-3', 3500, '${dStr(5)}', 'Cash Deposit'),
      ('dep-4', 'mem-1', 1000, '${dStr(2)}', 'Hand Cash');
    `);

    // 3. Seed Bazaar expenses
    await client.query(`
      INSERT INTO bazaar (id, member_id, amount, date, items) VALUES
      ('baz-1', 'mem-1', 1450, '${dStr(4)}', 'Beef 2kg, Cooking Oil 2L, Onions, Spices'),
      ('baz-2', 'mem-2', 820, '${dStr(3)}', 'Miniket Rice 10kg, Potato 5kg, Lentils 2kg'),
      ('baz-3', 'mem-3', 560, '${dStr(1)}', 'Chicken 1.5kg, Eggs 1 Dozen, Green Chillies');
    `);

    // 4. Seed Shared Utilities
    await client.query(`
      INSERT INTO other_expenses (id, title, category, amount, date) VALUES
      ('oth-1', 'Internet Wi-Fi', 'Internet', 600, '${dStr(4)}'),
      ('oth-2', 'Electricity Bill', 'Electricity', 1200, '${dStr(2)}');
    `);

    // 5. Seed meals for the last 5 days
    for (let i = 0; i < 5; i++) {
      const dateStr = dStr(i);
      await client.query(`
        INSERT INTO meals (date, member_id, breakfast, lunch, dinner) VALUES
        ('${dateStr}', 'mem-1', ${i === 0 ? 0.5 : 1}, 1, 1),
        ('${dateStr}', 'mem-2', 0, 1, 1),
        ('${dateStr}', 'mem-3', 1, 1, 1);
      `);
    }

    console.log("Mock data seeding completed successfully.");
  } catch (err) {
    console.error("Mock data seeding failed!", err);
  }
}

// ==========================================================================
// REST API Routes
// ==========================================================================

// --- GET: Fetch Complete Mess Data ---
app.get('/api/mess-data', async (req, res) => {
  try {
    const [membersRes, bazaarRes, expensesRes, depositsRes, mealsRes] = await Promise.all([
      pool.query('SELECT * FROM members ORDER BY name'),
      pool.query('SELECT * FROM bazaar ORDER BY date DESC'),
      pool.query('SELECT * FROM other_expenses ORDER BY date DESC'),
      pool.query('SELECT * FROM deposits ORDER BY date DESC'),
      pool.query('SELECT * FROM meals')
    ]);

    // Format meals relational rows into nested JSON schema
    const meals = {};
    mealsRes.rows.forEach(row => {
      const dateStr = formatDate(row.date);
      if (!meals[dateStr]) {
        meals[dateStr] = {};
      }
      meals[dateStr][row.member_id] = {
        breakfast: parseFloat(row.breakfast),
        lunch: parseFloat(row.lunch),
        dinner: parseFloat(row.dinner)
      };
    });

    const parsedBazaar = bazaarRes.rows.map(row => ({
      id: row.id,
      memberId: row.member_id,
      amount: parseFloat(row.amount),
      date: formatDate(row.date),
      items: row.items
    }));

    const parsedExpenses = expensesRes.rows.map(row => ({
      id: row.id,
      title: row.title,
      category: row.category,
      amount: parseFloat(row.amount),
      date: formatDate(row.date)
    }));

    const parsedDeposits = depositsRes.rows.map(row => ({
      id: row.id,
      memberId: row.member_id,
      amount: parseFloat(row.amount),
      date: formatDate(row.date),
      notes: row.notes
    }));

    res.json({
      members: membersRes.rows,
      meals,
      bazaar: parsedBazaar,
      otherExpenses: parsedExpenses,
      deposits: parsedDeposits
    });

  } catch (err) {
    console.error("Failed to query mess data!", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// --- POST: Save / Edit Member ---
app.post('/api/members', async (req, res) => {
  const { id, name, phone, email, password, initialDeposit } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });

  try {
    let targetId = id;
    if (id) {
      // Edit mode
      await pool.query(
        'UPDATE members SET name = $1, phone = $2, email = $3, password = $4 WHERE id = $5',
        [name, phone, email, password || '1234', id]
      );
    } else {
      // Insert mode
      targetId = 'mem-' + Date.now();
      await pool.query(
        'INSERT INTO members (id, name, phone, email, password) VALUES ($1, $2, $3, $4, $5)',
        [targetId, name, phone, email, password || '1234']
      );

      // Log initial deposit if provided
      if (initialDeposit && parseFloat(initialDeposit) > 0) {
        const depId = 'dep-' + Date.now();
        await pool.query(
          'INSERT INTO deposits (id, member_id, amount, date, notes) VALUES ($1, $2, $3, $4, $5)',
          [depId, targetId, parseFloat(initialDeposit), formatDate(new Date()), "Initial Capital Deposit"]
        );
      }
    }
    res.json({ success: true, id: targetId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save member" });
  }
});

// --- DELETE: Remove Member (Cascades automatically!) ---
app.delete('/api/members/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM members WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete member" });
  }
});

// --- POST: Record Member Deposit ---
app.post('/api/deposits', async (req, res) => {
  const { memberId, amount, date, notes } = req.body;
  if (!memberId || !amount || !date) return res.status(400).json({ error: "Missing required fields" });

  try {
    const newId = 'dep-' + Date.now();
    await pool.query(
      'INSERT INTO deposits (id, member_id, amount, date, notes) VALUES ($1, $2, $3, $4, $5)',
      [newId, memberId, parseFloat(amount), date, notes || 'Logged Deposit']
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save deposit" });
  }
});

// --- POST: Save / Edit Bazaar ---
app.post('/api/bazaar', async (req, res) => {
  const { id, memberId, amount, date, items } = req.body;
  if (!memberId || !amount || !date || !items) return res.status(400).json({ error: "Missing required fields" });

  try {
    if (id) {
      await pool.query(
        'UPDATE bazaar SET member_id = $1, amount = $2, date = $3, items = $4 WHERE id = $5',
        [memberId, parseFloat(amount), date, items, id]
      );
    } else {
      const newId = 'baz-' + Date.now();
      await pool.query(
        'INSERT INTO bazaar (id, member_id, amount, date, items) VALUES ($1, $2, $3, $4, $5)',
        [newId, memberId, parseFloat(amount), date, items]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save bazaar" });
  }
});

// --- DELETE: Remove Bazaar ---
app.delete('/api/bazaar/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM bazaar WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete bazaar entry" });
  }
});

// --- POST: Save / Edit Utility Expense ---
app.post('/api/expenses', async (req, res) => {
  const { id, title, category, amount, date } = req.body;
  if (!title || !category || !amount || !date) return res.status(400).json({ error: "Missing required fields" });

  try {
    if (id) {
      await pool.query(
        'UPDATE other_expenses SET title = $1, category = $2, amount = $3, date = $4 WHERE id = $5',
        [title, category, parseFloat(amount), date, id]
      );
    } else {
      const newId = 'oth-' + Date.now();
      await pool.query(
        'INSERT INTO other_expenses (id, title, category, amount, date) VALUES ($1, $2, $3, $4, $5)',
        [newId, title, category, parseFloat(amount), date]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save shared expense" });
  }
});

// --- DELETE: Remove Shared Expense ---
app.delete('/api/expenses/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM other_expenses WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete shared expense" });
  }
});

// --- POST: Save Day Meals Matrix (PostgreSQL UPSERT ON CONFLICT) ---
app.post('/api/meals', async (req, res) => {
  const { date, memberMeals } = req.body; // memberMeals: [{ memberId, breakfast, lunch, dinner }]
  if (!date || !memberMeals || !Array.isArray(memberMeals)) {
    return res.status(400).json({ error: "Missing date or meals array" });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const m of memberMeals) {
      await client.query(`
        INSERT INTO meals (date, member_id, breakfast, lunch, dinner)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (date, member_id)
        DO UPDATE SET breakfast = $3, lunch = $4, dinner = $5
      `, [date, m.memberId, parseFloat(m.breakfast), parseFloat(m.lunch), parseFloat(m.dinner)]);
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: "Failed to save meals matrix" });
  } finally {
    client.release();
  }
});

// --- POST: Import Complete Database JSON (Wipe & Restore Transaction) ---
app.post('/api/import', async (req, res) => {
  const { members, bazaar, otherExpenses, deposits, meals } = req.body;
  if (!members || !bazaar || !otherExpenses || !deposits || !meals) {
    return res.status(400).json({ error: "Invalid backup data schema" });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Wipe existing data
    await client.query('TRUNCATE meals, bazaar, other_expenses, deposits, members CASCADE');

    // Restore Members
    for (const m of members) {
      await client.query('INSERT INTO members (id, name, phone, email) VALUES ($1, $2, $3, $4)', [m.id, m.name, m.phone || null, m.email || null]);
    }

    // Restore Deposits
    for (const d of deposits) {
      await client.query('INSERT INTO deposits (id, member_id, amount, date, notes) VALUES ($1, $2, $3, $4, $5)', [d.id, d.memberId, parseFloat(d.amount), d.date, d.notes || null]);
    }

    // Restore Bazaar
    for (const b of bazaar) {
      await client.query('INSERT INTO bazaar (id, member_id, amount, date, items) VALUES ($1, $2, $3, $4, $5)', [b.id, b.memberId, parseFloat(b.amount), b.date, b.items]);
    }

    // Restore Other Expenses
    for (const o of otherExpenses) {
      await client.query('INSERT INTO other_expenses (id, title, category, amount, date) VALUES ($1, $2, $3, $4, $5)', [o.id, o.title, o.category, parseFloat(o.amount), o.date]);
    }

    // Restore Meals
    for (const [dateStr, dayMeals] of Object.entries(meals)) {
      for (const [memId, m] of Object.entries(dayMeals)) {
        await client.query('INSERT INTO meals (date, member_id, breakfast, lunch, dinner) VALUES ($1, $2, $3, $4, $5)', [dateStr, memId, parseFloat(m.breakfast), parseFloat(m.lunch), parseFloat(m.dinner)]);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: "Failed to restore database from backup" });
  } finally {
    client.release();
  }
});

// --- POST: Reset Monthly Data ---
app.post('/api/reset', async (req, res) => {
  try {
    // Truncate transaction tables, retain members
    await pool.query('TRUNCATE meals, bazaar, other_expenses, deposits CASCADE');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reset monthly data" });
  }
});

// Fallback: serve index.html for all other routes (Single Page Application routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==========================================================================
// Start Server
// ==========================================================================
app.listen(PORT, async () => {
  console.log(`========================================================`);
  console.log(` EliteMess server is live on http://localhost:${PORT}`);
  console.log(`========================================================`);
  
  // Auto-initialize PostgreSQL tables
  await initDB();
});
