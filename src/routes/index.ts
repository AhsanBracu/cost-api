import {Express} from 'express';
import router from './public/login.route';

const publicRoute= async (app:Express)=>{

app.use('/api/public',router);
}

export default publicRoute;
