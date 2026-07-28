import bcrypt from "bcrypt";
import User from "../models/UserModel";
import { NotFoundError, UnauthorizedError } from "../errors/AppError";

const UserService = {
    getProfile: async (userId: string) => {
        const user = await User.findById(userId).select('-password');
        if (!user)
            throw new NotFoundError("User not found");

        return user;
    },

    changePassword: async (userId: string, oldPassword: string, newPassword: string) => {
        const user = await User.findById(userId);
        if (!user)
            throw new NotFoundError("User not found");

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch)
            throw new UnauthorizedError("Current password is incorrect");

        user.password = newPassword;
        await user.save();
    },
};

export default UserService;
