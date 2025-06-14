const fs = require('fs');
const { makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const pino = require("pino");
const chalk = require("chalk");
const readline = require("readline");

const usePairingCode = true;
const cooldownFile = './cooldown.json';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function question(prompt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(prompt, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

async function connectBot() {
  console.log(chalk.blue("🔌 Menghubungkan ke WhatsApp..."));

  const { state, saveCreds } = await useMultiFileAuthState('./session');

  const sock = makeWASocket({
    logger: pino({ level: "silent" }),
    printQRInTerminal: !usePairingCode,
    auth: state,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    version: [2, 3000, 1015901307],
  });

  if (usePairingCode && !sock.authState.creds.registered) {
    const phoneNumber = await question("📱 Masukkan nomor WhatsApp kamu (contoh: 628xxxxx): ");
    try {
      const code = await sock.requestPairingCode(phoneNumber);
      console.log(chalk.green(`✅ Pairing Code: ${code}`));
    } catch (err) {
      console.error(chalk.red("❌ Gagal pairing:"), err);
      return;
    }
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection }) => {
    if (connection === "open") {
      console.log(chalk.green("🤖 Bot berhasil terhubung dan aktif!"));
    } else if (connection === "close") {
      console.log(chalk.red("❌ Koneksi terputus. Mengulang..."));
      connectBot();
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe || msg.message.protocolMessage) return;

    const from = msg.key.remoteJid;
    const sender = from.replace("@s.whatsapp.net", "");

    let text = "";
    if (msg.message?.conversation) text = msg.message.conversation;
    else if (msg.message?.extendedTextMessage?.text) text = msg.message.extendedTextMessage.text;

    // Cooldown system
    const cooldownData = fs.existsSync(cooldownFile)
      ? JSON.parse(fs.readFileSync(cooldownFile))
      : {};

    const now = Date.now();
    const cooldown = cooldownData[sender] || 0;
    const customCooldown = parseInt(await question("⏱️ Masukkan jeda antar pesan dalam milidetik (misal 5000 untuk 5 detik): "), 10);

    if (now - cooldown < customCooldown) {
      const sisa = ((customCooldown - (now - cooldown)) / 1000).toFixed(1);
      await sock.sendMessage(from, { text: `⏳ Tunggu ${sisa} detik sebelum mengirim pesan lagi.` });
      return;
    }

    cooldownData[sender] = now;
    fs.writeFileSync(cooldownFile, JSON.stringify(cooldownData, null, 2));

    await sock.sendMessage(from, { text: `Halo ${sender}, pesan kamu diterima!` });
  });
}

connectBot();
