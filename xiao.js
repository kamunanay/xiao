const { 
    default: makeWASocket, 
    useMultiFileAuthState,
    delay,
    DisconnectReason,
    fetchLatestBaileysVersion,
    Browsers
} = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const axios = require('axios');
const readline = require('readline');
const qrcode = require('qrcode-terminal');

// Import settings
const { prefix, botName, ownerNumber, autoReplies, chatReactions } = require('./setting');

// Global variables
let sock = null;
let isConnected = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;
const sessionsDir = './sessions';

// Create readline interface for input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// === BANNER ===
function showBanner() {
    const style = {
        bold: "\x1b[1m",
        cyan: "\x1b[36m",
        magenta: "\x1b[35m",
        blue: "\x1b[34m",
        reset: "\x1b[0m"
    };
    
    console.log(`${style.cyan}${style.bold}
    ·▄▄▄▄  ▪  ▄▄▄▄▄ ▄▄▄· ▄▄▄▄·      ▄▄▄·▄▄▌  ▪  ▄▄▄▄▄
    ██▪ ██ ██ •██  ▐█ ▀█ ▐█ ▀█▪ ▄█▀▄▐█ ▄███•  ██ •██  
    ▐█· ▐█▌▐█· ▐█.▪▄█▀▀█ ▐█▀▀█▄▐█▌.▐▌██▀▌██ ▪ ▐█▌ ▐█.▪
    ██. ██ ▐█▌ ▐█▌·▐█ ▪▐▌██▄▪▐█▐█▌.▐▌▐█▪▄▌▐█▌▄▌▐█▌ ▐█▌·
    ▀▀▀▀▀• ▀▀▀ ▀▀▀  ▀  ▀ ·▀▀▀▀  ▀█▄▀▪.▀▀▀ .▀▀▀ ▀▀▀ ▀▀▀ 
    ${style.magenta}
    ═══════════════════════════════════════════════════════
        ██╗    ██╗██╗  ██╗ █████╗ ███████╗ █████╗ ██████╗
        ██║    ██║██║  ██║██╔══██╗██╔════╝██╔══██╗██╔══██╗
        ██║ █╗ ██║███████║███████║███████╗███████║██████╔╝
        ██║███╗██║██╔══██║██╔══██║╚════██║██╔══██║██╔═══╝ 
        ╚███╔███╔╝██║  ██║██║  ██║███████║██║  ██║██║     
         ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     
    ═══════════════════════════════════════════════════════
    ${style.blue}
    ✦  XIS CORE SYSTEMS - WhatsApp Bot Multi-Device     ✦
    ✦  Version 3.0 │ Premium Edition │ 1000+ Features   ✦
    ✦  Creator: 小舞 Ga │ Status: 🟢 ONLINE            ✦
    ═══════════════════════════════════════════════════════
    ${style.reset}`);
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
        return null;
    }
}

// === RESET SENDER FUNCTION ===
async function resetSender() {
    try {
        console.log('🔄 Resetting sender...');
        
        if (fs.existsSync(sessionsDir)) {
            fs.rmSync(sessionsDir, { recursive: true, force: true });
            console.log('✅ Session folder berhasil dihapus');
        } else {
            console.log('ℹ️ Session folder tidak ditemukan');
        }
        
        // Reset connection variables
        sock = null;
        isConnected = false;
        reconnectAttempts = 0;
        
        console.log('🔄 Restarting bot...');
        await delay(3000);
        await initialize();
        return true;
    } catch (error) {
        console.log('❌ Reset sender error:', error.message);
        return false;
    }
}

// === TIKTOK DOWNLOADER ===
async function downloadTiktok(url) {
    try {
        console.log(`📥 Download TikTok: ${url}`);
        
        const apiUrl = `https://vinztyty.my.id/download/tiktok?url=${encodeURIComponent(url)}`;
        
        const response = await axios({
            method: 'GET',
            url: apiUrl,
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36'
            }
        });

        const data = response.data;
        
        if (!data.status || !data.result) {
            throw new Error('Video tidak ditemukan');
        }

        const result = {
            title: data.result.description || 'TikTok Video',
            no_watermark: data.result.video_nowm,
            description: data.result.description || ''
        };

        console.log('✅ TikTok data berhasil diambil');
        return result;
        
    } catch (error) {
        console.log('❌ TikTok download error:', error.message);
        throw new Error('Gagal mengunduh video TikTok: ' + error.message);
    }
}

