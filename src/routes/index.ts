import {Express} from 'express';
import router from './public/login.route';
import userRouter from './private/user.route';
import costRouter from './private/cost.route';
import incomeRouter from './private/income.route';
import savingsGoalRouter from './private/savingsGoal.route';

const publicRoute= async (app:Express)=>{

app.use('/api/public',router);
app.use('/api/users', userRouter);
app.use('/api/costs', costRouter);
app.use('/api/income', incomeRouter);
app.use('/api/savings-goals', savingsGoalRouter);
}

export default publicRoute;
