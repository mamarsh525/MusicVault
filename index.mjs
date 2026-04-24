import express from 'express';
const app = express();
app.set("view engine", "ejs");
app.set("views", "./views");                         
app.use(express.static("public"));


app.get('/', (req, res) => {
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


app.listen(3000, () => {
   console.log('server started');
});
