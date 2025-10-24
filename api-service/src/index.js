import express from 'express';

const app = express();
const port = 3000;

app.use(express.json());

// Auth Endpoints
app.post('/auth/login', (req, res) => {
  res.status(200).json({ token: 'stub-token' });
});

app.post('/auth/register', (req, res) => {
  res.status(201).send('User registered successfully');
});

// Games Endpoints
app.get('/games', (req, res) => {
  res.status(200).json([
    { id: '1', name: 'Game 1', description: 'Description for Game 1' },
    { id: '2', name: 'Game 2', description: 'Description for Game 2' },
  ]);
});

app.post('/games', (req, res) => {
  res.status(201).send('Game created successfully');
});

app.listen(port, () => {
  console.log(`API service running at http://localhost:${port}`);
});