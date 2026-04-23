import express from 'express';
const app = express();
app.set("view engine", "ejs");
app.set("views", "./views");                         
app.use(express.static("public"));


app.get('/', (req, res) => {
   res.render('home.ejs')
});


app.listen(3000, () => {
   console.log('server started');
});
