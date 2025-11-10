const axios = require("axios");
const chalk = require("chalk");
const { useMultiFileAuthState, makeWASocket } = require('@otaxayun/baileys');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const pino = require("pino");

const { prefix, botName, autoReplies, chatReactions, statusReactions } = require("./setting");

// === CONFIGURASI ===
const sessionsDir = './auth';
let sock = null;
let currentNumber = null;
const activeSessions = new Map();

// === BANNER TERMUX ===
function showBanner() {
  const banner = `
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⣿⢛⡛⠿⠛⠿⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⡿⠟⡉⣡⡖⠘⢗⣀⣀⡀⢢⣐⣤⣉⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⡿⠉⣠⣲⣾⡭⣀⢟⣩⣶⣶⡦⠈⣿⣿⣿⣷⣖⠍⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⡛⢀⠚⢩⠍⠀⠀⠡⠾⠿⣋⡥⠀⣤⠈⢷⠹⣿⣎⢳⣶⡘⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⡏⢀⡤⠉⠀⠀⠀⣴⠆⠠⠾⠋⠁⣼⡿⢰⣸⣇⢿⣿⡎⣿⡷⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⠀⢸⢧⠁⠀⠀⢸⠇⢐⣂⣠⡴⠶⣮⢡⣿⢃⡟⡘⣿⣿⢸⣷⡀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣯⢀⡏⡾⢠⣿⣶⠏⣦⢀⠈⠉⡙⢻⡏⣾⡏⣼⠇⢳⣿⡇⣼⡿⡁⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⠈⡇⡇⡘⢏⡃⠀⢿⣶⣾⣷⣿⣿⣿⡘⡸⠇⠌⣾⢏⡼⣿⠇⠀⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⡀⠀⢇⠃⢢⡙⣜⣾⣿⣿⣿⣿⣿⣿⣧⣦⣄⡚⣡⡾⣣⠏⠀⠀⢀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣷⡀⡀⠃⠸⣧⠘⢿⣿⣿⣿⣿⣿⣻⣿⣿⣿⣿⠃⠘⠁⢈⣤⡀⣬⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣇⣅⠀⠀⠸⠀⣦⡙⢿⣿⣿⣿⣿⣿⣿⡿⠃⢀⣴⣿⣿⣿⣷⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⡿⢛⣉⣉⣀⡀⠀⢸⣿⣿⣷⣬⣛⠛⢛⣩⣵⣶⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⢋⣴⣿⣿⣿⣿⣿⣦⣬⣛⣻⠿⢿⣿⡇⠈⠙⢛⣛⣩⣭⣭⣝⡛⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⡇⣼⣿⣿⣿⣿⣿⡿⡹⢿⣿⣽⣭⣭⣭⣄⣙⠻⢿⣿⡿⣝⣛⣛⡻⢆⠙⠿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⢥⣿⣿⣿⣿⣿⣿⢇⣴⣿⣿⣿⣿⣿⡿⣿⣿⣿⣷⣌⢻⣿⣿⣿⣿⣿⣷⣶⣌⠛⢿⣿⣿⣿⣿⣿⣿⣿⣿
⡆⣿⣿⣿⣿⣿⡟⣸⣿⣿⣿⣿⣿⣿⣄⣸⣿⣿⣿⣿⣦⢻⣿⣿⣿⣿⣿⣿⣿⠁⠊⠻⣿⣿⣿⣿⣿⣿⣿
⣿⠸⣿⣿⣿⣿⡇⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⢸⣿⣿⣿⣿⣿⣿⣿⣷⣿⠀⣿⣿⣿⣿⣿⣿⣿
⣿⣄⢻⣿⣿⣿⣿⡸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠟⠸⣿⣿⣿⣿⣿⣿⣿⣿⣿⢀⣿⣿⣿⣿⣿⣿⣿
⣿⣿⠈⣿⣿⣿⣿⣷⢙⠿⣿⣿⣿⣿⣿⣿⣿⠿⣟⣩⣴⣷⣌⠻⣿⣿⣿⣿⣿⣿⡟⢠⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣆⢻⣿⣿⣿⣿⡇⣷⣶⣭⣭⣭⣵⣶⣾⣿⣿⣿⣿⣿⣿⣷⣌⠹⢿⣿⡿⢋⣠⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⡚⣿⣿⣿⣿⡇⢹⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣯⢀⣤⣶⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⡇⢻⣿⣿⣿⡇⠘⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⣿⣿⠘⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣷⠈⣿⣿⣿⣿⢆⠀⢋⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧⣿⣿⣥⡘⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⠀⣻⣿⣿⣿⠀⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣎⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣒⣻⣿⣿⢏⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣄⢻⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣇⢹⣿⡏⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣟⣿⣿⣿⣿⣿⣷⣬⡻⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⡄⠻⢱⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣝⢎⢻⣿⣿⣿
⣿⣿⣿⣿⣿⣷⢀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⣿⣿⣾⣦⢻⣿⣿
⣿⣿⣿⣿⣿⡇⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡟⣼⣿⣿⣿⣿⣆⢻⣿
⣿⣿⣿⣿⡿⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣮⡙⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡟⣰⣿⣿⣿⣿⣿⣿⣆⣿
⣿⣿⣿⣿⡇⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣝⢿⣿⣿⣿⣿⣿⣿⣿⢡⣿⣿⣿⣿⣿⣿⣿⣿⡎
⣿⣿⣿⣿⡇⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣝⢿⣿⡆⢿⣿⡿⢸⣿⣿⣿⣿⣿⣿⣿⣿⡇
⣿⣿⣿⣿⡇⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣆⢻⣿⢸⣿⡇⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷
⣿⣿⣿⣿⣧⢹⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧⢹⠸⠁⣰⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⡌⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡆⢰⣶⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣷⡘⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡌⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
  `;
  console.clear();
  console.log(chalk.cyanBright(banner));
  console.log(chalk.greenBright(`🚀 ${botName} aktif di Termux! Ketik .menu di WhatsApp untuk mulai.`));
}

