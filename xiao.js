const { 
    default: makeWASocket, 
    useMultiFileAuthState,
    delay 
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
let isConnected = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 3;
const sessionsDir = './sessions';

// === SIMPLE BANNER ===
function showBanner() {
    console.log(`
╔══════════════════════════════════════╗
║           XIS CORE SYSTEMS           ║
║           WhatsApp Bot MD            ║
║              by 小舞 Ga              ║
╚══════════════════════════════════════╝
    `.trim());
    console.log(`🚀 ${botName} aktif! Ketik ${prefix}menu di WhatsApp\n`);
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

// === STABLE WHATSAPP CONNECTION ===
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
                logger: pino({ level: 'fatal' }),
                printQRInTerminal: false,
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 0,
                keepAliveIntervalMs: 10000,
            });

            let qrGenerated = false;

            newSock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                // Handle QR Code
                if (qr && !qrGenerated) {
                    qrGenerated = true;
                    console.log('\n📱 SCAN QR CODE INI:');
                    console.log('══════════════════════════════════════');
                    qrcode.generate(qr, { small: true });
                    console.log('══════════════════════════════════════');
                    console.log('📲 Buka WhatsApp → Settings → Linked Devices');
                    console.log('📲 Pilih "Link a Device"');
                    console.log('📷 Scan QR code di atas');
                    console.log('══════════════════════════════════════\n');
                }

                // Handle connection open
                if (connection === 'open') {
                    isConnected = true;
                    reconnectAttempts = 0;
                    sock = newSock;
                    
                    const user = newSock.user;
                    const connectedNumber = user?.id?.split(':')[0] || 'Unknown';
                    
                    console.log(`\n✅ BERHASIL TERHUBUNG KE WHATSAPP!`);
                    console.log(`📱 Nomor: ${connectedNumber}`);
                    console.log('🤖 Bot siap menerima perintah!\n');
                    
                    // Kirim pesan ke owner
                    try {
                        await newSock.sendMessage(`${ownerNumber}@s.whatsapp.net`, {
                            text: `🤖 *${botName} AKTIF!*\n\nTerhubung sebagai: ${connectedNumber}\nKetik ${prefix}menu untuk melihat commands`
                        });
                    } catch (e) {
                        // Skip jika tidak bisa kirim pesan
                    }
                    
                    resolve(newSock);
                }

                // Handle connection close
                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    
                    if (isConnected) {
                        console.log('❌ Koneksi terputus...');
                        isConnected = false;
                    }

                    // Jangan reconnect jika session expired (401)
                    if (statusCode === 401) {
                        console.log('🔑 Session expired, perlu login ulang');
                        // Hapus session yang expired
                        if (fs.existsSync(sessionPath)) {
                            fs.rmSync(sessionPath, { recursive: true, force: true });
                        }
                        reject(new Error('Session expired'));
                        return;
                    }

                    // Coba reconnect dengan limit
                    if (reconnectAttempts < maxReconnectAttempts) {
                        reconnectAttempts++;
                        console.log(`🔄 Mencoba reconnect... (${reconnectAttempts}/${maxReconnectAttempts})`);
                        await delay(5000); // Tunggu 5 detik sebelum reconnect
                        connectToWhatsApp().then(resolve).catch(reject);
                    } else {
                        console.log('❌ Gagal reconnect setelah beberapa percobaan');
                        console.log('💡 Silakan restart bot manual');
                        reject(new Error('Max reconnect attempts reached'));
                    }
                }
            });

            newSock.ev.on('creds.update', saveCreds);
            
            // Handle messages
            newSock.ev.on('messages.upsert', async (m) => {
                await messageHandler(newSock, m);
            });

        } catch (error) {
            console.log('❌ Connection error:', error.message);
            reject(error);
        }
    });
}

