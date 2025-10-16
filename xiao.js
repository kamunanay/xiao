// xiao.js
const axios = require("axios");

const { prefix, botName } = require("./setting");

// ==========================
// 🔹 Auto Reply & Reaction DB
// ==========================
const autoReplies = {
  "halo": "Hai juga 👋 Apa kabar?",
  "hallo": "Hallo juga! 😄",
  "hai": "Hai juga 😊",
  "assalamualaikum": "Waalaikumussalam 🤲 Semoga harimu berkah!",
  "pagi": "Selamat pagi ☀️ Semangat beraktivitas!",
  "siang": "Selamat siang 🌞 Jangan lupa makan siang!",
  "sore": "Selamat sore 🌇",
  "malam": "Selamat malam 🌙 Waktunya istirahat 😴",
  "thanks": "Sama-sama 🙏 Senang bisa bantu!",
  "makasih": "Sama-sama 😄",
  "terimakasih": "Sama-sama 🙏",
  "bot": "Ya, aku bot WhatsApp 🤖 Siap bantu!",
  "test": "Bot aktif dan siap tempur ✅",
  "lagi apa": "Lagi standby di server 💻",
  "dimana": "Lagi di awan ☁️ alias cloud server 😎",
  "capek": "Istirahat dulu ya 😌☕",
  "lapar": "Makan dulu dong 🍛",
  "ngantuk": "Tidur bentar gapapa 😴",
  "kenapa": "Gak kenapa-napa, kamu kenapa? 🤔",
  "wkwk": "Haha lucu juga 🤣",
  "mantap": "Mantap banget 🔥🔥🔥",
  "semangat": "Semangat terus 💪🔥",
  "bismillah": "Bismillah, semoga lancar 🙏",
  "amin": "Aamiin 🤲",
  "alhamdulillah": "Alhamdulillah 😇",
  "astaga": "Astaga 😳",
  "apa kabar": "Baik nih 😄 Kamu gimana?",
  "santai": "Santai dulu 😌☕",
  "gas": "Gas terus ⚡🔥"
};

const chatReactions = {
  "mantap": "🔥",
  "anjay": "🤯",
  "keren": "😎",
  "ok": "👌",
  "sip": "👍",
  "nice": "💯",
  "wow": "😲",
  "haha": "😂",
  "wkwk": "🤣",
  "love": "❤️",
  "gacor": "🕊️",
  "amazing": "✨",
  "semangat": "💪",
  "capek": "😩",
  "sedih": "😢",
  "baper": "🥺",
  "santai": "😌",
  "bismillah": "🤲",
  "alhamdulillah": "🙏",
  "astaga": "😳",
  "anjir": "🤣",
  "gila": "🤪",
  "bagus": "👏",
  "parah": "😱"
};

const statusReactions = [
  "❤️","🔥","😂","🤣","😍","😮","👍","😎","🙏","✨","💯",
  "🥰","🤯","😭","😆","😌","🤩","🤔","🙌","💪","🌟","😜","😇","🎉","😢"
];

// ==========================
// 🔹 Helper: extract text from message
// ==========================
function getTextFromMessage(m) {
  if (!m) return "";
  if (m.message?.conversation) return m.message.conversation;
  if (m.message?.extendedTextMessage?.text) return m.message.extendedTextMessage.text;
  if (m.message?.imageMessage?.caption) return m.message.imageMessage.caption;
  if (m.message?.videoMessage?.caption) return m.message.videoMessage.caption;
  return "";
}

