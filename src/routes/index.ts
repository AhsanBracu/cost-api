import {Express} from 'express';
import router from './public/login.route';
import userRouter from './private/user.route';
import costRouter from './private/cost.route';

const publicRoute= async (app:Express)=>{

app.use('/api/public',router);
app.use('/api/users', userRouter);
app.use('/api/costs', costRouter);
}

export default publicRoute;