// === DEEPSEEK AI FUNCTION ===
async function deepseekAI(text) {
    try {
        console.log(`🤖 DeepSeek AI: ${text.substring(0, 30)}...`);
        
        const apiUrl = `https://vinztyty.my.id/ai/deepseek?text=${encodeURIComponent(text)}`;
        
        const response = await axios({
            method: 'GET',
            url: apiUrl,
            timeout: 60000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });

        const data = response.data;
        
        if (!data.status) {
            throw new Error(data.error || 'AI tidak merespon');
        }

        console.log('✅ DeepSeek AI berhasil');
        return data.result;
        
    } catch (error) {
        console.log('❌ DeepSeek AI error:', error.message);
        throw new Error('Gagal menghubungi AI: ' + error.message);
    }
}

// === PAP AYANG FUNCTION ===
async function getPapImage() {
    try {
        console.log('📸 Mengambil gambar pap ayang...');
        
        const apiUrl = 'https://restapi-v2.simplebot.my.id/random/papayang';
        
        const response = await axios.get(apiUrl, { 
            responseType: 'arraybuffer',
            timeout: 20000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (response.data && response.data.length > 1000) {
            console.log('✅ Gambar pap ayang berhasil diambil');
            return Buffer.from(response.data);
        } else {
            throw new Error('Gambar tidak valid');
        }
        
    } catch (error) {
        console.log('❌ Pap image error:', error.message);
        return null;
    }
}

// === WAIFU FUNCTION ===
async function getWaifuImage() {
    try {
        console.log('🖼️ Mengambil gambar waifu...');
        
        const apiUrl = 'https://restapi-v2.simplebot.my.id/random/waifu';
        
        const response = await axios.get(apiUrl, { 
            responseType: 'arraybuffer',
            timeout: 20000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (response.data && response.data.length > 1000) {
            console.log('✅ Gambar waifu berhasil diambil');
            return Buffer.from(response.data);
        } else {
            throw new Error('Gambar tidak valid');
        }
        
    } catch (error) {
        console.log('❌ Waifu image error:', error.message);
        return null;
    }
}

// === PINTEREST FUNCTION ===
async function searchPinterest(query) {
    try {
        console.log(`🔍 Mencari Pinterest: ${query}`);
        
        const apiUrl = `https://restapi-v2.simplebot.my.id/search/youtube?q=${encodeURIComponent(query)}`;
        
        const response = await axios.get(apiUrl, { 
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });

        const data = response.data;
        
        if (data.status && data.result && data.result.length > 0) {
            console.log('✅ Pinterest data berhasil diambil');
            return data.result.slice(0, 5);
        } else {
            throw new Error('Tidak ada hasil ditemukan');
        }
        
    } catch (error) {
        console.log('❌ Pinterest search error:', error.message);
        throw new Error('Gagal mencari Pinterest: ' + error.message);
    }
}

// === WHATSAPP CONNECTION WITH FIXED PAIRING CODE ===
async function connectToWhatsApp() {
    try {
        console.log('📡 Initializing WhatsApp connection...');
        
        const { state, saveCreds } = await useMultiFileAuthState(sessionsDir);
        
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`📦 Using WA version: ${version.join('.')} (latest: ${isLatest})`);

        const newSock = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: 'error' }),
            printQRInTerminal: false,
            browser: Browsers.ubuntu('Chrome'),
            syncFullHistory: false,
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            emitOwnEvents: false,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
        });

        newSock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr, pairingCode } = update;

            if (connection) {
                console.log(`🔗 Connection update: ${connection}`);
            }

            // TAMPILKAN QR CODE JIKA ADA
            if (qr) {
                console.log('\n' + '='.repeat(60));
                console.log('📱 QR CODE DITEMUKAN!');
                console.log('='.repeat(60));
                console.log('SCAN QR CODE INI:');
                console.log('='.repeat(60));
                
                // Tampilkan QR code di terminal
                qrcode.generate(qr, { small: true });
                
                console.log('='.repeat(60));
                console.log('CARA SCAN:');
                console.log('1. Buka WhatsApp di HP');
                console.log('2. Tap 3 titik → Linked Devices → Link a Device');
                console.log('3. Scan QR code di atas');
                console.log('='.repeat(60) + '\n');
                reconnectAttempts = 0;
            }

            // TAMPILKAN PAIRING CODE JIKA ADA
            if (pairingCode) {
                console.log('\n' + '='.repeat(60));
                console.log('📱 PAIRING CODE (8 DIGIT) DITEMUKAN!');
                console.log('='.repeat(60));
                console.log(`🔢 Kode Pairing: ${pairingCode}`);
                console.log('='.repeat(60));
                console.log('CARA PAIRING:');
                console.log('1. Buka WhatsApp di HP');
                console.log('2. Tap 3 titik → Linked Devices → Link a Device');
                console.log('3. Pilih "Link with phone number"');
                console.log('4. Masukkan kode 8 digit di atas');
                console.log('='.repeat(60) + '\n');
                reconnectAttempts = 0;
            }

            if (connection === 'open') {
                isConnected = true;
                reconnectAttempts = 0;
                sock = newSock;
                
                const user = newSock.user;
                const connectedNumber = user?.id?.split(':')[0] || 'Unknown';
                
                console.log(`\n🎉 BERHASIL TERHUBUNG KE WHATSAPP!`);
                console.log(`📱 Nomor: ${connectedNumber}`);
                console.log('🤖 Bot sekarang aktif dan siap digunakan!\n');
                
                try {
                    await newSock.sendMessage(`${ownerNumber}@s.whatsapp.net`, {
                        text: `🤖 *${botName} BERHASIL AKTIF!*\n\nTerhubung sebagai: ${connectedNumber}\nKetik ${prefix}menu untuk melihat daftar perintah`
                    });
                    console.log('📨 Notifikasi terkirim ke owner');
                } catch (e) {
                    console.log('⚠️ Tidak bisa kirim notifikasi ke owner');
                }
            }

            if (connection === 'close') {
                isConnected = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorMessage = lastDisconnect?.error?.message || 'Unknown error';
                
                console.log(`\n❌ Koneksi terputus: ${errorMessage}`);
                
                // Auto reset jika session expired atau error tertentu
                if (statusCode === DisconnectReason.loggedOut || 
                    errorMessage.includes('401') || 
                    errorMessage.includes('403') ||
                    errorMessage.includes('Connection Failure')) {
                    
                    console.log('🚫 Session expired/error, melakukan auto reset sender...');
                    await delay(2000);
                    await resetSender();
                    return;
                }

                if (reconnectAttempts < maxReconnectAttempts) {
                    reconnectAttempts++;
                    const waitTime = Math.min(2000 * reconnectAttempts, 15000);
                    
                    console.log(`🔄 Mencoba reconnect... (${reconnectAttempts}/${maxReconnectAttempts})`);
                    console.log(`⏳ Menunggu ${Math.round(waitTime/1000)} detik...`);
                    
                    await delay(waitTime);
                    connectToWhatsApp();
                } else {
                    console.log('💥 Gagal reconnect setelah beberapa percobaan');
                    console.log('🔄 Melakukan auto reset sender...');
                    await delay(2000);
                    await resetSender();
                }
            }

            if (connection === 'connecting') {
                console.log('🔄 Menghubungkan ke WhatsApp servers...');
            }
        });

        newSock.ev.on('creds.update', saveCreds);
        
        // Handle incoming messages
        newSock.ev.on('messages.upsert', async (m) => {
            await messageHandler(newSock, m);
        });

        return newSock;

    } catch (error) {
        console.log('❌ Connection setup error:', error.message);
        
        // Auto reset jika error setup
        if (error.message.includes('ENOENT') || 
            error.message.includes('invalid session') ||
            error.message.includes('credentials')) {
            console.log('🔄 Auto reset karena session invalid...');
            await delay(2000);
            await resetSender();
            return null;
        }
        
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const waitTime = Math.min(3000 * reconnectAttempts, 20000);
            
            console.log(`🔄 Retrying connection setup... (${reconnectAttempts}/${maxReconnectAttempts})`);
            await delay(waitTime);
            return connectToWhatsApp();
        } else {
            console.log('💥 Max connection setup attempts reached');
            console.log('🔄 Melakukan auto reset...');
            await delay(2000);
            await resetSender();
            return null;
        }
    }
}

