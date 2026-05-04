import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import session from 'express-session';

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

app.use(session({
   secret: 'your-secret-key',
   resave: false,
   saveUninitialized: true
}));

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
   res.render('searchResults.ejs', { data, search, userId: '' });
   //res.render('login.ejs')
});

app.get('/playlists', async (req, res) => {
   const userId = req.session.userId;

   let sql = `SELECT *
            FROM playlists
            NATURAL JOIN songs
            WHERE userId = ?`;
   const [rows] = await pool.query(sql, [userId]);

   const playlistMap = {};
   rows.forEach(row => {
      if (!playlistMap[row.playlistId]) {
         playlistMap[row.playlistId] = {
            playlistId: row.playlistId,
            name: row.name,
            num_songs: row.num_songs,
            songs: []
         };
      }
      playlistMap[row.playlistId].songs.push({
         songId: row.songId,
         title: row.title,
         artistName: row.artistName,
         songURL: row.songURL
      });
   });

   const playlists = Object.values(playlistMap);
   res.render("playlists.ejs", { playlists });
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
   if (rows.length == 0) { //username not found in the database
      return res.render('login.ejs', { loginError: 'No user found' });
   }

   if (password === rows[0].password) {
      req.session.userId = rows[0].userId;
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

app.post("/addToPlaylist", async (req, res) => {
   const { song_id, trackName, artistName, songURL } = req.body;
   const userId = req.session.userId;

   let sql = `SELECT *
            FROM playlists
            WHERE userId = ?`;
   const [playlists] = await pool.query(sql, [userId]);
   if (playlists.length === 0) {
      return res.render("createPlaylist.ejs", { song_id, trackName, artistName, songURL });
   }
   res.render("choosePlaylist.ejs", { playlists, song_id, trackName, artistName, songURL });
});
app.post("/addSongToPlaylist", async (req, res) => {
   const { playlistId, trackName, artistName, songURL } = req.body;

   try {
      await pool.query(
         `INSERT INTO songs (title, artistName, songURL, PlaylistId)
          VALUES (?, ?, ?, ?)`,
         [trackName, artistName, songURL || '', playlistId]
      );

      await pool.query(
         `UPDATE playlists
          SET num_songs = num_songs + 1
          WHERE playlistId = ?`,
         [playlistId]
      );

      res.redirect("/home");
   } catch (err) {
      console.error(err);
      res.render("home.ejs", { error: "Error adding song to playlist" });
   }
});

app.post("/createPlaylist", async (req, res) => {
   const { playlistName, song_id, trackName, artistName, songURL } = req.body;
   const userId = req.session.userId;

   try {
      let sql = `INSERT INTO playlists (userId, name, num_songs)
                 VALUES (?, ?, 0)`;

      const [result] = await pool.query(sql, [userId, playlistName]);
      const playlistId = result.insertId;

      await pool.query(
         `INSERT INTO songs (title, artistName, songURL, PlaylistId)
          VALUES (?, ?, ?, ?)`,
         [trackName, artistName, songURL || '', playlistId]
      );

      await pool.query(
         `UPDATE playlists
          SET num_songs = 1
          WHERE playlistId = ?`,
         [playlistId]
      );
      res.redirect("/home");
   } catch (err) {
      console.error(err);
      res.render("createPlaylist.ejs", { song_id, trackName, artistName, error: "Error creating playlist" });
   }
});

app.listen(3000, () => {
   console.log('server started');
});