// === FUNGSI BANTUAN ===
function getText(m) {
  return (
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    m.message?.imageMessage?.caption ||
    m.message?.videoMessage?.caption ||
    ""
  ).trim();
}

async function downloadMedia(sock, msg) {
  const stream = await sock.downloadMediaMessage({ message: msg });
  let buffer = Buffer.from([]);
  for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
  return buffer;
}

function isValidPhoneNumber(number) {
  const cleanNumber = number.replace(/\D/g, '');
  return cleanNumber.startsWith('62') && cleanNumber.length >= 10 && cleanNumber.length <= 15;
}

// === SISTEM PAIRING WHATSAPP ===
async function connectToWhatsApp(BotNumber, jid) {
  try {
    const sessionDir = path.join(sessionsDir, `device${BotNumber}`);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    const newSock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      defaultQueryTimeoutMs: undefined,
    });

    newSock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        if (statusCode && statusCode >= 500 && statusCode < 600) {
          await connectToWhatsApp(BotNumber, jid);
        } else {
          if (jid) {
            await newSock.sendMessage(jid, { text: `❌ Gagal tersambung dengan nomor ${BotNumber}` });
          }
        }
      } else if (connection === "open") {
        sock = newSock;
        currentNumber = BotNumber;
        activeSessions.set(BotNumber, newSock);
        if (jid) {
          await newSock.sendMessage(jid, { text: `✅ Berhasil tersambung dengan nomor ${BotNumber}` });
        }
      } else if (connection === "connecting") {
        if (!fs.existsSync(path.join(sessionDir, 'creds.json'))) {
          const code = await newSock.requestPairingCode(BotNumber);
          const formattedCode = code.match(/.{1,4}/g)?.join("-") || code;
          if (jid) {
            await newSock.sendMessage(jid, { 
              text: `📱 *KODE PAIRING*\n\nNomor: ${BotNumber}\nKode: *${formattedCode}*\n\nKode berlaku 30 detik!` 
            });
          }
        }
      }
    });

    newSock.ev.on("creds.update", saveCreds);
    return newSock;
  } catch (error) {
    console.error("Error connecting:", error);
    if (jid) {
      await sock.sendMessage(jid, { text: `❌ Error: ${error.message}` });
    }
  }
}

