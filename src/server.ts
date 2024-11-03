import express,{Express,Request,Response} from 'express';
import dotenv from "dotenv"
import { connectDb,monguri } from './db_connect';

const app:Express = express();

dotenv.config();
connectDb();

const port = process.env.PORT || 3000;

app.get("/", (req: Request, res: Response) => {
    res.send("Express + TypeScript Server");
  });
  
  app.listen(port, () => {
    console.log(`[server]: Typescript Server is running at ${monguri}`); 
  });