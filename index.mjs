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

app.set('trust proxy', 1)
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

app.get('/home', isUserAuthenticated,async (req, res) => {
   const userId = req.session.userId;
   let firstName = 'User';
   let lastName = '';

   try {
      let sql = `SELECT firstName, lastName
                 FROM users
                 WHERE userId = ?`;
      const [user] = await pool.query(sql, [userId]);

      if (user.length > 0) {
         firstName = user[0].firstName;
         lastName = user[0].lastName;
      }
   } catch (err) {
      console.error(err);
   }

   res.render('home.ejs', { firstName, lastName });
});

app.get('/search', isUserAuthenticated,async (req, res) => {
   let search = req.query.search;
   let url = "https://itunes.apple.com/search?term="
      + encodeURIComponent(search) + "&entity=song&media=music&limit=20";
   const response = await fetch(url);
   const data = await response.json();
   console.log(data);
   res.render('searchResults.ejs', { data, search, userId: '' });
   //res.render('login.ejs')
});

app.get('/playlists', isUserAuthenticated, async (req, res) => {
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
      req.session.authenticated = true;
      req.session.userId = rows[0].userId;
      res.redirect('/home');
   } else {
      res.render('login.ejs', { loginError: "Incorrect password" });
   }
});


app.get("/discover", isUserAuthenticated,async (req, res) => {
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

app.post("/addToPlaylist", isUserAuthenticated,async (req, res) => {
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
      res.render("home.ejs", { firstName: 'User', lastName: '', error: "Error adding song to playlist" });
   }
});

app.post("/createPlaylist", isUserAuthenticated,async (req, res) => {
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

app.post("/addToFavorites", isUserAuthenticated,async (req, res) => {
   const { trackName, artistName, songURL } = req.body;
   const userId = req.session.userId;
   try {
      const [existing] = await pool.query(
         `SELECT * FROM favorites
          WHERE userId = ? AND title = ? AND artistName = ?`,
         [userId, trackName, artistName]
      );
      if (existing.length === 0) {
         await pool.query(
            `INSERT INTO favorites (userId, title, artistName, songURL)
             VALUES (?, ?, ?, ?)`,
            [userId, trackName, artistName, songURL ]
         );
      }
   } catch (err) {
      console.error(err);
      res.render("home.ejs", { firstName: 'User', lastName: '', error: "Error adding to favorites" });
   }
});

app.get("/favorites", isUserAuthenticated, async (req, res) => {
   try {
      const userId = req.session.userId;
      const [favorites] = await pool.query(
         `SELECT title, artistName, songURL
          FROM favorites
          WHERE userId = ?`,
         [userId]
      );
      res.render("favorites.ejs", { favorites });
   } catch (err) {
      console.error(err);
      res.send("Error loading favorites");
   }
});

app.get('/artistInfo', isUserAuthenticated,async (req, res) => {
   const { artist } = req.query;

   if (!artist) {
      return res.render('artistInfo.ejs', { artist: null, artistInfo: null, error: 'No artist name provided' });
   }

   try {
      const url = `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(artist)}&fmt=json&inc=tags+ratings+url-rels`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
         headers: { 'User-Agent': 'MusicPlaylistApp/1.0 (contact@example.com)' },
         signal: controller.signal
      });

      clearTimeout(timeout);
      const data = await response.json();

      if (!data.artists || data.artists.length === 0) {
         return res.render('artistInfo.ejs', { artist, artistInfo: null, error: 'Artist not found' });
      }

      const artistInfo = data.artists[0];
      res.render('artistInfo.ejs', { artist, artistInfo, error: null });
   } catch (err) {
      console.error('MusicBrainz connection failed:', err.message);
      res.render('artistInfo.ejs', { artist, artistInfo: null, error: 'Unable to connect to MusicBrainz. Please try again.' });
   }
});

app.get("/deleteFav", isUserAuthenticated, async (req, res) => {
   try {
      const userId = req.session.userId;
      const {songTitle} = req.query;
      let sql = `DELETE FROM favorites
               WHERE title = ? AND userId = ?`;
      await pool.query(sql, [songTitle, userId]);
      res.redirect("/favorites");
   } catch (err) {
      console.error(err);
      res.send("Error deleting from favorites");
   }
});

app.get("/deleteSong", isUserAuthenticated, async (req,res) => {
   try {
      const userId = req.session.userId;
      const {songTitle, playlistId} = req.query;
      let sql = `DELETE FROM songs
               WHERE title = ? AND playlistId = ?`;
      const[result] = await pool.query(sql, [songTitle, playlistId]);

      if(result.affectedRows > 0){
         let sql2 = `UPDATE playlists
                     SET num_songs = num_songs - 1
                     WHERE playlistId = ? AND userId = ?`;
         await pool.query(sql2, [playlistId, userId]);
      }
         
      let sql3 = `DELETE FROM playlists WHERE playlistId = ? AND userId = ? AND num_songs = 0`;
      await pool.query(sql3, [playlistId, userId]);

      res.redirect("/playlists");
   } catch (err) {
      console.error(err);
      res.send("Error deleting from playlist");
   }
});

app.get("/deletePlaylist", isUserAuthenticated, async (req,res) => {
   try {
      const userId = req.session.userId;
      const {playlistId} = req.query;   
      let sql3 = `DELETE FROM playlists WHERE playlistId = ? AND userId = ?`;
      await pool.query(sql3, [playlistId, userId]);

      res.redirect("/playlists");
   } catch (err) {
      console.error(err);
      res.send("Error deleting from playlist");
   }
});

function isUserAuthenticated(req, res, next){
    if(req.session.authenticated){
        next();
    }
    else{
        res.redirect("/")
    }
}

app.get('/logout', (req, res) => {
   req.session.destroy();
   res.redirect('/')
});

app.listen(3000, () => {
   console.log('server started');

});
