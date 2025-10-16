// index.js
const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const qrcode = require("qrcode-terminal");
const chalk = require("chalk");
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const moment = require("moment");
const { messageHandler } = require("./xiao");
const { botName } = require("./setting");

async function startBot() {
  // 🔹 Auth system baru (otomatis buat folder session)
  const { state, saveCreds } = await useMultiFileAuthState("session");

  // 🔹 Ambil versi WhatsApp terbaru
  const { version } = await fetchLatestBaileysVersion();

  // 🔹 Buat koneksi socket
  const sock = makeWASocket({
    version,
    printQRInTerminal: false,
    auth: state,
    logger: pino({ level: "silent" })
  });

  // =========================
  // 🟢 EVENT: QR / CONNECTION
  // =========================
  sock.ev.on("connection.update", (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      console.log(chalk.cyan("\n📱 Scan QR ini di WhatsApp kamu (Linked Devices):"));
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log(chalk.green(`[${moment().format("HH:mm:ss")}] ✅ ${botName} berhasil terhubung ke WhatsApp!`));
    }

    if (connection === "close") {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) {
        console.log(chalk.yellow("🔄 Koneksi terputus, mencoba menghubungkan ulang..."));
        startBot();
      } else {
        console.log(chalk.red("❌ Logout terdeteksi, hapus folder session lalu jalankan ulang bot."));
      }
    }
  });

  // =========================
  // 🟢 EVENT: UPDATE AUTH
  // =========================
  sock.ev.on("creds.update", saveCreds);

  // =========================
  // 🟢 EVENT: MESSAGE HANDLER
  // =========================
  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key.fromMe && msg.message) await messageHandler(sock, msg);
    }
  });
}

startBot();