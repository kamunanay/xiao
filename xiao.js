const { 
    default: makeWASocket, 
    useMultiFileAuthState,
    delay,
    DisconnectReason
} = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const axios = require('axios');
const qrcode = require('qrcode-terminal');

// Import settings
const { prefix, botName, ownerNumber, autoReplies, chatReactions } = require('./setting');

// Global variables
let sock = null;
let isConnected = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 15;
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
        console.log('❌ Download media error:', error.message);
        throw error;
    }
}

// === STABLE WHATSAPP CONNECTION ===
async function connectToWhatsApp() {
    try {
        const sessionPath = path.join(sessionsDir, 'session');
        
        // Create sessions directory jika belum ada
        if (!fs.existsSync(sessionsDir)) {
            fs.mkdirSync(sessionsDir, { recursive: true });
            console.log('📁 Created sessions directory');
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        const newSock = makeWASocket({
            auth: state,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: ['Ubuntu', 'Chrome', '20.0.04'],
            syncFullHistory: false,
            markOnlineOnConnect: false,
            generateHighQualityLinkPreview: true,
            emitOwnEvents: false,
            defaultQueryTimeoutMs: 60000,
        });

        newSock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // Tampilkan QR code
            if (qr) {
                console.log('\n📱 SCAN QR CODE INI:');
                console.log('══════════════════════════════════════');
                qrcode.generate(qr, { small: true });
                console.log('══════════════════════════════════════');
                console.log('📲 Buka WhatsApp → Settings → Linked Devices → Link a Device');
                console.log('📷 Scan QR code di atas');
                console.log('══════════════════════════════════════\n');
                reconnectAttempts = 0;
            }

            if (connection === 'open') {
                isConnected = true;
                reconnectAttempts = 0;
                sock = newSock;
                
                const user = newSock.user;
                const connectedNumber = user?.id?.split(':')[0] || 'Unknown';
                
                console.log(`\n✅ BERHASIL TERHUBUNG!`);
                console.log(`📱 Nomor: ${connectedNumber}`);
                console.log('🤖 Bot siap menerima pesan!\n');
                
                // Kirim pesan ke owner
                try {
                    await newSock.sendMessage(`${ownerNumber}@s.whatsapp.net`, {
                        text: `🤖 *${botName} AKTIF!*\n\nTerhubung sebagai: ${connectedNumber}\nKetik ${prefix}menu`
                    });
                } catch (e) {
                    console.log('⚠️ Tidak bisa kirim pesan ke owner');
                }
            }

            if (connection === 'close') {
                isConnected = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorMessage = lastDisconnect?.error?.message || 'Unknown error';
                
                console.log(`❌ Koneksi terputus: ${errorMessage}`);
                
                // Jangan reconnect jika logged out
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('🚫 Device logged out, hapus folder sessions dan scan ulang');
                    return;
                }

                if (reconnectAttempts < maxReconnectAttempts) {
                    reconnectAttempts++;
                    const waitTime = Math.min(3000 * Math.pow(1.5, reconnectAttempts - 1), 30000);
                    
                    console.log(`🔄 Mencoba reconnect... (${reconnectAttempts}/${maxReconnectAttempts})`);
                    console.log(`⏳ Tunggu ${Math.round(waitTime/1000)} detik...`);
                    
                    await delay(waitTime);
                    connectToWhatsApp();
                } else {
                    console.log('❌ Gagal reconnect setelah beberapa percobaan');
                    console.log('💡 Silakan restart bot manual dengan: npm start');
                    process.exit(1);
                }
            }
        });

        newSock.ev.on('creds.update', saveCreds);
        
        // Handle messages
        newSock.ev.on('messages.upsert', async (m) => {
            await messageHandler(newSock, m);
        });

        return newSock;
    } catch (error) {
        console.log('❌ Connection error:', error.message);
        
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const waitTime = Math.min(5000 * reconnectAttempts, 30000);
            
            console.log(`🔄 Retrying connection... (${reconnectAttempts}/${maxReconnectAttempts})`);
            await delay(waitTime);
            connectToWhatsApp();
        } else {
            console.log('❌ Max connection attempts reached');
            process.exit(1);
        }
    }
}

