import express from 'express';
import cors from 'cors'
import { project } from './routes/project';
import { env } from '@v7/env/http';

const app = express();

app.use(cors());

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
})

app.use('/project', project);

app.listen(env.HTTP_SERVER_PORT, () => {
    console.log(`HTTP server is running on http://localhost:${env.HTTP_SERVER_PORT}`)
})