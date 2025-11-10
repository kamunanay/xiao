const { 
    default: makeWASocket, 
    useMultiFileAuthState,
    delay,
    Browsers
} = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const axios = require('axios');
const qrcode = require('qrcode-terminal');

// Import settings
const { prefix, botName, ownerNumber, autoReplies, chatReactions, statusReactions } = require('./setting');

// Global variables
let sock = null;
const sessionsDir = './sessions';

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
    `.trim();
    
    console.clear();
    console.log(banner);
    console.log(`🚀 ${botName} aktif! Ketik ${prefix}menu di WhatsApp`);
}

// === UTILITY FUNCTIONS ===
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
    try {
        const stream = await sock.downloadMediaMessage(msg);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        return buffer;
    } catch (error) {
        throw error;
    }
}

// === SIMPLE WHATSAPP CONNECTION ===
async function connectToWhatsApp() {
    return new Promise(async (resolve, reject) => {
        try {
            const sessionPath = path.join(sessionsDir, 'session');
            if (!fs.existsSync(sessionPath)) {
                fs.mkdirSync(sessionPath, { recursive: true });
            }

            const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

            const newSock = makeWASocket({
                auth: state,
                logger: pino({ level: 'silent' }),
                browser: Browsers.ubuntu('Chrome'),
                markOnlineOnConnect: true,
            });

            let qrDisplayed = false;

            // Event handlers
            newSock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                
                if (qr && !qrDisplayed) {
                    qrDisplayed = true;
                    console.log('\n📱 SCAN QR CODE INI UNTUK LOGIN:');
                    console.log('══════════════════════════════════════');
                    qrcode.generate(qr, { small: true });
                    console.log('══════════════════════════════════════');
                    console.log('💡 Cara login:');
                    console.log('1. Buka WhatsApp → Settings → Linked Devices');
                    console.log('2. Pilih "Link a Device"');
                    console.log('3. Scan QR code di atas');
                    console.log('══════════════════════════════════════\n');
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    console.log('❌ Connection closed, reconnecting...');
                    
                    if (statusCode !== 401) {
                        await delay(3000);
                        connectToWhatsApp().then(resolve).catch(reject);
                    } else {
                        console.log('❌ Session expired, please scan QR again');
                        // Remove expired session
                        if (fs.existsSync(sessionPath)) {
                            fs.rmSync(sessionPath, { recursive: true, force: true });
                        }
                        await delay(2000);
                        connectToWhatsApp().then(resolve).catch(reject);
                    }
                } 
                else if (connection === 'open') {
                    console.log('\n✅ BERHASIL TERHUBUNG KE WHATSAPP!');
                    sock = newSock;
                    
                    // Get the connected phone number
                    const user = newSock.user;
                    const connectedNumber = user?.id?.split(':')[0] || 'Unknown';
                    
                    console.log(`📱 Terhubung sebagai: ${connectedNumber}`);
                    
                    // Kirim pesan ke owner
                    try {
                        await newSock.sendMessage(`${ownerNumber}@s.whatsapp.net`, {
                            text: `🤖 *${botName} BERHASIL AKTIF!*\n\n📱 Nomor: ${connectedNumber}\n✅ Status: Connected\n\nKetik ${prefix}menu untuk melihat commands.`
                        });
                    } catch (e) {
                        console.log('⚠️ Tidak bisa kirim pesan ke owner');
                    }
                    
                    resolve(newSock);
                }
            });

            newSock.ev.on('creds.update', saveCreds);
            
            // Handle messages
            newSock.ev.on('messages.upsert', async (m) => {
                await messageHandler(newSock, m);
            });

        } catch (error) {
            console.log('❌ Connection error:', error);
            reject(error);
        }
    });
}

// === CECAN FUNCTION ===
const CECAN_URLS = {
    "indonesia": "https://api.lolhuman.xyz/api/random/cecanindonesia?apikey=dannlaina",
    "china": "https://api.lolhuman.xyz/api/random/cecanchina?apikey=dannlaina", 
    "thailand": "https://api.lolhuman.xyz/api/random/cecanthailand?apikey=dannlaina",
    "vietnam": "https://api.lolhuman.xyz/api/random/cecanvietnam?apikey=dannlaina",
    "malaysia": "https://api.lolhuman.xyz/api/random/cecanmalaysia?apikey=dannlaina",
    "japan": "https://api.lolhuman.xyz/api/random/cecanjapan?apikey=dannlaina",
    "korea": "https://api.lolhuman.xyz/api/random/cecankorea?apikey=dannlaina"
};

async function getCecanImage(query) {
    try {
        const url = CECAN_URLS[query];
        if (!url) return null;

        const response = await axios.get(url, { 
            responseType: 'arraybuffer',
            timeout: 30000 
        });
        
        return Buffer.from(response.data);
    } catch (error) {
        console.log('Cecan error:', error.message);
        return null;
    }
}

// === BRAT FUNCTION ===
async function getBratImage(text) {
    try {
        const response = await axios.get(
            `https://api.botcahx.eu.org/api/maker/brat?text=${encodeURIComponent(text)}&apikey=moire`,
            { responseType: 'arraybuffer' }
        );
        return Buffer.from(response.data);
    } catch (error) {
        console.log('Brat error:', error.message);
        return null;
    }
}

