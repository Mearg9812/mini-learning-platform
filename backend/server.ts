import express, { Request, Response } from "express";
import { NextFunction } from "express";
import cors from "cors";
import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { randomUUID } from "crypto";

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import * as admin from "firebase-admin";
import { cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import path from "path";

dotenv.config();

// 2. SETTING UP THE APP
const app = express();
const prisma = new PrismaClient();

// Turns on the Cloudflare/AWS Chef
const s3 = new S3Client({
  region: "auto", // Cloudflare handles the region automatically
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
  },
});

// Turns on Firebase Cloud Messaging
const serviceAccount = require(
  path.join(__dirname, "firebase-service-account.json"),
);
admin.initializeApp({
  credential: cert(serviceAccount),
});

app.use(cors());
app.use(express.json());

const getPublicProfileImageUrl = (
  profileImage: string | null,
): string | null => {
  if (!profileImage) return profileImage;

  return getPublicR2ObjectUrl(profileImage);
};

const getPublicR2ObjectUrl = (objectUrl: string): string => {
  const configuredPublicBase = process.env.R2_PUBLIC_URL;
  if (!configuredPublicBase) return objectUrl;
  const publicBase = configuredPublicBase.replace(/\/+$/, "");

  if (objectUrl.startsWith("videos/")) {
    return `${publicBase}/${objectUrl}`;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(objectUrl);
  } catch {
    return objectUrl;
  }

  // Old records may point at an earlier R2 account ID, so match the S3
  // endpoint shape and bucket instead of requiring today's account ID.
  if (!parsedUrl.hostname.endsWith(".r2.cloudflarestorage.com")) {
    return objectUrl;
  }

  const [bucket, ...objectKeyParts] = parsedUrl.pathname
    .split("/")
    .filter(Boolean);
  if (bucket !== process.env.R2_BUCKET_NAME || objectKeyParts.length === 0) {
    return objectUrl;
  }

  return `${publicBase}/${objectKeyParts.join("/")}`;
};

const paidCourseValues = [
  "GRADE_9",
  "GRADE_10",
  "GRADE_11",
  "GRADE_12",
  "FRESHMAN",
] as const;
const courseValues = ["FREE_FOR_ALL", ...paidCourseValues] as const;
const purchaseValues = ["FULL_ACCESS", ...paidCourseValues] as const;
const normalizePhone = (value: unknown): string =>
  typeof value === "string" ? value.replace(/[\s()-]/g, "") : "";
const validPhone = (value: string): boolean => /^\+?\d{8,15}$/.test(value);
const coursesForStudent = async (userId: string): Promise<string[]> => {
  const approved = await prisma.paymentRequest.findMany({
    where: { userId, status: "APPROVED" },
    select: { approvedOption: true, option: true },
  });
  const options = approved.map(
    (payment) => payment.approvedOption || payment.option,
  );
  if (options.includes("FULL_ACCESS")) return [...courseValues];
  return [
    "FREE_FOR_ALL",
    ...new Set(
      options.filter((option): option is (typeof paidCourseValues)[number] =>
        paidCourseValues.includes(option as (typeof paidCourseValues)[number]),
      ),
    ),
  ];
};

