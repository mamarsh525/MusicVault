import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';                                                                       

const app = express();
app.set('view engine', 'ejs');
app.use(express.static('public'));
//for Express to get values using the POST method
app.use(express.urlencoded({extended:true}));
//setting up database connection pool, replace values in red
const pool = mysql.createPool({
    host: "sm9j2j5q6c8bpgyq.cbetxkdyhwsb.us-east-1.rds.amazonaws.com",
    user: "ulbpxdogpfs1tts8",
    password: "sogvh6v66ifj0we3",
    database: "jszhk0i9zkqxpvf5",
    connectionLimit: 10,
    waitForConnections: true
});


app.get('/', (req, res) => {
   res.render('login.ejs');
});

app.get('/home', (req, res) => {
   res.render('home.ejs');
});

app.get('/search', async (req, res) => {
   let search = req.query.search;
   let url = "https://itunes.apple.com/search?term=" + search;
   const response = await fetch(url);
   const data = await response.json();
   console.log(data);
   res.render('searchResults.ejs', {data});
});

app.post('/loginProcess', async (req, res) => {
   let {username, password} = req.body;
   console.log(username + ": " + password);
   let sql = `SELECT *
              FROM users
              WHERE username = ?`;
   const [rows] = await pool.query(sql, [username]);
   if (rows.length == 0) { //username not found in the database
      return res.render('login.ejs', {loginError: 'No user found'});
   }
   let storedPassword = rows[0].password;
   // const passwordMatch = await bcrypt.compare(password, storedPassword);
   if (password === storedPassword) {
     res.render('home.ejs');
   } else {
      let loginError = "Incorrect Password";
      res.render('login.ejs', {loginError});
   }
});


app.listen(3000, () => {
   console.log('server started');
});