// === TIKTOK DOWNLOADER ===
async function downloadTiktok(url) {
    try {
        const response = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`);
        return response.data;
    } catch (error) {
        throw new Error('Gagal mengunduh video TikTok');
    }
}

// === MENU HANDLER ===
async function sendMenu(sock, jid) {
    const menuText = `
◊ ┌─────────────────────────
◊ ├─❖─ XIS CORE SYSTEMS
◊ ├─❖─ Automated Platform  
◊ └─────────────────────────

⇴ ┌─────────────────────────
⇴ ├─▰─ Media & Fun
⇴ ├─▰─ User Access
⇴ │├─ ${prefix}cecan <query> - Foto cecan
⇴ │├─ ${prefix}brat <teks> - Gambar teks
⇴ │├─ ${prefix}tiktok <url> - Download TikTok
⇴ │├─ ${prefix}b - Buka view once
⇴ │└─ ${prefix}iqc - Fake iMessage
⇴ └─────────────────────────

⟰ ┌─────────────────────────
⟰ ├─▤─ Utility
⟰ ├─▤─ All Users
⟰ │├─ ${prefix}menu - Menu bot
⟰ │├─ ${prefix}ping - Cek status
⟰ │├─ ${prefix}info - Info bot
⟰ │└─ ${prefix}owner - Kontak owner
⟰ └─────────────────────────

📌 Query cecan: indonesia, china, thailand, vietnam, malaysia, japan, korea

◉ Platform: WhatsApp Multi-Device
◉ Author: s' 小舞 Ga  
◉ Version: 2025.1.0
◉ Server: Asia/Jakarta
    `.trim();

    await sock.sendMessage(jid, { text: menuText });
}

// === MAIN MESSAGE HANDLER ===
async function messageHandler(sock, m) {
    try {
        if (m.messages && m.messages[0]) {
            const message = m.messages[0];
            const jid = message.key.remoteJid;
            const body = getText(message);
            const lowerBody = body.toLowerCase();

            // Ignore status updates and group notifications
            if (jid === 'status@broadcast' || !body || message.key.fromMe) return;

            console.log(`[PESAN] dari ${jid}: ${body}`);

            // Handle commands
            if (body.startsWith(prefix)) {
                const command = body.slice(prefix.length).split(' ')[0].toLowerCase();
                const args = body.slice(prefix.length + command.length).trim();

                // 🎯 MENU COMMAND
                if (command === 'menu' || command === 'help') {
                    await sendMenu(sock, jid);
                    return;
                }

                // 🏓 PING COMMAND
                if (command === 'ping') {
                    const start = Date.now();
                    await sock.sendMessage(jid, { text: '🏓 Pong!' });
                    const latency = Date.now() - start;
                    await sock.sendMessage(jid, { text: `⚡ Latency: ${latency}ms` });
                    return;
                }

                // ℹ️ INFO COMMAND
                if (command === 'info') {
                    const infoText = `
🤖 *XIS CORE SYSTEMS*

📱 Platform: WhatsApp Bot MD
👨‍💻 Developer: 小舞 Ga
🔧 Version: 2025.1.0
🌐 Server: Asia/Jakarta

✨ Features:
• QR Code Login System
• Media Downloader  
• Image Manipulation
• Auto Reaction
• Multi-Device Support

🔗 Powered by Baileys
                    `.trim();
                    await sock.sendMessage(jid, { text: infoText });
                    return;
                }

                // 👨 OWNER COMMAND
                if (command === 'owner') {
                    await sock.sendMessage(jid, { 
                        text: `👑 Owner Bot:\n${ownerNumber}\n\nHubungi untuk kerjasama atau masalah bot.` 
                    });
                    return;
                }

                // 👩 CECAN COMMAND
                if (command === 'cecan') {
                    const query = args || 'indonesia';
                    const validQueries = Object.keys(CECAN_URLS).join(', ');
                    
                    if (!CECAN_URLS[query]) {
                        await sock.sendMessage(jid, { 
                            text: `❌ Query "${query}" tidak valid!\n\nQuery tersedia: ${validQueries}` 
                        });
                        return;
                    }

                    await sock.sendMessage(jid, { text: `🔄 Mengambil foto cecan ${query}...` });
                    const imageBuffer = await getCecanImage(query);
                    
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

                // 🎨 BRAT COMMAND
                if (command === 'brat') {
                    if (!args) {
                        await sock.sendMessage(jid, { text: '❌ Format: .brat <teks>' });
                        return;
                    }

                    await sock.sendMessage(jid, { text: '🔄 Membuat gambar...' });
                    const imageBuffer = await getBratImage(args);
                    
                    if (imageBuffer) {
                        await sock.sendMessage(jid, { 
                            image: imageBuffer,
                            caption: `🎨 "${args}"\n✨ Powered by XIS Core Systems`
                        });
                    } else {
                        await sock.sendMessage(jid, { text: '❌ Gagal membuat gambar.' });
                    }
                    return;
                }

                // 🎵 TIKTOK COMMAND
                if (command === 'tiktok') {
                    if (!args) {
                        await sock.sendMessage(jid, { text: '❌ Format: .tiktok <url>' });
                        return;
                    }

                    await sock.sendMessage(jid, { text: '⏳ Mengunduh video TikTok...' });
                    
                    try {
                        const data = await downloadTiktok(args);
                        const videoUrl = data.video || data.play;
                        
                        if (videoUrl) {
                            const videoResponse = await axios.get(videoUrl, { responseType: 'arraybuffer' });
                            await sock.sendMessage(jid, { 
                                video: Buffer.from(videoResponse.data),
                                caption: `🎵 ${data.title || 'TikTok Video'}\n👤 ${data.author || ''}`
                            });
                        } else {
                            await sock.sendMessage(jid, { text: '❌ Gagal mengunduh video.' });
                        }
                    } catch (error) {
                        await sock.sendMessage(jid, { text: '❌ Gagal mengunduh video TikTok.' });
                    }
                    return;
                }

                // 🔍 VIEW ONCE COMMAND
                if (command === 'b') {
                    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                    
                    if (!quoted) {
                        await sock.sendMessage(jid, { text: '❌ Balas pesan view once dengan .b' });
                        return;
                    }

                    try {
                        const viewOnce = quoted.viewOnceMessageV2 || quoted.viewOnceMessage;
                        
                        if (viewOnce?.message?.imageMessage) {
                            const buffer = await downloadMedia(sock, { 
                                message: { imageMessage: viewOnce.message.imageMessage } 
                            });
                            await sock.sendMessage(jid, { 
                                image: buffer, 
                                caption: '📸 Foto view once' 
                            });
                        } else if (viewOnce?.message?.videoMessage) {
                            const buffer = await downloadMedia(sock, { 
                                message: { videoMessage: viewOnce.message.videoMessage } 
                            });
                            await sock.sendMessage(jid, { 
                                video: buffer, 
                                caption: '🎥 Video view once' 
                            });
                        } else {
                            await sock.sendMessage(jid, { text: '❌ Bukan pesan view once.' });
                        }
                    } catch (error) {
                        await sock.sendMessage(jid, { text: '❌ Gagal membuka pesan view once.' });
                    }
                    return;
                }

                // 📱 IQC COMMAND
                if (command === 'iqc') {
                    const parts = args.split(',');
                    if (parts.length < 4) {
                        await sock.sendMessage(jid, { 
                            text: '❌ Format: .iqc jam,batre,provider,pesan\nContoh: .iqc 18:00,70,Telkomsel,Halo!' 
                        });
                        return;
                    }

                    const [time, battery, carrier, ...messageParts] = parts;
                    const messageText = messageParts.join(',');
                    
                    try {
                        const apiUrl = `https://brat.siputzx.my.id/iphone-quoted?time=${time}&batteryPercentage=${battery}&carrierName=${carrier}&messageText=${encodeURIComponent(messageText)}&emojiStyle=apple`;
                        const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
                        
                        await sock.sendMessage(jid, { 
                            image: Buffer.from(response.data),
                            caption: `📱 Fake iMessage\n⏰ ${time} | 🔋 ${battery}% | 📶 ${carrier}`
                        });
                    } catch (error) {
                        await sock.sendMessage(jid, { text: '❌ Gagal membuat gambar iMessage.' });
                    }
                    return;
                }

                // Command not found
                await sock.sendMessage(jid, { 
                    text: `❌ Command "${command}" tidak dikenali.\nKetik ${prefix}menu untuk melihat daftar command.` 
                });
            }

            // Auto replies
            if (autoReplies[lowerBody]) {
                await sock.sendMessage(jid, { text: autoReplies[lowerBody] });
            }

            // Auto reactions
            for (const [keyword, emoji] of Object.entries(chatReactions)) {
                if (lowerBody.includes(keyword)) {
                    await sock.sendMessage(jid, { 
                        react: { text: emoji, key: message.key } 
                    });
                    break;
                }
            }
        }
    } catch (error) {
        console.log('Handler error:', error);
    }
}

// === INITIALIZE BOT ===
async function initialize() {
    try {
        showBanner();
        
        // Create necessary directories
        if (!fs.existsSync(sessionsDir)) {
            fs.mkdirSync(sessionsDir, { recursive: true });
        }

        console.log('🚀 Starting XIS CORE SYSTEMS...');
        console.log('🔄 Connecting to WhatsApp...\n');
        
        // Connect to WhatsApp
        await connectToWhatsApp();
        
        console.log('✅ Bot berhasil diinisialisasi!');
        
    } catch (error) {
        console.log('❌ Gagal memulai bot:', error);
        process.exit(1);
    }
}

module.exports = {
    initialize,
    messageHandler
};