// A new student attaches a screenshot before the account and payment request are created.
app.post(
  "/register/receipt-upload-url",
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { fileName, fileType, fileSize } = req.body;
      if (
        typeof fileName !== "string" ||
        !["image/jpeg", "image/png", "image/webp"].includes(fileType) ||
        !Number.isInteger(fileSize) ||
        fileSize < 1 ||
        fileSize > 5 * 1024 * 1024
      ) {
        return res.status(400).json({
          error: "Choose a JPG, PNG, or WebP receipt screenshot up to 5 MB.",
        });
      }
      const key = `payment-receipts/registration/${randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        ContentType: fileType,
        ContentLength: fileSize,
      });
      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
      return res.json({ uploadUrl, receiptObjectKey: key });
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Could not prepare receipt image upload." });
    }
  },
);

// 3. REGISTER ROUTE
app.post("/register", async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      name,
      phone,
      password,
      option,
      amount,
      currency,
      receiptText,
      receiptObjectKey,
    } = req.body;
    const normalizedName = typeof name === "string" ? name.trim() : "";
    const normalizedPhone = normalizePhone(phone);
    const hasPayment = option !== undefined && option !== null && option !== "";
    const parsedAmount = Number(amount);
    const normalizedCurrency = typeof currency === "string" ? currency.trim() : "";

    if (
      normalizedName.length < 2 ||
      normalizedName.length > 100 ||
      !validPhone(normalizedPhone) ||
      typeof password !== "string" ||
      password.length < 8 ||
      (hasPayment && (!purchaseValues.includes(option) || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 1000000000 || !/^[A-Za-z]{3}$/.test(normalizedCurrency))) ||
      (receiptText != null && (typeof receiptText !== "string" || receiptText.length > 10000)) ||
      (receiptObjectKey != null && (typeof receiptObjectKey !== "string" || !receiptObjectKey.startsWith("payment-receipts/registration/"))) ||
      (!hasPayment && (receiptText || receiptObjectKey))
    ) {
      return res.status(400).json({
        error:
          "Enter a valid name, phone number, and password. If you are submitting a payment, include a valid package, amount, and currency.",
      });
    }

    if (receiptObjectKey) {
      const uploadedReceipt = await s3.send(new HeadObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: receiptObjectKey,
      }));
      if (!uploadedReceipt.ContentType || !["image/jpeg", "image/png", "image/webp"].includes(uploadedReceipt.ContentType) || !uploadedReceipt.ContentLength || uploadedReceipt.ContentLength > 5 * 1024 * 1024) {
        return res.status(400).json({ error: "Receipt screenshot upload is missing or invalid. Please attach it again." });
      }
    }

    const phoneInUse = await prisma.user.findFirst({ where: { role: "USER", phone: normalizedPhone }, select: { id: true } });
    if (phoneInUse) return res.status(400).json({ error: "That phone number is already registered." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: normalizedName,
          email: null,
          phone: normalizedPhone,
          password: hashedPassword,
          role: "USER",
          status: "PENDING",
        },
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
        },
      });
      if (hasPayment) await tx.paymentRequest.create({
        data: {
          userId: createdUser.id,
          option,
          amount: parsedAmount,
          currency: normalizedCurrency.toUpperCase(),
          receiptText: typeof receiptText === "string" ? receiptText.trim() || null : null,
          receiptObjectKey: receiptObjectKey || null,
        },
      });
      return createdUser;
    });

    return res.status(201).json({
      message: hasPayment ? "Account and payment review request submitted. Sign in to watch your request." : "Account created. Sign in to watch free videos and submit payment later.",
      user: newUser,
    });
  } catch (error) {
    console.error("Student registration failed:", error);
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res
        .status(400)
        .json({ error: "That phone number is already registered." });
    }
    return res.status(500).json({
      error: "Could not finish registration. Check your details and try again.",
    });
  }
});

// 4. LOGIN ROUTE
app.post("/login", async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, phone, password } = req.body;
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    const normalizedPhone = normalizePhone(phone);
    const phoneMatches = phone != null
      ? await prisma.user.findMany({ where: { phone: normalizedPhone, role: "USER" }, take: 2 })
      : null;
    if (phoneMatches && phoneMatches.length > 1) {
      return res.status(409).json({ error: "More than one student account uses this phone number. Contact an administrator to correct the account numbers." });
    }
    const user = phoneMatches ? phoneMatches[0] || null : await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (
      !user ||
      (phone == null && user.role === "USER") ||
      typeof password !== "string" ||
      !(await bcrypt.compare(password, user.password))
    ) {
      return res.status(401).json({ error: "Phone/email or password is incorrect." });
    }

    console.log("User logged in:", user.role);

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" },
    );

    const accessCourses =
      user.role === "USER"
        ? await coursesForStudent(user.id)
        : [...courseValues];
    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        ...(user.role === "USER" ? {} : { email: user.email }),
        phone: user.phone,
        profileImage: getPublicProfileImageUrl(user.profileImage),
        role: user.role,
        status: user.status,
        accessCourses,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Server error during login." });
  }
});

const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<any> => {
  // 1. Look at the request headers for the wristband
  const authHeader = req.headers.authorization;

  // 2. If they didn't bring one, kick them out
  if (!authHeader) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  // Tokens usually look like this: "Bearer eyJhbG..."
  // We split the string by the space and take the second part (the actual token)
  const token = authHeader.split(" ")[1];

  try {
    // 3. Verify the token using our secret password
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string,
    ) as jwt.JwtPayload;
    if (typeof decoded.userId !== "string") {
      return res.status(403).json({ error: "Invalid or expired token." });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        profileImage: true,
        role: true,
        status: true,
      },
    });
    if (!user)
      return res.status(401).json({ error: "Account no longer exists." });

    (req as any).user = {
      userId: user.id,
      ...user,
      profileImage: getPublicProfileImageUrl(user.profileImage),
    };
    return next();
  } catch (error) {
    return res.status(403).json({ error: "Invalid or expired token." });
  }
};

const requireAdmin = (req: Request, res: Response, next: NextFunction): any => {
  const user = (req as any).user;
  if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    return res.status(403).json({ error: "Administrator access is required." });
  }
  return next();
};

// 5.5 OUR SUPER ADMIN BOUNCER
// Only users with the SUPER_ADMIN role are allowed through!
const requireSuperAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
): any => {
  const user = (req as any).user;
  if (!user || user.role !== "SUPER_ADMIN") {
    return res
      .status(403)
      .json({ error: "Access denied. Super Admin privileges required." });
  }
  next();
};

app.get(
  "/profile",
  authenticate,
  async (req: Request, res: Response): Promise<any> => {
    const user = (req as any).user;
    const accessCourses =
      user.role === "USER"
        ? await coursesForStudent(user.userId)
        : [...courseValues];
    const { email, ...profile } = user;
    return res.json({ ...profile, ...(user.role === "USER" ? {} : { email }), accessCourses });
  },
);

app.patch(
  "/profile",
  authenticate,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const actor = (req as any).user;
      const { name, email, phone } = req.body;
      const normalizedName = typeof name === "string" ? name.trim() : "";
      const normalizedEmail =
        typeof email === "string" ? email.trim().toLowerCase() : "";
      const normalizedPhone = normalizePhone(phone);
      const isStudent = actor.role === "USER";
      if (normalizedName.length < 2 || normalizedName.length > 100 ||
        (isStudent ? !validPhone(normalizedPhone) : !/^\S+@\S+\.\S+$/.test(normalizedEmail)) ||
        (phone != null && (typeof phone !== "string" || phone.length > 32))) {
        return res.status(400).json({
          error: isStudent ? "Enter a valid name and phone number." : "Enter a valid name and email address.",
        });
      }
      if (isStudent) {
        const duplicatePhone = await prisma.user.findFirst({
          where: { role: "USER", phone: normalizedPhone, id: { not: actor.userId } },
          select: { id: true },
        });
        if (duplicatePhone) return res.status(400).json({ error: "That phone number is already used by another student." });
      }

      const updated = await prisma.user.update({
        where: { id: (req as any).user.userId },
        data: {
          name: normalizedName,
          ...(isStudent ? {} : { email: normalizedEmail }),
          phone: isStudent ? normalizedPhone : phone?.trim() || null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          profileImage: true,
          role: true,
          status: true,
        },
      });
      const accessCourses =
        updated.role === "USER"
          ? await coursesForStudent(updated.id)
          : [...courseValues];
      const { email: emailForResponse, ...profile } = updated;
      return res.json({
        ...profile,
        ...(updated.role === "USER" ? {} : { email: emailForResponse }),
        profileImage: getPublicProfileImageUrl(updated.profileImage),
        accessCourses,
      });
    } catch (error) {
      return res
        .status(400)
        .json({ error: "That account identifier may already be in use." });
    }
  },
);

app.patch(
  "/profile/password",
  authenticate,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (typeof currentPassword !== "string" || typeof newPassword !== "string" || newPassword.length < 8) {
        return res.status(400).json({ error: "Enter your current password and a new password with at least 8 characters." });
      }
      const account = await prisma.user.findUnique({ where: { id: (req as any).user.userId } });
      if (!account || !(await bcrypt.compare(currentPassword, account.password))) {
        return res.status(400).json({ error: "Current password is incorrect." });
      }
      await prisma.user.update({ where: { id: account.id }, data: { password: await bcrypt.hash(newPassword, 10) } });
      return res.json({ message: "Password updated successfully." });
    } catch {
      return res.status(500).json({ error: "Could not update password." });
    }
  },
);

app.post(
  "/profile/image/upload-url",
  authenticate,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { fileName, fileType, fileSize } = req.body;
      const allowedImageTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
      ];
      const publicBaseUrl = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");
      if (!publicBaseUrl) {
        return res
          .status(503)
          .json({ error: "Profile image uploads are not configured." });
      }
      if (
        typeof fileName !== "string" ||
        !allowedImageTypes.includes(fileType) ||
        !Number.isInteger(fileSize) ||
        fileSize <= 0 ||
        fileSize > 5 * 1024 * 1024
      ) {
        return res
          .status(400)
          .json({ error: "Choose a JPG, PNG, WebP, or GIF image up to 5 MB." });
      }

      const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `profile-images/${randomUUID()}-${safeFileName}`;
      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        ContentType: fileType,
        ContentLength: fileSize,
      });
      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
      return res.json({
        uploadUrl,
        profileImageUrl: `${publicBaseUrl}/${key}`,
      });
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Failed to prepare profile image upload." });
    }
  },
);

app.patch(
  "/profile/image",
  authenticate,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { profileImage } = req.body;
      if (profileImage !== null && typeof profileImage !== "string") {
        return res.status(400).json({ error: "Invalid profile image URL." });
      }
      if (typeof profileImage === "string") {
        const imageUrl = new URL(profileImage);
        if (imageUrl.protocol !== "https:" && imageUrl.protocol !== "http:") {
          return res
            .status(400)
            .json({ error: "Profile image URL must use HTTP or HTTPS." });
        }
      }
      const updated = await prisma.user.update({
        where: { id: (req as any).user.userId },
        data: { profileImage },
        select: { id: true, profileImage: true },
      });
      return res.json({
        ...updated,
        profileImage: getPublicProfileImageUrl(updated.profileImage),
      });
    } catch (error) {
      return res.status(400).json({ error: "Failed to update profile image." });
    }
  },
);

// 6. CREATE A VIDEO (PROTECTED ROUTE)
app.post(
  "/videos",
  authenticate,
  requireAdmin,
  async (req: Request, res: Response): Promise<any> => {
    try {
      // Notice we added activeSource here!
      const {
        title,
        description,
        category,
        duration,
        thumbnail,
        youtubeUrl,
        cloudflareUrl,
        activeSource,
        course,
      } = req.body;

      if (!courseValues.includes(course))
        return res
          .status(400)
          .json({ error: "Assign the video to a valid course or Free for all." });

      const newVideo = await prisma.video.create({
        data: {
          title,
          description,
          category,
          duration: Number(duration), // We force this to be a strict Number to keep Prisma happy
          thumbnail,
          youtubeUrl,
          cloudflareUrl,
          activeSource: activeSource || "YOUTUBE", // We save the admin's radio button choice!
          course,
        },
      });

      return res.status(201).json(newVideo);
    } catch (error) {
      // I made the error log stand out so we can easily read it in the terminal!
      console.log("\n❌ DATABASE ERROR:", error, "\n");
      return res.status(500).json({ error: "Failed to create video" });
    }
  },
);

// Students only receive videos in courses covered by approved payment requests.
app.get(
  "/videos",
  authenticate,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const user = (req as any).user;
      const accessCourses =
        user.role === "USER"
          ? await coursesForStudent(user.userId)
          : [...courseValues];
      const videos = await prisma.video.findMany({
        where:
          user.role === "USER"
            ? { course: { in: accessCourses as any } }
            : undefined,
        orderBy: { createdAt: "desc" }, // Shows newest videos first!
      });
      return res.json(
        videos.map((video) => ({
          ...video,
          cloudflareUrl: getPublicR2ObjectUrl(video.cloudflareUrl),
        })),
      );
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch videos" });
    }
  },
);

app.post(
  "/payment-requests/receipt-upload-url",
  authenticate,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const user = (req as any).user;
      if (user.role !== "USER")
        return res
          .status(403)
          .json({ error: "Only students can submit payment receipts." });
      const { fileName, fileType, fileSize } = req.body;
      if (
        typeof fileName !== "string" ||
        !["image/jpeg", "image/png", "image/webp"].includes(fileType) ||
        !Number.isInteger(fileSize) ||
        fileSize < 1 ||
        fileSize > 5 * 1024 * 1024
      ) {
        return res
          .status(400)
          .json({ error: "Choose a JPG, PNG, or WebP screenshot up to 5 MB." });
      }
      const key = `payment-receipts/${user.userId}/${randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        ContentType: fileType,
        ContentLength: fileSize,
      });
      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
      return res.json({ uploadUrl, receiptObjectKey: key });
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Could not prepare receipt image upload." });
    }
  },
);