// === MENU ===
async function sendMenu(sock, jid) {
    const menuText = `
┌─⋆⋅─────────────────⋅⋆─┐
    𝐗𝐈𝐒  𝐂𝐎𝐑𝐄  𝐒𝐘𝐒𝐓𝐄𝐌𝐒
└─⋆⋅─────────────────⋅⋆─┘

✦⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅✦
  Automated  Platform  
✦⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅⋅✦

➤ Platform: WhatsApp
➤ Author: 小舞 Ga  
➤ Type: Media Tools
➤ League: Asia/Jakarta

┌─≻∘ 𝐀𝐈 𝐒𝐘𝐒𝐓𝐄𝐌 ∘≺─┐
│ ➣ AI Commands
│   ╰─ .ai <pertanyaan>
│   ╰─ .deepseek <teks>
└─────────────────────┘

┌─≻∘ 𝐌𝐄𝐃𝐈𝐀 𝐒𝐘𝐒𝐓𝐄𝐌 ∘≺─┐
│ ➣ Media Commands
│   ╰─ .tiktok <url>
└─────────────────────┘

┌─≻∘ 𝐑𝐀𝐍𝐃𝐎𝐌 𝐒𝐘𝐒𝐓𝐄𝐌 ∘≺─┐
│ ➣ Random Commands
│   ╰─ .pap (pap ayang)
│   ╰─ .waifu (random waifu)
│   ╰─ .pinterest <query>
└─────────────────────┘

┌─≻∘ 𝐆𝐑𝐎𝐔𝐏 𝐒𝐘𝐒𝐓𝐄𝐌 ∘≺─┐
│ ➣ Group Commands
│   ╰─ .tag (tag semua member)
└─────────────────────┘

┌─≻∘ 𝐔𝐓𝐈𝐋𝐈𝐓𝐘 𝐒𝐘𝐒𝐓𝐄𝐌 ∘≺─┐
│ ➣ Utility Commands
│   ╰─ .b (view once)
│   ╰─ .block <nomor> (block user)
│   ╰─ .iqc (fake iMessage)
│   ╰─ .resetsender
│   ╰─ .menu
│   ╰─ .ping
│   ╰─ .info
│   ╰─ .owner
└─────────────────────┘

◉ Status: Active
◉ Memory: ▰▰▰▰▱ 78%
◉ Session: 30 days remaining
◉ Pairing: 8-digit code
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

        if (jid === 'status@broadcast' || !body || message.key.fromMe) return;

        console.log(`💬 [${jid.split('@')[0]}] : ${body.substring(0, 30)}${body.length > 30 ? '...' : ''}`);

        // Handle commands
        if (body.startsWith(prefix)) {
            const command = body.slice(prefix.length).split(' ')[0].toLowerCase();
            const args = body.slice(prefix.length + command.length).trim();

            switch(command) {
                case 'menu':
                case 'help':
                case 'start':
                    await sendMenu(sock, jid);
                    break;

                case 'ping':
                    const start = Date.now();
                    await sock.sendMessage(jid, { text: 'Pong!' });
                    const latency = Date.now() - start;
                    await sock.sendMessage(jid, { text: `Latency: ${latency}ms` });
                    break;

                case 'info':
                    await sock.sendMessage(jid, { 
                        text: `*${botName}*\n\nWhatsApp Bot Multi-Device\nVersion: 2025.1.0\nAuthor: 小舞 Ga\nPrefix: ${prefix}\nPairing: 8-digit code` 
                    });
                    break;

                case 'owner':
                    await sock.sendMessage(jid, { 
                        text: `Owner: ${ownerNumber}\nHubungi untuk bantuan atau order bot.` 
                    });
                    break;

                case 'resetsender':
                    // Hanya owner yang bisa reset sender
                    if (jid !== `${ownerNumber}@s.whatsapp.net`) {
                        await sock.sendMessage(jid, { text: '❌ Akses hanya untuk owner!' });
                        break;
                    }

                    await sock.sendMessage(jid, { text: '🔄 Melakukan reset sender...' });
                    
                    try {
                        await resetSender();
                        await sock.sendMessage(jid, { text: '✅ Berhasil melakukan reset sender!' });
                    } catch (error) {
                        await sock.sendMessage(jid, { text: '❌ Gagal melakukan reset sender' });
                    }
                    break;

                case 'ai':
                case 'deepseek':
                    if (!args) {
                        await sock.sendMessage(jid, { 
                            text: `Format: ${prefix}ai <pertanyaan>\nContoh: ${prefix}ai Apa itu JavaScript?` 
                        });
                        break;
                    }

                    try {
                        await sock.sendMessage(jid, { text: '🤖 DeepSeek AI sedang berpikir...' });
                        const aiResponse = await deepseekAI(args);
                        await sock.sendMessage(jid, { 
                            text: `🤖 *DeepSeek AI Response*\n\n${aiResponse}\n\n_Powered by VinzOffc API_` 
                        });
                    } catch (error) {
                        console.log('AI error:', error.message);
                        await sock.sendMessage(jid, { 
                            text: `❌ Gagal menghubungi AI: ${error.message}` 
                        });
                    }
                    break;

                case 'tiktok':
                    if (!args) {
                        await sock.sendMessage(jid, { text: `Format: ${prefix}tiktok <url>\nContoh: ${prefix}tiktok https://vt.tiktok.com/xxx` });
                        break;
                    }
                    
                    if (!args.includes('tiktok')) {
                        await sock.sendMessage(jid, { text: 'Bukan link TikTok yang valid' });
                        break;
                    }

                    try {
                        await sock.sendMessage(jid, { text: 'Mengunduh video TikTok...' });
                        const data = await downloadTiktok(args);
                        const videoUrl = data.no_watermark;
                        
                        if (videoUrl) {
                            await sock.sendMessage(jid, { text: 'Sedang mendownload video...' });
                            const videoResponse = await axios.get(videoUrl, { 
                                responseType: 'arraybuffer',
                                timeout: 60000,
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                    'Referer': 'https://www.tiktok.com/'
                                }
                            });
                            
                            if (videoResponse.data.length > 1000) {
                                await sock.sendMessage(jid, { 
                                    video: Buffer.from(videoResponse.data),
                                    caption: `TikTok - ${botName}\nDeskripsi: ${data.description || 'Tidak ada deskripsi'}\n_Powered by VinzOffc API_`
                                });
                            } else {
                                await sock.sendMessage(jid, { text: 'Video yang didownload terlalu kecil, mungkin gagal.' });
                            }
                        } else {
                            await sock.sendMessage(jid, { text: 'Gagal mendapatkan URL video' });
                        }
                    } catch (error) {
                        console.log('TikTok error:', error.message);
                        await sock.sendMessage(jid, { text: `Gagal mengunduh video TikTok: ${error.message}` });
                    }
                    break;

                case 'pap':
                    try {
                        await sock.sendMessage(jid, { text: 'Mengambil gambar pap ayang...' });
                        const papImage = await getPapImage();
                        if (papImage) {
                            await sock.sendMessage(jid, { 
                                image: papImage,
                                caption: `Pap ayang - ${botName}`
                            });
                        } else {
                            await sock.sendMessage(jid, { text: 'Gagal mengambil gambar pap ayang. Coba lagi nanti.' });
                        }
                    } catch (error) {
                        await sock.sendMessage(jid, { text: 'Error saat mengambil gambar pap ayang.' });
                    }
                    break;

                case 'waifu':
                    try {
                        await sock.sendMessage(jid, { text: 'Mengambil gambar waifu...' });
                        const waifuImage = await getWaifuImage();
                        if (waifuImage) {
                            await sock.sendMessage(jid, { 
                                image: waifuImage,
                                caption: `Random waifu - ${botName}`
                            });
                        } else {
                            await sock.sendMessage(jid, { text: 'Gagal mengambil gambar waifu. Coba lagi nanti.' });
                        }
                    } catch (error) {
                        await sock.sendMessage(jid, { text: 'Error saat mengambil gambar waifu.' });
                    }
                    break;

                case 'pinterest':
                    if (!args) {
                        await sock.sendMessage(jid, { 
                            text: `Format: ${prefix}pinterest <query>\nContoh: ${prefix}pinterest anime girl` 
                        });
                        break;
                    }

                    try {
                        await sock.sendMessage(jid, { text: `🔍 Mencari "${args}" di Pinterest...` });
                        const results = await searchPinterest(args);
                        let resultText = `📌 *Hasil Pinterest untuk: ${args}*\n\n`;
                        results.forEach((item, index) => {
                            resultText += `${index + 1}. ${item.title || 'Tidak ada judul'}\n`;
                            if (item.url) resultText += `🔗 ${item.url}\n`;
                            if (item.thumbnail) resultText += `🖼️ ${item.thumbnail}\n`;
                            resultText += '\n';
                        });
                        resultText += `\nTotal ditemukan: ${results.length} hasil`;
                        await sock.sendMessage(jid, { text: resultText });
                    } catch (error) {
                        console.log('Pinterest error:', error.message);
                        await sock.sendMessage(jid, { 
                            text: `❌ Gagal mencari Pinterest: ${error.message}` 
                        });
                    }
                    break;

                case 'tag':
                    if (!jid.endsWith('@g.us')) {
                        await sock.sendMessage(jid, { text: 'Command ini hanya bisa digunakan di grup!' });
                        break;
                    }
                    
                    try {
                        const groupMetadata = await sock.groupMetadata(jid);
                        const participants = groupMetadata.participants;
                        let mentions = [];
                        let tagText = '';
                        for (const participant of participants) {
                            mentions.push(participant.id);
                            tagText += `@${participant.id.split('@')[0]} `;
                        }
                        await sock.sendMessage(jid, { 
                            text: tagText, 
                            mentions: mentions 
                        });
                    } catch (error) {
                        await sock.sendMessage(jid, { text: 'Gagal mendapatkan member grup.' });
                    }
                    break;

                case 'block':
                    if (jid !== `${ownerNumber}@s.whatsapp.net`) {
                        await sock.sendMessage(jid, { text: 'Hanya owner yang bisa menggunakan command ini!' });
                        break;
                    }
                    
                    if (!args) {
                        await sock.sendMessage(jid, { text: `Format: ${prefix}block <nomor>\nContoh: ${prefix}block 6281234567890` });
                        break;
                    }
                    
                    const blockNumber = args.replace(/[^0-9]/g, '');
                    if (blockNumber.length < 10) {
                        await sock.sendMessage(jid, { text: 'Nomor tidak valid!' });
                        break;
                    }
                    
                    try {
                        await sock.updateBlockStatus(`${blockNumber}@s.whatsapp.net`, 'block');
                        await sock.sendMessage(jid, { text: `✅ Berhasil memblokir ${blockNumber}` });
                    } catch (error) {
                        await sock.sendMessage(jid, { text: `❌ Gagal memblokir: ${error.message}` });
                    }
                    break;

                case 'b':
                    const quotedViewOnce = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                    if (!quotedViewOnce) {
                        await sock.sendMessage(jid, { text: `Balas pesan view once dengan ${prefix}b` });
                        break;
                    }
                    
                    try {
                        const viewOnce = quotedViewOnce.viewOnceMessageV2 || quotedViewOnce.viewOnceMessage;
                        if (viewOnce?.message?.imageMessage) {
                            const buffer = await downloadMedia(sock, { 
                                message: { imageMessage: viewOnce.message.imageMessage } 
                            });
                            if (buffer) {
                                await sock.sendMessage(jid, { 
                                    image: buffer,
                                    caption: 'View Once Image - Dibuka oleh bot'
                                });
                            } else {
                                await sock.sendMessage(jid, { text: 'Gagal download gambar' });
                            }
                        } else if (viewOnce?.message?.videoMessage) {
                            const buffer = await downloadMedia(sock, { 
                                message: { videoMessage: viewOnce.message.videoMessage } 
                            });
                            if (buffer) {
                                await sock.sendMessage(jid, { 
                                    video: buffer,
                                    caption: 'View Once Video - Dibuka oleh bot'
                                });
                            } else {
                                await sock.sendMessage(jid, { text: 'Gagal download video' });
                            }
                        } else {
                            await sock.sendMessage(jid, { text: 'Bukan view once message yang valid' });
                        }
                    } catch (error) {
                        await sock.sendMessage(jid, { text: 'Gagal membuka view once message' });
                    }
                    break;

                case 'iqc':
                    const parts = args.split(',');
                    if (parts.length < 4) {
                        await sock.sendMessage(jid, { 
                            text: `Format: ${prefix}iqc jam,batre,provider,pesan\nContoh: ${prefix}iqc 18:00,70,Telkomsel,Halo dunia` 
                        });
                        break;
                    }
                    
                    const [time, battery, carrier, ...messageParts] = parts;
                    const messageText = messageParts.join(',');
                    
                    try {
                        const apiUrl = `https://brat.siputzx.my.id/iphone-quoted?time=${time}&batteryPercentage=${battery}&carrierName=${carrier}&messageText=${encodeURIComponent(messageText)}`;
                        const response = await axios.get(apiUrl, { 
                            responseType: 'arraybuffer',
                            timeout: 20000 
                        });
                        
                        await sock.sendMessage(jid, { 
                            image: Buffer.from(response.data),
                            caption: `Fake iMessage\n${time} | ${battery}% | ${carrier}`
                        });
                    } catch (error) {
                        await sock.sendMessage(jid, { text: 'Gagal membuat fake iMessage' });
                    }
                    break;

                default:
                    await sock.sendMessage(jid, { 
                        text: `Command "${command}" tidak dikenali\nKetik ${prefix}menu untuk melihat daftar perintah` 
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
        // Auto reset jika error critical dalam handler
        if (error.message.includes('Connection Failure') || 
            error.message.includes('Stream Errored') ||
            error.message.includes('socket hang up')) {
            console.log('🔄 Auto reset karena connection error...');
            setTimeout(() => resetSender(), 3000);
        }
    }
}

// === INITIALIZE BOT ===
async function initialize() {
    try {
        showBanner();
        
        // Create sessions directory
        if (!fs.existsSync(sessionsDir)) {
            fs.mkdirSync(sessionsDir, { recursive: true });
            console.log('📁 Created sessions directory');
        } else {
            console.log('📁 Sessions directory ready');
        }

        console.log('🔄 Connecting to WhatsApp...\n');
        
        await connectToWhatsApp();
        
    } catch (error) {
        console.log('❌ Failed to initialize:', error.message);
        console.log('🔄 Auto reset dan restart dalam 5 detik...');
        await delay(5000);
        await resetSender();
    }
}

// Handle CTRL+C
process.on('SIGINT', () => {
    console.log('\n\n👋 Bot dihentikan oleh user');
    rl.close();
    if (sock) {
        sock.end();
    }
    process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
    console.log('💥 Uncaught Exception:', error.message);
    console.log('🔄 Auto reset...');
    await resetSender();
});

process.on('unhandledRejection', async (error) => {
    console.log('💥 Unhandled Rejection:', error.message);
    console.log('🔄 Auto reset...');
    await resetSender();
});

// Start the bot
initialize();