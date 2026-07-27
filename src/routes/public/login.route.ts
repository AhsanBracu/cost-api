import  express,{Request,Response}  from "express";
import Authservice  from "../../services/register";
import { catchAsync } from "../../utils/catchAsync";

const router = express.Router();
router.get('/list',(req: Request, res: Response) => {
    console.log("hello");
res.send("get list from here");
});

router.post('/login', catchAsync(async(req:Request,res:Response)=>{
    const data = req.body;
    const result = await Authservice.login(data);
    res.send({
        user: result.user,
        token: result.token
    })
}))

router.post('/register', catchAsync(async(req:Request,res:Response)=>{
    const data = req.body;
    const result = await Authservice.register(data);
    res.status(201).send({
     result: result
    })
}))


export default router;