app.post(
  "/payment-requests",
  authenticate,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const user = (req as any).user;
      if (user.role !== "USER")
        return res
          .status(403)
          .json({ error: "Only students can submit payment receipts." });
      const { option, amount, currency, receiptText, receiptObjectKey } =
        req.body;
      const parsedAmount = Number(amount);
      if (
        !purchaseValues.includes(option) ||
        !Number.isFinite(parsedAmount) ||
        parsedAmount <= 0 ||
        parsedAmount > 1000000000 ||
        typeof currency !== "string" ||
        !/^[A-Za-z]{3}$/.test(currency) ||
        (receiptText != null && (typeof receiptText !== "string" || receiptText.length > 10000)) ||
        (receiptObjectKey != null && (typeof receiptObjectKey !== "string" || !receiptObjectKey.startsWith(`payment-receipts/${user.userId}/`)))
      ) {
        return res.status(400).json({
          error:
            "Enter a valid course, amount, and 3-letter currency code.",
        });
      }
      if (receiptObjectKey) {
        const uploadedReceipt = await s3.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: receiptObjectKey }));
        if (!uploadedReceipt.ContentType || !["image/jpeg", "image/png", "image/webp"].includes(uploadedReceipt.ContentType) || !uploadedReceipt.ContentLength || uploadedReceipt.ContentLength > 5 * 1024 * 1024) {
          return res.status(400).json({ error: "Receipt screenshot upload is missing or invalid." });
        }
      }
      const request = await prisma.paymentRequest.create({
        data: {
          userId: user.userId,
          option,
          amount: parsedAmount,
          currency: currency.toUpperCase(),
          receiptText: typeof receiptText === "string" ? receiptText.trim() || null : null,
          receiptObjectKey: receiptObjectKey || null,
        },
      });
      return res.status(201).json({
        id: request.id,
        status: request.status,
        createdAt: request.createdAt,
      });
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Could not submit payment receipt." });
    }
  },
);

