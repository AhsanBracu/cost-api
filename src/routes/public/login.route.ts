import  express,{Request,Response}  from "express";
import Authservice  from "../../services/register";
import { catchAsync } from "../../utils/catchAsync";
import { validate } from "../../middleware/validate";
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from "../../schemas/auth.schema";

const router = express.Router();
router.get('/list',(req: Request, res: Response) => {
    console.log("hello");
res.send("get list from here");
});

router.post('/login', validate(loginSchema), catchAsync(async(req:Request,res:Response)=>{
    const data = req.body;
    const result = await Authservice.login(data);
    res.send({
        // Never echo the password hash back to the client.
        user: {
            _id: result.user._id,
            name: result.user.name,
            email: result.user.email,
            isVerified: result.user.isVerified,
        },
        token: result.token
    })
}))

router.post('/register', validate(registerSchema), catchAsync(async(req:Request,res:Response)=>{
    const data = req.body;
    const { user, emailSent } = await Authservice.register(data);
    res.status(201).send({
        user: { _id: user._id, name: user.name, email: user.email, isVerified: user.isVerified },
        emailSent,
    })
}))

router.get('/verify-email', catchAsync(async(req:Request,res:Response)=>{
    const token = req.query.token as string;
    await Authservice.verifyEmail(token);
    res.send({ message: "Email verified successfully" });
}))

router.post('/forgot-password', validate(forgotPasswordSchema), catchAsync(async(req:Request,res:Response)=>{
    const { email } = req.body;
    await Authservice.forgotPassword(email);
    res.send({ message: "If an account with that email exists, a password reset link has been sent." });
}))

router.post('/reset-password', validate(resetPasswordSchema), catchAsync(async(req:Request,res:Response)=>{
    const { token, newPassword } = req.body;
    await Authservice.resetPassword(token, newPassword);
    res.send({ message: "Password reset successfully" });
}))


export default router;