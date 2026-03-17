const pool = require('./db');

const setupDatabase = async () => {
  try {
    console.log("🔄 Resetting database table...");

    // Remove existing tables to apply new schema
    await pool.query('DROP TABLE IF EXISTS catch_logs CASCADE');
    await pool.query('DROP TABLE IF EXISTS users CASCADE');
    
    // Create users table
    await pool.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user'
      )
    `);

    // Create updated catch_logs table with ML feature columns
    await pool.query(`
      CREATE TABLE catch_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        water_body_id INTEGER REFERENCES water_bodies(id),
        species VARCHAR(100),
        weight DECIMAL,
        image_url VARCHAR(255),
        temp DECIMAL,            -- Added for ML retraining
        pressure DECIMAL,        -- Added for ML retraining
        wind_speed DECIMAL,      -- Added for ML retraining
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log("✅ Database tables updated! Now capturing weather data for AI training.");
  } catch (err) {
    console.error("❌ Error setting up database:", err.message);
  } finally {
    pool.end();
  }
};

setupDatabase();