app.get(
  "/my/payment-requests",
  authenticate,
  async (req: Request, res: Response): Promise<any> => {
    const user = (req as any).user;
    const requests = await prisma.paymentRequest.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        option: true,
        amount: true,
        currency: true,
        status: true,
        approvedOption: true,
        adminNote: true,
        createdAt: true,
        reviewedAt: true,
      },
    });
    return res.json(requests);
  },
);

app.get(
  "/payment-requests",
  authenticate,
  requireAdmin,
  async (_req: Request, res: Response): Promise<any> => {
    try {
      const requests = await prisma.paymentRequest.findMany({
        include: {
          user: { select: { id: true, name: true, phone: true } },
        },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      });
      const result = await Promise.all(
        requests.map(async ({ receiptObjectKey, ...request }) => ({
          ...request,
          amount: request.amount.toString(),
          receiptImageUrl: receiptObjectKey ? await getSignedUrl(
            s3,
            new GetObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME,
              Key: receiptObjectKey,
            }),
            { expiresIn: 900 },
          ) : null,
        })),
      );
      return res.json(result);
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Could not load payment receipts." });
    }
  },
);

app.patch(
  "/payment-requests/:id/review",
  authenticate,
  requireAdmin,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { status, adminNote } = req.body;
      if (
        !["APPROVED", "REJECTED"].includes(status) ||
        (adminNote != null &&
          (typeof adminNote !== "string" || adminNote.length > 2000))
      ) {
        return res.status(400).json({
          error: "Choose approve or reject and provide a valid optional note.",
        });
      }
      const existing = await prisma.paymentRequest.findUnique({
        where: { id: req.params.id as string },
        select: { option: true, status: true, userId: true },
      });
      if (!existing)
        return res.status(404).json({ error: "Payment request not found." });
      const payment = await prisma.paymentRequest.update({
        where: { id: req.params.id as string },
        data: {
          status,
          approvedOption: status === "APPROVED" ? existing.option : null,
          adminNote:
            typeof adminNote === "string" ? adminNote.trim() || null : null,
          reviewedById: (req as any).user.userId,
          reviewedAt: new Date(),
        },
      });
      const approvedPayments = await prisma.paymentRequest.count({ where: { userId: existing.userId, status: "APPROVED" } });
      if (approvedPayments > 0) {
        await prisma.user.update({ where: { id: existing.userId }, data: { status: "APPROVED" } });
      } else if (status === "REJECTED") {
        await prisma.user.update({ where: { id: existing.userId }, data: { status: "REJECTED" } });
      }
      return res.json({
        id: payment.id,
        status: payment.status,
        approvedOption: payment.approvedOption,
      });
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Could not update this payment review." });
    }
  },
);