// === SIMPLE CECAN FUNCTION ===
async function getCecanImage(query) {
    try {
        const urls = {
            "indonesia": "https://api.lolhuman.xyz/api/random/cecanindonesia?apikey=dannlaina",
            "china": "https://api.lolhuman.xyz/api/random/cecanchina?apikey=dannlaina", 
            "thailand": "https://api.lolhuman.xyz/api/random/cecanthailand?apikey=dannlaina",
            "vietnam": "https://api.lolhuman.xyz/api/random/cecanvietnam?apikey=dannlaina",
            "malaysia": "https://api.lolhuman.xyz/api/random/cecanmalaysia?apikey=dannlaina",
            "japan": "https://api.lolhuman.xyz/api/random/cecanjapan?apikey=dannlaina",
            "korea": "https://api.lolhuman.xyz/api/random/cecankorea?apikey=dannlaina"
        };

        const url = urls[query];
        if (!url) return null;

        const response = await axios.get(url, { 
            responseType: 'arraybuffer',
            timeout: 10000 
        });
        
        return Buffer.from(response.data);
    } catch (error) {
        return null;
    }
}

// === SIMPLE BRAT FUNCTION ===
async function getBratImage(text) {
    try {
        const response = await axios.get(
            `https://api.botcahx.eu.org/api/maker/brat?text=${encodeURIComponent(text)}&apikey=moire`,
            { responseType: 'arraybuffer', timeout: 10000 }
        );
        return Buffer.from(response.data);
    } catch (error) {
        return null;
    }
}

// === SIMPLE TIKTOK DOWNLOADER ===
async function downloadTiktok(url) {
    try {
        const response = await axios.get(
            `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`,
            { timeout: 15000 }
        );
        return response.data;
    } catch (error) {
        throw new Error('Gagal mengunduh video');
    }
}

// === SIMPLE MENU ===
async function sendMenu(sock, jid) {
    const menuText = `
🤖 *XIS CORE SYSTEMS*

📱 Media Commands:
• ${prefix}cecan <query> - Foto cecan
• ${prefix}brat <teks> - Gambar teks  
• ${prefix}tiktok <url> - Download TikTok
• ${prefix}b - Buka view once
• ${prefix}iqc - Fake iMessage

🔧 Utility:
• ${prefix}menu - Menu bot
• ${prefix}ping - Cek status
• ${prefix}info - Info bot
• ${prefix}owner - Kontak owner

📌 Query cecan: indonesia, china, thailand, vietnam, malaysia, japan, korea
    `.trim();

    await sock.sendMessage(jid, { text: menuText });
}

