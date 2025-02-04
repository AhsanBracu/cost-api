import express,{Express,Request,Response} from 'express';
import dotenv from "dotenv"
import { connectDb,monguri } from './db_connect';
import publicRoute from './routes/index'

const app = express();

dotenv.config();
connectDb();

const port = process.env.PORT || 3000;

publicRoute(app);

// app.get("/", (req: Request, res: Response) => {
//     res.send("Express + TypeScript Server");
//   });
  
  app.listen(port, () => {
    console.log(`[server]: Typescript Server is running at ${port}`); 
  });