import  express,{Request,Response}  from "express";
import Authservice  from "../../services/register";

const router = express.Router();
router.get('/list',(req: Request, res: Response) => {
    console.log("hello");
res.send("get list from here");
});

router.get('/login',async(req:Request,res:Response)=>{
    const data  = req.body;
    let result =  await Authservice.login(data);
})

router.get('/register',async(req:Request,res:Response)=>{
    const data  = req.body;
    let result =  await Authservice.register(data);

})


export default router;