import express,{Express,Request,Response} from 'express';
import dotenv from "dotenv"
import { connectDb,monguri } from './db_connect';
import publicRoute from './routes/index'
import { notFoundHandler, errorHandler } from './middleware/errorHandler';

const app = express();

dotenv.config();
connectDb();
app.use(express.json());

const port = process.env.PORT || 3000;

publicRoute(app);

app.use(notFoundHandler);
app.use(errorHandler);

  app.listen(port, () => {
    console.log(`[server]: Typescript Server is running at ${port}`);
  });