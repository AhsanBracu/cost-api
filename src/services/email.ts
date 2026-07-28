import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

export const sendVerificationEmail = async (to: string, token: string) => {
    const verifyUrl = `${CLIENT_URL}/api/public/verify-email?token=${token}`;

    await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to,
        subject: "Verify your email",
        html: `<p>Click the link below to verify your email address:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
    });
};

export const sendPasswordResetEmail = async (to: string, token: string) => {
    const resetUrl = `${CLIENT_URL}/reset-password?token=${token}`;

    await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to,
        subject: "Reset your password",
        html: `<p>Click the link below to reset your password. This link expires in 15 minutes.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    });
};