// === SIMPLE MESSAGE HANDLER ===
async function messageHandler(sock, m) {
    try {
        if (!m.messages || !m.messages[0]) return;

        const message = m.messages[0];
        const jid = message.key.remoteJid;
        const body = getText(message);
        const lowerBody = body.toLowerCase();

        // Skip status and own messages
        if (jid === 'status@broadcast' || !body || message.key.fromMe) return;

        console.log(`💬 ${jid}: ${body}`);

        // Handle commands
        if (body.startsWith(prefix)) {
            const command = body.slice(prefix.length).split(' ')[0].toLowerCase();
            const args = body.slice(prefix.length + command.length).trim();

            switch(command) {
                case 'menu':
                case 'help':
                    await sendMenu(sock, jid);
                    break;

                case 'ping':
                    const start = Date.now();
                    await sock.sendMessage(jid, { text: '🏓 Pong!' });
                    const latency = Date.now() - start;
                    await sock.sendMessage(jid, { text: `⚡ ${latency}ms` });
                    break;

                case 'info':
                    await sock.sendMessage(jid, { 
                        text: `🤖 *${botName}*\n\nWhatsApp Bot Multi-Device\nVersion: 2025.1.0\nAuthor: 小舞 Ga` 
                    });
                    break;

                case 'owner':
                    await sock.sendMessage(jid, { 
                        text: `👑 Owner: ${ownerNumber}\nHubungi untuk bantuan.` 
                    });
                    break;

                case 'cecan':
                    const query = args || 'indonesia';
                    await sock.sendMessage(jid, { text: '🔄 Mengambil gambar...' });
                    const cecanImage = await getCecanImage(query);
                    if (cecanImage) {
                        await sock.sendMessage(jid, { 
                            image: cecanImage,
                            caption: `👩 ${query}`
                        });
                    } else {
                        await sock.sendMessage(jid, { text: '❌ Gagal mengambil gambar' });
                    }
                    break;

                case 'brat':
                    if (!args) {
                        await sock.sendMessage(jid, { text: '❌ Format: .brat <teks>' });
                        break;
                    }
                    await sock.sendMessage(jid, { text: '🔄 Membuat gambar...' });
                    const bratImage = await getBratImage(args);
                    if (bratImage) {
                        await sock.sendMessage(jid, { 
                            image: bratImage,
                            caption: `🎨 ${args}`
                        });
                    } else {
                        await sock.sendMessage(jid, { text: '❌ Gagal membuat gambar' });
                    }
                    break;

                case 'tiktok':
                    if (!args) {
                        await sock.sendMessage(jid, { text: '❌ Format: .tiktok <url>' });
                        break;
                    }
                    await sock.sendMessage(jid, { text: '⏳ Mengunduh...' });
                    try {
                        const data = await downloadTiktok(args);
                        const videoUrl = data.video || data.play;
                        if (videoUrl) {
                            const videoResponse = await axios.get(videoUrl, { responseType: 'arraybuffer' });
                            await sock.sendMessage(jid, { 
                                video: Buffer.from(videoResponse.data),
                                caption: `🎵 TikTok`
                            });
                        } else {
                            await sock.sendMessage(jid, { text: '❌ Gagal unduh video' });
                        }
                    } catch (error) {
                        await sock.sendMessage(jid, { text: '❌ Gagal mengunduh' });
                    }
                    break;

                case 'b':
                    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                    if (!quoted) {
                        await sock.sendMessage(jid, { text: '❌ Balas view once message' });
                        break;
                    }
                    try {
                        const viewOnce = quoted.viewOnceMessageV2 || quoted.viewOnceMessage;
                        if (viewOnce?.message?.imageMessage) {
                            const buffer = await downloadMedia(sock, { 
                                message: { imageMessage: viewOnce.message.imageMessage } 
                            });
                            await sock.sendMessage(jid, { image: buffer });
                        } else if (viewOnce?.message?.videoMessage) {
                            const buffer = await downloadMedia(sock, { 
                                message: { videoMessage: viewOnce.message.videoMessage } 
                            });
                            await sock.sendMessage(jid, { video: buffer });
                        } else {
                            await sock.sendMessage(jid, { text: '❌ Bukan view once' });
                        }
                    } catch (error) {
                        await sock.sendMessage(jid, { text: '❌ Gagal buka' });
                    }
                    break;

                case 'iqc':
                    const parts = args.split(',');
                    if (parts.length < 4) {
                        await sock.sendMessage(jid, { 
                            text: '❌ Format: .iqc jam,batre,provider,pesan\nContoh: .iqc 18:00,70,Telkomsel,Halo' 
                        });
                        break;
                    }
                    const [time, battery, carrier, ...messageParts] = parts;
                    const messageText = messageParts.join(',');
                    try {
                        const apiUrl = `https://brat.siputzx.my.id/iphone-quoted?time=${time}&batteryPercentage=${battery}&carrierName=${carrier}&messageText=${encodeURIComponent(messageText)}`;
                        const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
                        await sock.sendMessage(jid, { 
                            image: Buffer.from(response.data),
                            caption: `📱 ${time} | ${battery}% | ${carrier}`
                        });
                    } catch (error) {
                        await sock.sendMessage(jid, { text: '❌ Gagal buat iMessage' });
                    }
                    break;

                default:
                    await sock.sendMessage(jid, { 
                        text: `❌ Command tidak dikenal\nKetik ${prefix}menu untuk bantuan` 
                    });
            }
            return;
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

    } catch (error) {
        console.log('💥 Handler error:', error.message);
    }
}

// === SIMPLE INITIALIZE ===
async function initialize() {
    try {
        showBanner();
        
        // Create sessions directory
        if (!fs.existsSync(sessionsDir)) {
            fs.mkdirSync(sessionsDir, { recursive: true });
        }

        console.log('🔄 Connecting to WhatsApp...\n');
        
        // Connect to WhatsApp dengan timeout
        const connectionPromise = connectToWhatsApp();
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Connection timeout')), 30000);
        });

        await Promise.race([connectionPromise, timeoutPromise]);
        
        console.log('✅ Bot ready!');
        
    } catch (error) {
        console.log('❌ Failed to initialize:', error.message);
        
        if (error.message.includes('Session expired') || error.message.includes('Max reconnect attempts')) {
            console.log('💡 Silakan jalankan "npm start" lagi untuk login ulang');
        } else {
            console.log('🔄 Restarting in 10 seconds...');
            await delay(10000);
            process.exit(1);
        }
    }
}

module.exports = {
    initialize,
    messageHandler
};
