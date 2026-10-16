// Run from backend/ with: npm run create:super-admin
// Reads credentials interactively; the password is never written to disk.
require("dotenv").config();

// Use the direct Neon connection for this one-time administrative operation.
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const readline = require("node:readline");

const prisma = new PrismaClient();

function ask(question) {
  const terminal = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    terminal.question(question, (answer) => {
      terminal.close();
      resolve(answer.trim());
    }),
  );
}

function askHidden(question) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
      reject(new Error("Run this command in an interactive PowerShell terminal."));
      return;
    }

    process.stdout.write(question);
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    let answer = "";
    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("keypress", onKeypress);
    };
    const onKeypress = (character, key) => {
      if (key?.ctrl && key.name === "c") {
        cleanup();
        process.stdout.write("\nCancelled.\n");
        reject(new Error("Cancelled."));
      } else if (key?.name === "return" || key?.name === "enter") {
        cleanup();
        process.stdout.write("\n");
        resolve(answer);
      } else if (key?.name === "backspace") {
        answer = answer.slice(0, -1);
      } else if (!key?.ctrl && !key?.meta && character) {
        answer += character;
      }
    };
    process.stdin.on("keypress", onKeypress);
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DIRECT_URL is missing from backend/.env.");
  }

  const name = await ask("Super admin name: ");
  const email = (await ask("Super admin email: ")).toLowerCase();
  if (name.length < 2 || name.length > 100) {
    throw new Error("Enter a name between 2 and 100 characters.");
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error(
      "That email already has an account. Nothing was changed; choose another email.",
    );
  }

  const password = await askHidden("Password (minimum 8 characters): ");
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }
  const confirmation = await askHidden("Confirm password: ");
  if (password !== confirmation) {
    throw new Error("Passwords did not match. Nothing was changed.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      name,
      email,
      password: passwordHash,
      role: "SUPER_ADMIN",
      status: "APPROVED",
    },
    select: { id: true },
  });

  console.log(`Super admin account created for ${email}. You can now sign in.`);
}

main()
  .catch((error) => {
    if (error.message !== "Cancelled.") {
      console.error(error.message || "Could not create the super admin account.");
      process.exitCode = 1;
    }
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