// 8. GET YOUTUBE METADATA
// React will send a YouTube Video ID here, and we ask Google for the details!
app.post(
  "/youtube-info",
  authenticate,
  requireAdmin,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { videoId } = req.body;

      // We use the native Javascript 'fetch' to talk to Google's API
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${process.env.YOUTUBE_API_KEY}`,
      );
      const data = await response.json();

      // If YouTube can't find the video
      if (!data.items || data.items.length === 0) {
        return res.status(404).json({ error: "YouTube video not found" });
      }

      // Extract the details we want
      const snippet = data.items[0].snippet;
      const contentDetails = data.items[0].contentDetails;
      const durationMatch = contentDetails.duration.match(
        /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/,
      );
      const durationSeconds = durationMatch
        ? Number(durationMatch[1] || 0) * 3600 +
          Number(durationMatch[2] || 0) * 60 +
          Number(durationMatch[3] || 0)
        : 0;

      // Send it back to React nicely formatted
      return res.json({
        title: snippet.title,
        description: snippet.description,
        thumbnail: snippet.thumbnails.high.url,
        durationSeconds,
      });
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch YouTube data" });
    }
  },
);

// 9. GENERATE CLOUDFLARE UPLOAD TICKET (PRESIGNED URL)
app.post(
  "/upload-url",
  authenticate,
  requireAdmin,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { fileName, fileType } = req.body;
      const cloudflareObjectKey = `videos/${Date.now()}-${fileName}`;

      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: cloudflareObjectKey,
        ContentType: fileType,
      });

      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

      const cloudflareUrl = getPublicR2ObjectUrl(cloudflareObjectKey);

      // We send BOTH the secret upload ticket AND the final public URL back to React
      return res.json({
        uploadUrl: uploadUrl,
        cloudflareUrl: cloudflareUrl,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

// 10. DELETE A VIDEO
app.delete(
  "/videos/:id",
  authenticate,
  requireAdmin,
  async (req: Request, res: Response): Promise<any> => {
    try {
      // NOTICE the "as string" we added here!
      await prisma.video.delete({ where: { id: req.params.id as string } });
      return res.json({ message: "Video deleted successfully" });
    } catch (error) {
      return res.status(500).json({ error: "Failed to delete video" });
    }
  },
);

// 11. UPDATE ACTIVE SOURCE (Edit Video)
app.patch(
  "/videos/:id/source",
  authenticate,
  requireAdmin,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { activeSource } = req.body; // Must be 'YOUTUBE' or 'CLOUDFLARE'
      const updatedVideo = await prisma.video.update({
        // NOTICE the "as string" we added here!
        where: { id: req.params.id as string },
        data: { activeSource },
      });
      return res.json(updatedVideo);
    } catch (error) {
      return res.status(500).json({ error: "Failed to update source" });
    }
  },
);

app.patch(
  "/videos/:id/course",
  authenticate,
  requireAdmin,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { course } = req.body;
      if (!courseValues.includes(course))
        return res
          .status(400)
          .json({ error: "Choose a valid grade or freshman course." });
      const updatedVideo = await prisma.video.update({
        where: { id: req.params.id as string },
        data: { course },
      });
      return res.json(updatedVideo);
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Could not update the video course." });
    }
  },
);

app.get(
  "/enrollments",
  authenticate,
  requireAdmin,
  async (_req: Request, res: Response): Promise<any> => {
    try {
      const enrollments = await prisma.user.findMany({
        where: { role: "USER", status: "PENDING" },
        select: {
          id: true,
          name: true,
          phone: true,
          profileImage: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      });
      return res.json(
        enrollments.map((user) => ({
          ...user,
          profileImage: getPublicProfileImageUrl(user.profileImage),
        })),
      );
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Failed to load student enrollments." });
    }
  },
);

app.patch(
  "/users/:id/enrollment-status",
  authenticate,
  requireAdmin,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { status } = req.body;
      if (!["APPROVED", "REJECTED"].includes(status)) {
        return res.status(400).json({ error: "Choose APPROVED or REJECTED." });
      }
      const userId = req.params.id as string;
      const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (!target || target.role !== "USER") {
        return res
          .status(404)
          .json({ error: "Student enrollment was not found." });
      }
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { status: status as any },
        select: { id: true, name: true, status: true },
      });
      if (status === "REJECTED") {
        await prisma.paymentRequest.updateMany({
          where: { userId, status: "APPROVED" },
          data: { status: "REJECTED", approvedOption: null, reviewedById: (req as any).user.userId, reviewedAt: new Date() },
        });
      }
      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ error: "Failed to update enrollment." });
    }
  },
);

// 12. GET USERS WITH SEARCH & PAGINATION
app.get(
  "/users",
  authenticate,
  requireAdmin,
  async (req: Request, res: Response): Promise<any> => {
    try {
      // 1. Read page number, limit, and search query from the URL (e.g., /users?page=1&search=alex)
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(
        50,
        Math.max(1, parseInt(req.query.limit as string) || 10),
      );
      const search = (req.query.search as string)?.trim() || "";
      const accountType = (req.query.accountType as string) || "ALL";
      const status = (req.query.status as string) || "ALL";
      const adminRole = (req.query.adminRole as string) || "ALL";

      if (!["ALL", "STUDENT", "ADMIN"].includes(accountType)) {
        return res
          .status(400)
          .json({ error: "Choose a valid account type filter." });
      }
      if (!["ALL", "PENDING", "APPROVED", "REJECTED"].includes(status)) {
        return res
          .status(400)
          .json({ error: "Choose a valid enrollment status filter." });
      }
      if (!["ALL", "ADMIN", "SUPER_ADMIN"].includes(adminRole)) {
        return res
          .status(400)
          .json({ error: "Choose a valid administrator role filter." });
      }

      const where: Prisma.UserWhereInput = {
        ...(accountType === "STUDENT" ? { role: "USER" } : {}),
        ...(accountType === "ADMIN" && adminRole !== "ALL"
          ? { role: adminRole as "ADMIN" | "SUPER_ADMIN" }
          : {}),
        ...(accountType === "ADMIN" && adminRole === "ALL"
          ? { role: { in: ["ADMIN", "SUPER_ADMIN"] } }
          : {}),
        ...(status === "ALL"
          ? {}
          : { status: status as "PENDING" | "APPROVED" | "REJECTED" }),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                ...(accountType === "STUDENT" ? [] : [{ email: { contains: search, mode: "insensitive" as const } }]),
                { phone: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      // Calculate how many users to skip
      const skip = (page - 1) * limit;

      // Run both queries together: fetch users AND count the total matching users
      const [users, totalCount] = await Promise.all([
        prisma.user.findMany({
          where,
          skip: skip,
          take: limit,
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            status: true,
            profileImage: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.user.count({
          where,
        }),
      ]);

      // Send back the users PLUS the pagination details
      return res.json({
        users: users.map(({ email, ...user }) => ({
          ...user,
          ...(user.role === "USER" ? {} : { email }),
          profileImage: getPublicProfileImageUrl(user.profileImage),
        })),
        pagination: {
          total: totalCount,
          page,
          totalPages: Math.ceil(totalCount / limit),
        },
      });
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch users" });
    }
  },
);

// Generate a short-lived R2 upload URL for a user's profile image.
app.post(
  "/users/:id/profile-image/upload-url",
  authenticate,
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { fileName, fileType, fileSize } = req.body;
      const allowedImageTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
      ];
      const maxFileSize = 5 * 1024 * 1024;
      const publicBaseUrl = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");

      if (!publicBaseUrl) {
        return res.status(503).json({
          error:
            "Configure R2_PUBLIC_URL with the public domain for your R2 bucket before uploading profile images.",
        });
      }

      if (
        typeof fileName !== "string" ||
        !allowedImageTypes.includes(fileType) ||
        !Number.isInteger(fileSize) ||
        fileSize <= 0 ||
        fileSize > maxFileSize
      ) {
        return res
          .status(400)
          .json({ error: "Choose a JPG, PNG, WebP, or GIF image up to 5 MB." });
      }

      const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `profile-images/${randomUUID()}-${safeFileName}`;
      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        ContentType: fileType,
        ContentLength: fileSize,
      });
      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
      return res.json({
        uploadUrl,
        profileImageUrl: `${publicBaseUrl}/${key}`,
      });
    } catch (error) {
      console.error("Failed to generate profile image upload URL:", error);
      return res
        .status(500)
        .json({ error: "Failed to prepare profile image upload." });
    }
  },
);

// Set or clear a user's profile image URL.
app.patch(
  "/users/:id/profile-image",
  authenticate,
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { profileImage } = req.body;
      if (profileImage !== null) {
        if (typeof profileImage !== "string" || profileImage.length > 2048) {
          return res.status(400).json({ error: "Invalid profile image URL." });
        }
        let imageUrl: URL;
        try {
          imageUrl = new URL(profileImage);
        } catch {
          return res.status(400).json({ error: "Invalid profile image URL." });
        }
        if (imageUrl.protocol !== "https:" && imageUrl.protocol !== "http:") {
          return res
            .status(400)
            .json({ error: "Profile image URL must use HTTP or HTTPS." });
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id: req.params.id as string },
        data: { profileImage },
        select: { id: true, profileImage: true },
      });
      return res.json(updatedUser);
    } catch (error) {
      return res.status(500).json({ error: "Failed to update profile image." });
    }
  },
);

// 13. UPDATE USER ROLE (SUPER ADMIN ONLY)
app.patch(
  "/users/:id/role",
  authenticate,
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { role } = req.body; // 'USER', 'ADMIN', or 'SUPER_ADMIN'
      if (!["USER", "ADMIN", "SUPER_ADMIN"].includes(role)) {
        return res.status(400).json({ error: "Choose a valid account role." });
      }
      const updatedUser = await prisma.user.update({
        where: { id: req.params.id as string },
        data: { role, status: role === "USER" ? "PENDING" : "APPROVED" },
        select: { id: true, email: true, role: true, status: true },
      });
      return res.json(updatedUser);
    } catch (error) {
      return res.status(500).json({ error: "Failed to update role" });
    }
  },
);

// Update account details. Admins can manage students; only super admins can manage admins.
app.patch(
  "/users/:id",
  authenticate,
  requireAdmin,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const actor = (req as any).user;
      const existingUser = await prisma.user.findUnique({
        where: { id: req.params.id as string },
        select: { id: true, role: true },
      });
      if (!existingUser)
        return res.status(404).json({ error: "Account not found." });
      if (actor.role !== "SUPER_ADMIN" && existingUser.role !== "USER") {
        return res.status(403).json({
          error: "Only a super admin can edit administrator accounts.",
        });
      }

      const { name, email, phone, password } = req.body;
      const data: Prisma.UserUpdateInput = {};
      if (name !== undefined) {
        if (
          typeof name !== "string" ||
          name.trim().length < 2 ||
          name.trim().length > 100
        ) {
          return res
            .status(400)
            .json({ error: "Name must be between 2 and 100 characters." });
        }
        data.name = name.trim();
      }
      if (email !== undefined) {
        if (existingUser.role === "USER") {
          return res.status(400).json({ error: "Student accounts use a phone number, not email." });
        }
        if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email.trim())) {
          return res
            .status(400)
            .json({ error: "Enter a valid email address." });
        }
        data.email = email.trim().toLowerCase();
      }
      if (phone !== undefined) {
        if (
          phone !== null &&
          (typeof phone !== "string" || phone.length > 32)
        ) {
          return res
            .status(400)
            .json({ error: "Phone number must be 32 characters or fewer." });
        }
        const normalizedPhone = normalizePhone(phone);
        if (existingUser.role === "USER" && !validPhone(normalizedPhone)) {
          return res.status(400).json({ error: "Enter a valid student phone number." });
        }
        if (existingUser.role === "USER") {
          const duplicatePhone = await prisma.user.findFirst({
            where: { role: "USER", phone: normalizedPhone, id: { not: existingUser.id } },
            select: { id: true },
          });
          if (duplicatePhone) return res.status(400).json({ error: "That phone number is already used by another student." });
        }
        data.phone = typeof phone === "string" ? normalizedPhone || null : null;
      } else if (existingUser.role === "USER") {
        const current = await prisma.user.findUnique({ where: { id: existingUser.id }, select: { phone: true } });
        if (!current?.phone || !validPhone(normalizePhone(current.phone))) {
          return res.status(400).json({ error: "Add a valid phone number to this student account." });
        }
        data.email = null;
      }
      if (password !== undefined && password !== "") {
        if (existingUser.role !== "USER") return res.status(403).json({ error: "Use your own security settings to change an administrator password." });
        if (typeof password !== "string" || password.length < 8) return res.status(400).json({ error: "Student passwords must be at least 8 characters." });
        data.password = await bcrypt.hash(password, 10);
      }
      if (Object.keys(data).length === 0) {
        return res
          .status(400)
          .json({ error: "Provide at least one account field to update." });
      }

      const updatedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          profileImage: true,
          createdAt: true,
        },
      });
      return res.json({
        ...updatedUser,
        profileImage: getPublicProfileImageUrl(updatedUser.profileImage),
      });
    } catch (error) {
      return res.status(400).json({
        error: "Could not update account. Check the phone number and try again.",
      });
    }
  },
);

// Delete student accounts for admins, and any account for super admins.
app.delete(
  "/users/:id",
  authenticate,
  requireAdmin,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const actor = (req as any).user;
      const target = await prisma.user.findUnique({
        where: { id: req.params.id as string },
        select: { id: true, role: true },
      });
      if (!target) return res.status(404).json({ error: "Account not found." });
      if (actor.userId === target.id) {
        return res
          .status(400)
          .json({ error: "You cannot delete your own account." });
      }
      if (actor.role !== "SUPER_ADMIN" && target.role !== "USER") {
        return res.status(403).json({
          error: "Only a super admin can delete administrator accounts.",
        });
      }

      await prisma.user.delete({ where: { id: target.id } });
      return res.json({ message: "Account deleted successfully." });
    } catch (error) {
      return res.status(500).json({ error: "Failed to delete user" });
    }
  },
);

// Create student accounts for admins, and any account type for super admins.
app.post(
  "/users",
  authenticate,
  requireAdmin,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { name, email, phone, password, role } = req.body;
      const actor = (req as any).user;
      const normalizedName = typeof name === "string" ? name.trim() : "";
      const selectedRole =
        role || (actor.role === "SUPER_ADMIN" ? "ADMIN" : "USER");
      const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
      const normalizedPhone = normalizePhone(phone);
      if (
        normalizedName.length < 2 ||
        normalizedName.length > 100 ||
        (selectedRole === "USER" ? !validPhone(normalizedPhone) : !/^\S+@\S+\.\S+$/.test(normalizedEmail)) ||
        typeof password !== "string" ||
        password.length < 8 ||
        (phone != null && (typeof phone !== "string" || phone.length > 32)) ||
        !["USER", "ADMIN", "SUPER_ADMIN"].includes(selectedRole) ||
        (actor.role !== "SUPER_ADMIN" && selectedRole !== "USER")
      ) {
        return res.status(400).json({
          error:
            "Enter valid account details and a role you are allowed to create.",
        });
      }
      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await prisma.user.create({
        data: {
          name: normalizedName,
          email: selectedRole === "USER" ? null : normalizedEmail,
          phone: selectedRole === "USER" ? normalizedPhone : phone?.trim() || null,
          password: hashedPassword,
          role: selectedRole as any,
          status: selectedRole === "USER" ? "PENDING" : "APPROVED",
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
        },
      });

      return res.status(201).json(newUser);
    } catch (error) {
      return res
        .status(400)
        .json({ error: "Phone number/email already registered or account details are invalid." });
    }
  },
);

app.get(
  "/notifications",
  authenticate,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const userId = (req as any).user.userId as string;
      const notifications = await prisma.$queryRaw<
        Array<{ id: string; title: string; body: string; createdAt: Date; isRead: boolean }>
      >`SELECT n."id", n."title", n."body", n."createdAt",
          EXISTS (
            SELECT 1 FROM "NotificationRead" r
            WHERE r."notificationId" = n."id" AND r."userId" = ${userId}
          ) AS "isRead"
        FROM "NotificationMessage" n
        ORDER BY n."createdAt" DESC`;

      return res.json(notifications);
    } catch (error) {
      console.error("Failed to load notifications:", error);
      return res.status(500).json({ error: "Could not load notifications." });
    }
  },
);

app.patch(
  "/notifications/:id/read",
  authenticate,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const notificationId = req.params.id as string;
      const userId = (req as any).user.userId as string;
      const marked = await prisma.$queryRaw<Array<{ notificationId: string }>>`
        INSERT INTO "NotificationRead" ("notificationId", "userId", "readAt")
        SELECT n."id", ${userId}, CURRENT_TIMESTAMP
        FROM "NotificationMessage" n
        WHERE n."id" = ${notificationId}
        ON CONFLICT ("notificationId", "userId") DO NOTHING
        RETURNING "notificationId"`;
      if (marked.length === 0) {
        const existing = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "NotificationMessage" WHERE "id" = ${notificationId} LIMIT 1`;
        if (existing.length === 0) {
          return res.status(404).json({ error: "Notification not found." });
        }
      }
      return res.json({ message: "Notification marked as read." });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      return res.status(500).json({ error: "Could not update notification." });
    }
  },
);

