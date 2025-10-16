const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const pino = require("pino");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");
const { messageHandler } = require("./xiao");
const { prefix, botName } = require("./setting");

const authFile = path.join(__dirname, "auth_info_multi.json");
const { state, saveState } = useSingleFileAuthState(authFile);

async function startSock() {
  try {
    const logger = pino({ level: "silent" }); // silent or 'debug' if mau log detail
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Using WA version v${version.join(".")}, latest: ${isLatest}`);

    const sock = makeWASocket({
      logger,
      printQRInTerminal: false, // we'll print by qrcode-terminal manually
      auth: state,
      version
    });

    // show QR code in terminal (qrcode-terminal)
    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        console.log("📡 QR code received, scan with WhatsApp on phone:");
        qrcode.generate(qr, { small: true });
      }
      if (connection) {
        console.log("Connection update:", connection);
      }
      if (connection === "close") {
        const shouldReconnect = lastDisconnect && lastDisconnect.error && (lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut);
        console.log("Connection closed. Reason:", lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error || lastDisconnect);
        if (shouldReconnect) {
          console.log("Reconnecting...");
          startSock();
        } else {
          console.log("Logged out — remove auth_info_multi.json and scan again.");
        }
      }
      if (connection === "open") {
        console.log(`${botName} connected ✅`);
      }
    });

    // save auth state on update
    sock.ev.on("creds.update", saveState);

    // messages
    sock.ev.on("messages.upsert", async (m) => {
      // m.messages is an array
      try {
        for (const msg of m.messages) {
          // ignore status broadcast from our own socket?
          if (!msg.key || msg.key.remoteJid === undefined) continue;
          // ignore messages from me if you want: if (msg.key.fromMe) continue;
          // pass to handler
          await messageHandler(sock, msg);
        }
      } catch (e) {
        console.error("messages.upsert error:", e?.message || e);
      }
    });

    // keep-alive logs
    sock.ev.on("connection.update", (update) => {
      // already handled above, duplicate ok
    });

    return sock;
  } catch (err) {
    console.error("startSock error:", err?.message || err);
    setTimeout(() => startSock(), 5000);
  }
}

startSock();