// === FUNGSI CECAN ===
const CECAN_URLS = {
  "indonesia": "https://widipe.com/indonesia",
  "china": "https://widipe.com/china",
  "thailand": "https://widipe.com/thailand",
  "vietnam": "https://widipe.com/vietnam",
  "waifu": "https://widipe.com/waifu",
  "neko": "https://widipe.com/neko",
  "shinobu": "https://widipe.com/shinobu",
  "hubble": "https://widipe.com/hubbleimg",
  "malaysia": "https://widipe.com/malaysia",
  "japan": "https://widipe.com/japan",
  "korea": "https://widipe.com/korea"
};

async function cecanImage(query) {
  try {
    const response = await axios.get(CECAN_URLS[query], { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (error) {
    return null;
  }
}

// === FUNGSI BRAT ===
async function bratImage(text) {
  try {
    const url = `https://api.botcahx.eu.org/api/maker/brat?text=${encodeURIComponent(text)}&apikey=moire`;
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (error) {
    return null;
  }
}

// === FUNGSI REMOVE BG ===
async function removeBackground(imageBuffer) {
  try {
    const apiKey = process.env.RMBG_API;
    if (!apiKey) throw new Error('API key tidak ditemukan');

    const formData = new FormData();
    formData.append('image_file', imageBuffer, { filename: 'image.jpg' });

    const response = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
      headers: {
        'X-API-Key': apiKey,
        ...formData.getHeaders()
      },
      responseType: 'arraybuffer'
    });

    return Buffer.from(response.data);
  } catch (error) {
    throw error;
  }
}

// === MENU UTAMA ===
async function sendMenu(sock, jid) {
  const teks = `
◊ ┌─────────────────────────
◊ ├─❖─ XIS CORE SYSTEMS
◊ ├─❖─ Automated Platform
◊ └─────────────────────────

⇴ ┌─────────────────────────
⇴ ├─▰─ Pairing System
⇴ ├─▰─ Owner Access
⇴ │├─ .pair <nomor> - Pairing WhatsApp
⇴ │├─ .restart - Restart bot
⇴ │└─ .listsender - List sender aktif
⇴ └─────────────────────────

⤶ ┌─────────────────────────
⤶ ├─◑─ Media & Fun
⤶ ├─◑─ User Access
⤶ │├─ .cecan <query> - Foto cecan
⤶ │├─ .brat <teks> - Gambar teks
⤶ │├─ .rmbg - Hapus background
⤶ │├─ .tiktok <url> - Download TikTok
⤶ │├─ .b - Buka view once
⤶ │└─ .iqc - Fake iMessage
⤶ └─────────────────────────

⟰ ┌─────────────────────────
⟰ ├─▤─ Utility
⟰ ├─▤─ All Users
⟰ │├─ .menu - Tampilkan menu
⟰ │├─ .ping - Cek status bot
⟰ │└─ .info - Info bot
⟰ └─────────────────────────

◉ Platform: WhatsApp × Telegram
◉ Author: s' 小舞 Ga  
◉ Version: Case-Plugins
◉ Server: Asia/Jakarta
        `.trim();
        
  await sock.sendMessage(jid, { text: teks });
}

// === HANDLER PESAN UTAMA ===
async function messageHandler(sock, m) {
  try {
    const jid = m.key.remoteJid;
    const bodyRaw = getText(m);
    const body = bodyRaw.trim();
    const lower = body.toLowerCase();

    // Auto Reaction untuk status
    if (jid.endsWith("@status")) {
      const emoji = statusReactions[Math.floor(Math.random() * statusReactions.length)];
      try {
        await sock.sendMessage(jid, { react: { text: emoji, key: m.key } });
      } catch {}
      return;
    }

    // 📋 MENU
    if (body === `${prefix}menu` || body === `${prefix}help`) {
      await sendMenu(sock, jid);
      return;
    }

    // 🎵 TIKTOK
    if (lower.startsWith(`${prefix}tiktok`)) {
      const args = body.split(" ");
      if (args.length < 2) return sock.sendMessage(jid, { text: "⚠️ Kirim link TikTok!\nContoh: .tiktok https://vt.tiktok.com/xxxx" });
      const url = args[1];
      await sock.sendMessage(jid, { text: "⏳ Mengunduh video..." });
      try {
        const res = await axios.get(`https://api.dreaded.site/api/download/tiktok?url=${encodeURIComponent(url)}`);
        const videoUrl = res.data.result?.video_no_watermark;
        const vid = (await axios.get(videoUrl, { responseType: "arraybuffer" })).data;
        await sock.sendMessage(jid, { video: Buffer.from(vid), caption: `🎵 TikTok Downloader\n${url}` });
      } catch {
        await sock.sendMessage(jid, { text: "❌ Gagal unduh video." });
      }
      return;
    }

    // 🔍 .b buka view-once
    if (lower === `${prefix}b`) {
      const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quoted) return sock.sendMessage(jid, { text: "⚠️ Balas foto/video 1x lihat dengan .b" });
      try {
        const v = quoted.viewOnceMessageV2 || quoted.viewOnceMessage || quoted;
        if (v?.message?.imageMessage) {
          const buf = await downloadMedia(sock, { message: { imageMessage: v.message.imageMessage } });
          await sock.sendMessage(jid, { image: buf, caption: "📸 Foto 1x lihat dibuka!" });
        } else if (v?.message?.videoMessage) {
          const buf = await downloadMedia(sock, { message: { videoMessage: v.message.videoMessage } });
          await sock.sendMessage(jid, { video: buf, caption: "🎥 Video 1x lihat dibuka!" });
        } else sock.sendMessage(jid, { text: "⚠️ Tidak ditemukan media." });
      } catch {
        sock.sendMessage(jid, { text: "❌ Gagal membuka pesan." });
      }
      return;
    }

    // 💬 IQC
    if (lower.startsWith(`${prefix}iqc`)) {
      const parts = body.slice(4).split(",");
      if (parts.length < 4)
        return sock.sendMessage(jid, { text: "⚠️ Format: .iqc jam,batre,provider,pesan\nContoh: .iqc 18:00,70,Telkomsel,Halo!" });
      const [time, battery, carrier, ...msgParts] = parts;
      const msg = msgParts.join(" ");
      const api = `https://brat.siputzx.my.id/iphone-quoted?time=${time}&batteryPercentage=${battery}&carrierName=${carrier}&messageText=${encodeURIComponent(msg)}&emojiStyle=apple`;
      try {
        const res = await axios.get(api, { responseType: "arraybuffer" });
        await sock.sendMessage(jid, { image: Buffer.from(res.data), caption: `📱 IQC\n🕒 ${time}\n🔋 ${battery}% | ${carrier}\n💬 ${msg}` });
      } catch {
        sock.sendMessage(jid, { text: "❌ Gagal membuat gambar IQC." });
      }
      return;
    }

    // 👩 CECAN
    if (lower.startsWith(`${prefix}cecan`)) {
      const query = body.split(' ')[1] || 'indonesia';
      const validQueries = Object.keys(CECAN_URLS).join(', ');
      
      if (!CECAN_URLS[query]) {
        return sock.sendMessage(jid, { text: `❌ Query tidak valid!\n\nQuery yang tersedia:\n${validQueries}` });
      }

      await sock.sendMessage(jid, { text: `🔄 Mengambil foto cecan ${query}...` });
      const imageBuffer = await cecanImage(query);
      
      if (imageBuffer) {
        await sock.sendMessage(jid, { 
          image: imageBuffer, 
          caption: `👩 Cecan ${query}\n📸 Powered by XIS Core Systems` 
        });
      } else {
        await sock.sendMessage(jid, { text: '❌ Gagal mengambil gambar.' });
      }
      return;
    }

    // 🎨 BRAT
    if (lower.startsWith(`${prefix}brat`)) {
      const text = body.split(' ').slice(1).join(' ');
      if (!text) return sock.sendMessage(jid, { text: '⚠️ Format: .brat <teks>' });
      
      await sock.sendMessage(jid, { text: '🔄 Membuat gambar...' });
      const imageBuffer = await bratImage(text);
      
      if (imageBuffer) {
        await sock.sendMessage(jid, { 
          image: imageBuffer, 
          caption: `🎨 ${text}\n✨ Powered by XIS Core Systems` 
        });
      } else {
        await sock.sendMessage(jid, { text: '❌ Gagal membuat gambar.' });
      }
      return;
    }

    // 🖼️ REMOVE BG
    if (lower === `${prefix}rmbg`) {
      const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quoted) return sock.sendMessage(jid, { text: '⚠️ Balas gambar dengan perintah .rmbg' });
      if (!quoted.imageMessage) return sock.sendMessage(jid, { text: '❌ Hanya support gambar.' });

      await sock.sendMessage(jid, { text: '🔄 Menghapus background...' });
      try {
        const buffer = await downloadMedia(sock, { message: { imageMessage: quoted.imageMessage } });
        const resultBuffer = await removeBackground(buffer);
        await sock.sendMessage(jid, { 
          image: resultBuffer, 
          caption: '🖼️ Background removed\n✨ Powered by XIS Core Systems' 
        });
      } catch (error) {
        await sock.sendMessage(jid, { text: `❌ Gagal menghapus background: ${error.message}` });
      }
      return;
    }

    // 📱 PAIRING SYSTEM
    if (lower.startsWith(`${prefix}pair`)) {
      const args = body.split(' ');
      if (args.length < 2) {
        return sock.sendMessage(jid, { text: '⚠️ Format: .pair <nomor>\nContoh: .pair 628123456789' });
      }
      
      const number = args[1];
      if (!isValidPhoneNumber(number)) {
        return sock.sendMessage(jid, { text: '❌ Format nomor tidak valid!\nGunakan: 628xxxx (Indonesia)' });
      }

      await sock.sendMessage(jid, { text: `📱 Memulai pairing untuk ${number}...` });
      await connectToWhatsApp(number, jid);
      return;
    }

    // 🔁 RESTART
    if (lower === `${prefix}restart`) {
      await sock.sendMessage(jid, { text: '🔄 Restarting bot...' });
      if (currentNumber) {
        await connectToWhatsApp(currentNumber, jid);
      }
      return;
    }

    // 📃 LIST SENDER
    if (lower === `${prefix}listsender`) {
      if (activeSessions.size === 0) {
        return sock.sendMessage(jid, { text: '📭 Tidak ada sender aktif.' });
      }
      
      const list = Array.from(activeSessions.keys()).map(n => `• ${n}`).join('\n');
      await sock.sendMessage(jid, { text: `📱 Sender Aktif:\n${list}` });
      return;
    }

    // 🏓 PING
    if (lower === `${prefix}ping`) {
      const start = Date.now();
      await sock.sendMessage(jid, { text: '🏓 Pong!' });
      const end = Date.now();
      await sock.sendMessage(jid, { text: `⏱️ Speed: ${end - start}ms` });
      return;
    }

    // ℹ️ INFO
    if (lower === `${prefix}info`) {
      const infoText = `
🤖 *XIS CORE SYSTEMS*

📱 Platform: WhatsApp Bot
👨‍💻 Author: s' 小舞 Ga
🔧 Version: Case-Plugins
🌐 Server: Asia/Jakarta
📅 Mode: Multi-Device

💬 Fitur:
• Pairing System
• Media Downloader
• Image Manipulation
• Auto Reaction
• Dan banyak lagi!

🔗 GitHub: https://github.com/your-repo
      `.trim();
      await sock.sendMessage(jid, { text: infoText });
      return;
    }

    // 🔁 Auto Reply
    if (autoReplies[lower]) {
      await sock.sendMessage(jid, { text: autoReplies[lower] });
    }

    // 💬 Auto Reaction Chat
    for (const [k, emoji] of Object.entries(chatReactions)) {
      if (lower.includes(k)) {
        await sock.sendMessage(jid, { react: { text: emoji, key: m.key } });
        break;
      }
    }

  } catch (err) {
    console.error("Handler error:", err);
  }
}

// === INISIALISASI BOT ===
async function initializeBot() {
  try {
    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }

    // Cari session yang sudah ada
    const folders = fs.readdirSync(sessionsDir);
    for (const folder of folders) {
      if (folder.startsWith('device')) {
        const number = folder.replace('device', '');
        const credsPath = path.join(sessionsDir, folder, 'creds.json');
        if (fs.existsSync(credsPath)) {
          console.log(chalk.green(`📱 Found session for ${number}, connecting...`));
          await connectToWhatsApp(number, null);
          break;
        }
      }
    }
  } catch (error) {
    console.error('❌ Initialize bot error:', error);
  }
}

module.exports = { 
  showBanner, 
  messageHandler, 
  initializeBot,
  connectToWhatsApp 
};