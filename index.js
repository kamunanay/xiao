const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const moment = require("moment");
const { messageHandler } = require("./xiao");
const { botName } = require("./setting");

// 🎨 Warna terminal (biar tetap keren tanpa chalk)
const color = {
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  magenta: (text) => `\x1b[35m${text}\x1b[0m`
};

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("session");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    printQRInTerminal: false,
    auth: state,
    logger: pino({ level: "silent" })
  });

  // 🟢 Event: koneksi dan QR
  sock.ev.on("connection.update", (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      console.log(color.cyan("\n📱 Scan QR ini di WhatsApp kamu (Linked Devices):"));
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log(color.green(`[${moment().format("HH:mm:ss")}] ✅ ${botName} berhasil terhubung ke WhatsApp!`));
    }

    if (connection === "close") {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) {
        console.log(color.yellow("🔄 Koneksi terputus, mencoba menghubungkan ulang..."));
        startBot();
      } else {
        console.log(color.red("❌ Logout terdeteksi, hapus folder session lalu jalankan ulang bot."));
      }
    }
  });

  // 🟢 Event: update auth
  sock.ev.on("creds.update", saveCreds);

  // 🟢 Event: pesan masuk
  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.key.fromMe && msg.message) await messageHandler(sock, msg);
    }
  });
}

startBot();
