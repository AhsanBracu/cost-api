import mongoose  from "mongoose";
import dotenv from 'dotenv'

dotenv.config();

const port = process.env.PORT || 3000;

console.log("mportonguri",process.env.MONGO_URI);

const monguri:string = process.env.MONGO_URI || "mongodb://localhost:27017/costmanagement_db";

console.log("monguri",monguri);

const connectDb = async() =>{
    mongoose.connect(monguri).then(()=>{
        console.log("connected to ",process.env.MONGO_URI);
    })

}

export {connectDb, monguri};