const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "shwetapatil@2005",
  database: "checkers_db"
});

db.connect((err) => {
  if (err) {
    console.log("MySQL connection failed", err);
  } else {
    console.log("MySQL Connected Successfully");
  }
});

module.exports = db;