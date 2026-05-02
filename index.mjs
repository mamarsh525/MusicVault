import express from 'express';
import mysql from 'mysql2/promise';

const app = express();
app.set('view engine', 'ejs');
app.use(express.static('public'));
//for Express to get values using the POST method
app.use(express.urlencoded({ extended: true }));
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
   res.render('signup.ejs');
});

app.get('/login', (req, res) => {
   res.render('login.ejs');
});

app.get('/home', (req, res) => {
   res.render('home.ejs');
});

app.get('/search', async (req, res) => {
   let search = req.query.search;
   let url = "https://itunes.apple.com/search?term="
      + encodeURIComponent(search) + "&entity=song&media=music&limit=20";
   const response = await fetch(url);
   const data = await response.json();
   console.log(data);
   res.render('searchResults.ejs', { data, search });
   //res.render('login.ejs')
});

app.post('/signupProcess', async (req, res) => {
   let { firstName, lastName, username, password } = req.body;

   try {
      let sql = `
            INSERT INTO users (username, password, firstName, lastName)
            VALUES (?, ?, ?, ?)
        `;
      await pool.query(sql, [username, password, firstName, lastName]);

      res.render('login.ejs');

   } catch (err) {
      console.error(err);
      res.render('signup.ejs', { signupError: "Error creating user" });
   }
});

app.post('/loginProcess', async (req, res) => {
   let { username, password } = req.body;
   console.log(username + ": " + password);
   let sql = `SELECT *
              FROM users
              WHERE username = ?`;
   const [rows] = await pool.query(sql, [username]);
   let storedPassword = "";
   if (rows.length > 0) { //username was found in the database
      storedPassword = rows[0].password;
   }
   if (rows.length === 0) {
      return res.render('login.ejs', { loginError: "User not found" });
   }

   if (password === rows[0].password) {
      res.render('home.ejs');
   } else {
      res.render('login.ejs', { loginError: "Incorrect password" });
   }
});


app.get("/discover", async (req, res) => {
   try {
      //subject to change 
      const artists = ["Taylor Swift", "Drake", "The Weeknd", "Adele", "Bruno Mars", "SZA", "Billie Eilish", "Kendrick Lamar", "Doja Cat", "Lana Del Rey"];
      const random = artists[Math.floor(Math.random() * artists.length)];
      const response = await fetch(`https://itunes.apple.com/search?term=${random}&entity=song&limit=10`);
      const data = await response.json();
      res.render("discover.ejs", { artist: random, songs: data.results });
   } catch (error) {
      console.error(error);
      res.send("Error discover");
   }
});

app.listen(3000, () => {
   console.log('server started');
});
