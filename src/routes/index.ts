import {Express} from 'express';
import router from './public/login.route';
import userRouter from './private/user.route';

const publicRoute= async (app:Express)=>{

app.use('/api/public',router);
app.use('/api/users', userRouter);
}

export default publicRoute;