// === CECAN FUNCTION ===
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

        const url = urls[query] || urls["indonesia"];
        const response = await axios.get(url, { 
            responseType: 'arraybuffer',
            timeout: 15000 
        });
        
        return Buffer.from(response.data);
    } catch (error) {
        console.log('❌ Cecan image error:', error.message);
        return null;
    }
}

// === BRAT FUNCTION ===
async function getBratImage(text) {
    try {
        const response = await axios.get(
            `https://api.botcahx.eu.org/api/maker/brat?text=${encodeURIComponent(text)}&apikey=moire`,
            { responseType: 'arraybuffer', timeout: 15000 }
        );
        return Buffer.from(response.data);
    } catch (error) {
        console.log('❌ Brat image error:', error.message);
        return null;
    }
}

// === TIKTOK DOWNLOADER ===
async function downloadTiktok(url) {
    try {
        const response = await axios.get(
            `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`,
            { timeout: 20000 }
        );
        return response.data;
    } catch (error) {
        console.log('❌ TikTok download error:', error.message);
        throw new Error('Gagal mengunduh video TikTok');
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

// === MESSAGE HANDLER ===
async function messageHandler(sock, m) {
    try {
        if (!m.messages || !m.messages[0]) return;

        const message = m.messages[0];
        const jid = message.key.remoteJid;
        const body = getText(message);
        const lowerBody = body.toLowerCase();

        // Skip status and own messages
        if (jid === 'status@broadcast' || !body || message.key.fromMe) return;

        console.log(`💬 ${jid.split('@')[0]}: ${body.substring(0, 50)}${body.length > 50 ? '...' : ''}`);

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
                    const pingMsg = await sock.sendMessage(jid, { text: '🏓 Pong!' });
                    const latency = Date.now() - start;
                    await sock.sendMessage(jid, { text: `⚡ Latency: ${latency}ms` });
                    break;

                case 'info':
                    await sock.sendMessage(jid, { 
                        text: `🤖 *${botName}*\n\nWhatsApp Bot Multi-Device\nVersion: 2025.1.0\nAuthor: 小舞 Ga\nPrefix: ${prefix}` 
                    });
                    break;

                case 'owner':
                    await sock.sendMessage(jid, { 
                        text: `👑 Owner: ${ownerNumber}\nHubungi untuk bantuan atau order bot.` 
                    });
                    break;

                case 'cecan':
                    const query = args.toLowerCase() || 'indonesia';
                    const processingMsg = await sock.sendMessage(jid, { text: '🔄 Mengambil gambar...' });
                    
                    const cecanImage = await getCecanImage(query);
                    if (cecanImage) {
                        await sock.sendMessage(jid, { 
                            image: cecanImage,
                            caption: `👩 Cecan ${query}`
                        });
                    } else {
                        await sock.sendMessage(jid, { text: '❌ Gagal mengambil gambar cecan' });
                    }
                    break;

                case 'brat':
                    if (!args) {
                        await sock.sendMessage(jid, { text: `❌ Format: ${prefix}brat <teks>\nContoh: ${prefix}brat Hello World` });
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
                        await sock.sendMessage(jid, { text: '❌ Gagal membuat gambar brat' });
                    }
                    break;

                case 'tiktok':
                    if (!args) {
                        await sock.sendMessage(jid, { text: `❌ Format: ${prefix}tiktok <url>\nContoh: ${prefix}tiktok https://vt.tiktok.com/xxx` });
                        break;
                    }
                    
                    if (!args.includes('tiktok')) {
                        await sock.sendMessage(jid, { text: '❌ Bukan link TikTok yang valid' });
                        break;
                    }

                    await sock.sendMessage(jid, { text: '⏳ Mengunduh video TikTok...' });
                    
                    try {
                        const data = await downloadTiktok(args);
                        const videoUrl = data.video || data.play;
                        
                        if (videoUrl) {
                            const videoResponse = await axios.get(videoUrl, { 
                                responseType: 'arraybuffer',
                                timeout: 30000 
                            });
                            
                            await sock.sendMessage(jid, { 
                                video: Buffer.from(videoResponse.data),
                                caption: `🎵 TikTok Downloader\n\nJudul: ${data.title || 'Tidak diketahui'}\nAuthor: ${data.author || 'Tidak diketahui'}`
                            });
                        } else {
                            await sock.sendMessage(jid, { text: '❌ Gagal mendapatkan URL video' });
                        }
                    } catch (error) {
                        await sock.sendMessage(jid, { text: '❌ Gagal mengunduh video TikTok' });
                    }
                    break;

                case 'b':
                    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                    if (!quoted) {
                        await sock.sendMessage(jid, { text: `❌ Balas pesan view once dengan ${prefix}b` });
                        break;
                    }
                    
                    try {
                        const viewOnce = quoted.viewOnceMessageV2 || quoted.viewOnceMessage;
                        if (viewOnce?.message?.imageMessage) {
                            const buffer = await downloadMedia(sock, { 
                                message: { imageMessage: viewOnce.message.imageMessage } 
                            });
                            await sock.sendMessage(jid, { 
                                image: buffer,
                                caption: '📸 View Once Image'
                            });
                        } else if (viewOnce?.message?.videoMessage) {
                            const buffer = await downloadMedia(sock, { 
                                message: { videoMessage: viewOnce.message.videoMessage } 
                            });
                            await sock.sendMessage(jid, { 
                                video: buffer,
                                caption: '🎥 View Once Video'
                            });
                        } else {
                            await sock.sendMessage(jid, { text: '❌ Bukan view once message yang valid' });
                        }
                    } catch (error) {
                        await sock.sendMessage(jid, { text: '❌ Gagal membuka view once message' });
                    }
                    break;

                case 'iqc':
                    const parts = args.split(',');
                    if (parts.length < 4) {
                        await sock.sendMessage(jid, { 
                            text: `❌ Format: ${prefix}iqc jam,batre,provider,pesan\nContoh: ${prefix}iqc 18:00,70,Telkomsel,Halo dunia` 
                        });
                        break;
                    }
                    
                    const [time, battery, carrier, ...messageParts] = parts;
                    const messageText = messageParts.join(',');
                    
                    try {
                        const apiUrl = `https://brat.siputzx.my.id/iphone-quoted?time=${time}&batteryPercentage=${battery}&carrierName=${carrier}&messageText=${encodeURIComponent(messageText)}`;
                        const response = await axios.get(apiUrl, { 
                            responseType: 'arraybuffer',
                            timeout: 15000 
                        });
                        
                        await sock.sendMessage(jid, { 
                            image: Buffer.from(response.data),
                            caption: `📱 Fake iMessage\n⏰ ${time} | 🔋 ${battery}% | 📶 ${carrier}`
                        });
                    } catch (error) {
                        await sock.sendMessage(jid, { text: '❌ Gagal membuat fake iMessage' });
                    }
                    break;

                default:
                    await sock.sendMessage(jid, { 
                        text: `❌ Command tidak dikenal\nKetik ${prefix}menu untuk melihat daftar perintah` 
                    });
            }
            return;
        }

        // Auto replies
        if (autoReplies[lowerBody]) {
            await sock.sendMessage(jid, { text: autoReplies[lowerBody] });
            return;
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

// === INITIALIZE BOT ===
async function initialize() {
    try {
        showBanner();
        
        console.log('🔄 Connecting to WhatsApp...\n');
        
        // Connect to WhatsApp dengan timeout
        await Promise.race([
            connectToWhatsApp(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Connection timeout setelah 2 menit')), 120000)
            )
        ]);
        
    } catch (error) {
        console.log('❌ Failed to initialize:', error.message);
        console.log('🔄 Restarting in 10 seconds...');
        await delay(10000);
        initialize();
    }
}

// Export functions
module.exports = {
    initialize,
    messageHandler,
    sock: () => sock
};