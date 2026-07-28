"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_connect_1 = require("./db_connect");
const index_1 = __importDefault(require("./routes/index"));
const errorHandler_1 = require("./middleware/errorHandler");
const app = (0, express_1.default)();
dotenv_1.default.config();
(0, db_connect_1.connectDb)();
app.use(express_1.default.json());
const port = process.env.PORT || 3000;
(0, index_1.default)(app);
app.use(errorHandler_1.notFoundHandler);
app.use(errorHandler_1.errorHandler);
app.listen(port, () => {
    console.log(`[server]: Typescript Server is running at ${port}`);
});