app.post(
  "/notify",
  authenticate,
  requireSuperAdmin,
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { title, body } = req.body;
      const normalizedTitle = typeof title === "string" ? title.trim() : "";
      const normalizedBody = typeof body === "string" ? body.trim() : "";
      if (
        normalizedTitle.length < 1 ||
        normalizedTitle.length > 120 ||
        normalizedBody.length < 1 ||
        normalizedBody.length > 5000
      ) {
        return res.status(400).json({
          error: "Enter a title up to 120 characters and a message up to 5,000 characters.",
        });
      }

      const created = await prisma.$queryRaw<
        Array<{ id: string; title: string; body: string; createdAt: Date }>
      >`INSERT INTO "NotificationMessage" ("id", "title", "body", "createdAt")
        VALUES (${randomUUID()}, ${normalizedTitle}, ${normalizedBody}, CURRENT_TIMESTAMP)
        RETURNING "id", "title", "body", "createdAt"`;
      const notification = created[0];
      if (!notification) {
        return res.status(500).json({ error: "Could not save the notification." });
      }

      try {
        const response = await getMessaging().send({
          topic: "all",
          notification: { title: normalizedTitle, body: normalizedBody },
          data: { notificationId: notification.id },
          android: {
            priority: "high",
            notification: { channelId: "mini_learning_announcements" },
          },
        });

        return res.json({
          message: "Notification sent successfully.",
          notification,
          response,
        });
      } catch (error) {
        await prisma.$executeRaw`DELETE FROM "NotificationMessage" WHERE "id" = ${notification.id}`;
        throw error;
      }
    } catch (error) {
      console.error("Firebase Error:", error);
      return res.status(500).json({ error: "Failed to send notification." });
    }
  },
);

// TURN THE SERVER ON
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
