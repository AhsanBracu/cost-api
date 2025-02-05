import  express,{NextFunction, Request,Response}  from "express";
import Authservice  from "../../services/register";

const router = express.Router();
router.get('/list',(req: Request, res: Response) => {
    console.log("hello");
res.send("get list from here");
});

router.post('/login',async(req:Request,res:Response,next:NextFunction)=>{
  //  try{
    const data  = req.body;
    console.log("login", req.body);
    let result =  await Authservice.login(data);

  //  }catch(err){
       // next(err);
   // }
})

router.get('/register',async(req:Request,res:Response)=>{
    const data  = req.body;
    let result =  await Authservice.register(data);

})


export default router;