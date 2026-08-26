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
    const verifyUrl = `${CLIENT_URL}/verify-email?token=${token}`;

    await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to,
        subject: "Verify your email",
        html: `<p>Click the link below to verify your email address:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
    });
};

export const sendFamilyInviteEmail = async (to: string, token: string, familyName: string) => {
    const inviteUrl = `${CLIENT_URL}/join-family?token=${token}`;

    await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to,
        subject: `You've been invited to join ${familyName}`,
        html: `<p>You've been invited to share expenses in <strong>${familyName}</strong>.</p><p>Click the link below to join. This invite expires in 7 days.</p><p><a href="${inviteUrl}">${inviteUrl}</a></p><p>If you don't have an account yet, sign up with this email address first, then open the link again.</p>`,
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