// ==========================
// 🔹 Message Handler
// ==========================
async function messageHandler(sock, m) {
  try {
    const jid = m.key.remoteJid;
    const fromStatus = jid && jid.endsWith("@status");
    const bodyRaw = getTextFromMessage(m) || "";
    const body = bodyRaw.trim();
    if (!body && !fromStatus) return;

    // Reaction to status (random)
    if (fromStatus) {
      try {
        const emoji = statusReactions[Math.floor(Math.random() * statusReactions.length)];
        await sock.sendMessage(jid, { react: { text: emoji, key: m.key } });
        console.log("Reacted to status:", emoji);
      } catch (e) {
        console.warn("Error react status:", e?.message || e);
      }
      return;
    }

    // Menu
    if (body === `${prefix}menu`) {
      const menuText = `
┏━🔥 *${botName.toUpperCase()}* 🔥━┓
┃ 🤖 Bot WhatsApp (Termux Ready)
┃ 📌 Prefix: ${prefix}
┃
┃ Commands:
┃ ${prefix}menu - Tampilkan menu
┃ ${prefix}tiktok <url> - Download video TikTok
┗━━━━━━━━━━━━━━━━━━━━┛
`;
      await sock.sendMessage(jid, { text: menuText });
      return;
    }

    // TikTok downloader
    if (body.startsWith(`${prefix}tiktok`)) {
      const parts = body.split(" ").filter(Boolean);
      if (parts.length < 2) {
        await sock.sendMessage(jid, { text: "⚠️ Masukkan link TikTok!\nContoh: .tiktok https://vt.tiktok.com/xxxx/" });
        return;
      }
      const url = parts[1];
      await sock.sendMessage(jid, { text: "⏳ Sedang mengunduh, tunggu sebentar..." });

      try {
        // API yang digunakan: iceflow (sama seperti di file awal). Bisa diganti kalo perlu.
        const api = `https://iceflow.biz.id/downloader/tiktok?apikey=%40notsuspend.21&url=${encodeURIComponent(url)}`;
        const apiRes = await axios.get(api, { timeout: 20000 });

        if (!apiRes.data?.status) {
          await sock.sendMessage(jid, { text: "❌ Gagal mengambil data TikTok dari API. Coba lagi atau pakai link lain." });
          return;
        }

        const result = apiRes.data.result;
        const videoUrl = result.video?.noWatermark || result.video?.standard || result.video?.high || result.video?.watermark;
        const title = (result.title || "video").replace(/[\x00-\x1F\x7F<>:"/\\|?*]+/g, "").slice(0, 64) || "tiktok";
        const author = result.author || "unknown";

        if (!videoUrl) {
          await sock.sendMessage(jid, { text: "❌ Tidak menemukan file video di API." });
          return;
        }

        // Download video as arraybuffer (binary)
        const vidRes = await axios.get(videoUrl, {
          responseType: "arraybuffer",
          timeout: 60000,
          headers: {
            // kadang perlu user-agent
            "User-Agent": "okhttp/4.9.0"
          }
        });

        const videoBuffer = Buffer.from(vidRes.data);

        // Try send as video. If too big or fails, send as document fallback.
        try {
          await sock.sendMessage(jid, {
            video: videoBuffer,
            caption: `🎵 ${title}\n👤 ${author}\n🔗 ${url}`,
            mimetype: "video/mp4",
            fileName: `${title}.mp4`
          });
        } catch (err) {
          console.warn("Send as video failed, sending as document fallback:", err?.message || err);
          await sock.sendMessage(jid, {
            document: videoBuffer,
            mimetype: "video/mp4",
            fileName: `${title}.mp4`,
            caption: `🎵 ${title}\n👤 ${author}\n🔗 ${url}`
          });
        }
      } catch (e) {
        console.error("Error tiktok download:", e?.message || e);
        await sock.sendMessage(jid, { text: "⚠️ Terjadi kesalahan saat mengunduh atau mengirim video. Coba lagi nanti." });
      }
      return;
    }

    // Auto reply exact
    const lower = body.toLowerCase();
    if (autoReplies[lower]) {
      await sock.sendMessage(jid, { text: autoReplies[lower] });
      return;
    }

    // Reaction in chat based on keywords (first match)
    for (let keyword in chatReactions) {
      if (lower.includes(keyword)) {
        try {
          await sock.sendMessage(jid, { react: { text: chatReactions[keyword], key: m.key } });
        } catch (e) {
          console.warn("React failed:", e?.message || e);
        }
        break;
      }
    }

  } catch (err) {
    console.error("Message handler error:", err?.message || err);
  }
}

module.exports = { messageHandler };