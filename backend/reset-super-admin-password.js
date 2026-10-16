// // Run from backend/ with: node reset-super-admin-password.js
// // This local recovery helper never prints or stores the new password.
// require("dotenv").config();

// const { PrismaClient } = require("@prisma/client");
// const bcrypt = require("bcrypt");
// const readline = require("node:readline");

// const prisma = new PrismaClient();

// function ask(question) {
//   const terminal = readline.createInterface({
//     input: process.stdin,
//     output: process.stdout,
//   });
//   return new Promise((resolve) =>
//     terminal.question(question, (answer) => {
//       terminal.close();
//       resolve(answer.trim());
//     }),
//   );
// }

// function askHidden(question) {
//   return new Promise((resolve, reject) => {
//     if (
//       !process.stdin.isTTY ||
//       typeof process.stdin.setRawMode !== "function"
//     ) {
//       reject(new Error("Run this script in an interactive terminal."));
//       return;
//     }

//     process.stdout.write(question);
//     readline.emitKeypressEvents(process.stdin);
//     process.stdin.setRawMode(true);
//     process.stdin.resume();

//     let answer = "";
//     const cleanup = () => {
//       process.stdin.setRawMode(false);
//       process.stdin.pause();
//       process.stdin.removeListener("keypress", onKeypress);
//     };
//     const onKeypress = (character, key) => {
//       if (key?.ctrl && key.name === "c") {
//         cleanup();
//         process.stdout.write("\nCancelled.\n");
//         reject(new Error("Cancelled."));
//       } else if (key?.name === "return" || key?.name === "enter") {
//         cleanup();
//         process.stdout.write("\n");
//         resolve(answer);
//       } else if (key?.name === "backspace") {
//         answer = answer.slice(0, -1);
//       } else if (!key?.ctrl && !key?.meta && character) {
//         answer += character;
//       }
//     };
//     process.stdin.on("keypress", onKeypress);
//   });
// }

// async function main() {
//   const accounts = await prisma.user.findMany({
//     where: { role: "SUPER_ADMIN" },
//     orderBy: { email: "asc" },
//     select: { id: true, name: true, email: true },
//   });

//   if (accounts.length === 0) {
//     throw new Error("No super admin accounts were found in this database.");
//   }

//   console.log("Super admin accounts in this database:");
//   accounts.forEach((account, index) => {
//     console.log(
//       `${index + 1}. ${account.name || "(no name)"} — ${account.email}`,
//     );
//   });
//   const selection = Number(await ask("Choose an account number: "));
//   if (
//     !Number.isInteger(selection) ||
//     selection < 1 ||
//     selection > accounts.length
//   ) {
//     throw new Error("Choose one of the listed account numbers.");
//   }
//   const user = accounts[selection - 1];

//   const password = await askHidden("New password (minimum 8 characters): ");
//   if (password.length < 8) {
//     throw new Error("Password must be at least 8 characters long.");
//   }

//   const confirmation = await askHidden("Confirm new password: ");
//   if (password !== confirmation) {
//     throw new Error("Passwords did not match. Nothing was changed.");
//   }

//   const hashedPassword = await bcrypt.hash(password, 10);
//   const result = await prisma.user.updateMany({
//     where: { id: user.id, role: "SUPER_ADMIN" },
//     data: { password: hashedPassword },
//   });

//   if (result.count !== 1) {
//     throw new Error("The account changed during reset. Nothing was updated.");
//   }

//   console.log("Password reset complete. Sign in with the new password.");
// }

// main()
//   .catch((error) => {
//     if (error.message !== "Cancelled.") {
//       console.error(error.message || "Password reset failed.");
//       process.exitCode = 1;
//     }
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });
