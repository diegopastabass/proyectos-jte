require('dotenv').config();
const express = require('express');
const app = express();
const apiRoutes = require('./routes/api');

const cors = require('cors');
app.use(cors());


app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.send('API');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
