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

// Group settings storage
let groupSettings = {};
const groupSettingsFile = './group_settings.json';

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

// === GROUP SETTINGS FUNCTIONS ===
function loadGroupSettings() {
    try {
        if (fs.existsSync(groupSettingsFile)) {
            const data = fs.readFileSync(groupSettingsFile, 'utf8');
            groupSettings = JSON.parse(data);
            console.log('✅ Group settings loaded');
        } else {
            groupSettings = {};
            console.log('ℹ️ No group settings file, starting fresh');
        }
    } catch (error) {
        console.log('❌ Error loading group settings:', error.message);
        groupSettings = {};
    }
}

function saveGroupSettings() {
    try {
        fs.writeFileSync(groupSettingsFile, JSON.stringify(groupSettings, null, 2));
        console.log('💾 Group settings saved');
    } catch (error) {
        console.log('❌ Error saving group settings:', error.message);
    }
}

function getGroupSettings(jid) {
    if (!groupSettings[jid]) {
        groupSettings[jid] = {
            antilink: false,
            welcome: false,
            welcomeMessage: 'Selamat datang @user di grup @subject!',
            goodbyeMessage: 'Selamat tinggal @user!',
        };
    }
    return groupSettings[jid];
}

async function isAdmin(sock, jid, userId) {
    try {
        if (!jid.endsWith('@g.us')) return false;
        
        const metadata = await sock.groupMetadata(jid);
        const participant = metadata.participants.find(p => p.id === userId);
        return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
    } catch (error) {
        console.log('Error checking admin:', error.message);
        return false;
    }
}

async function isOwner(sock, jid, userId) {
    try {
        if (!jid.endsWith('@g.us')) return false;
        
        const metadata = await sock.groupMetadata(jid);
        return metadata.owner === userId;
    } catch (error) {
        return false;
    }
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
        
        console.log(`🌐 Mengakses API: ${apiUrl}`);
        
        const response = await axios({
            method: 'GET',
            url: apiUrl,
            timeout: 60000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });

        console.log('📥 Respons API diterima');
        console.log('📊 Status respons:', response.status);
        
        const data = response.data;
        
        if (!data.status) {
            console.log('❌ API mengembalikan status false');
            throw new Error(data.error || 'AI tidak merespon');
        }

        let aiResponse = '';
        
        if (data.result && data.result.trim() !== '') {
            aiResponse = data.result;
        } else {
            throw new Error('AI tidak memberikan respons');
        }
        
        if (aiResponse.length > 4000) {
            aiResponse = aiResponse.substring(0, 4000) + '...\n\n(Respons dipotong karena terlalu panjang)';
        }
        
        console.log(`✅ DeepSeek AI berhasil: ${aiResponse.substring(0, 50)}...`);
        return aiResponse;
        
    } catch (error) {
        console.log('❌ DeepSeek AI error:', error.message);
        console.log('🔍 Error details:', error.response?.data || 'No response data');
        throw new Error('Gagal menghubungi AI: ' + error.message);
    }
}

// === BRAT FUNCTION ===
async function getBratImage(text) {
    try {
        console.log(`🎨 Membuat gambar brat: ${text}`);
        
        const apiUrl = `https://vinztyty.my.id/tools/brat?text=${encodeURIComponent(text)}`;
        
        const response = await axios.get(apiUrl, { 
            responseType: 'arraybuffer',
            timeout: 20000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (response.data && response.data.length > 1000) {
            console.log('✅ Gambar brat berhasil dibuat');
            return Buffer.from(response.data);
        } else {
            throw new Error('Gambar tidak valid');
        }
        
    } catch (error) {
        console.log('❌ Brat image error:', error.message);
        return null;
    }
}

// === SPOTIFY SEARCH FUNCTION ===
async function searchSpotify(query) {
    try {
        console.log(`🎵 Mencari Spotify: ${query}`);
        
        const apiUrl = `https://vinztyty.my.id/search/spotify?q=${encodeURIComponent(query)}`;
        
        const response = await axios.get(apiUrl, { 
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });

        const data = response.data;
        
        if (!data.status || !data.result) {
            throw new Error('Tidak ada hasil ditemukan');
        }

        console.log('✅ Spotify data berhasil diambil');
        return data.result;
        
    } catch (error) {
        console.log('❌ Spotify search error:', error.message);
        throw new Error('Gagal mencari di Spotify: ' + error.message);
    }
}

// === LACAK NOMOR FUNCTION ===
async function lacakNomor(nomor) {
    try {
        console.log(`🔍 Lacak nomor: ${nomor}`);
        
        const apiUrl = `https://vinztyty.my.id/tools/cek-nomor?nomor=${encodeURIComponent(nomor)}`;
        
        const response = await axios.get(apiUrl, { 
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });

        const data = response.data;
        
        if (!data.status) {
            throw new Error(data.error || 'Nomor tidak ditemukan');
        }

        console.log('✅ Data nomor berhasil diambil');
        return data.data;
        
    } catch (error) {
        console.log('❌ Lacak nomor error:', error.message);
        throw new Error('Gagal melacak nomor: ' + error.message);
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

// === GROUP PARTICIPANTS HANDLER ===
async function groupParticipantsHandler(sock, update) {
    try {
        const { id, participants, action } = update;
        const settings = getGroupSettings(id);

        if (action === 'add' && settings.welcome) {
            for (const participant of participants) {
                let welcomeMsg = settings.welcomeMessage;
                welcomeMsg = welcomeMsg.replace('@user', `@${participant.split('@')[0]}`);
                
                const groupInfo = await sock.groupMetadata(id);
                welcomeMsg = welcomeMsg.replace('@subject', groupInfo.subject);
                
                await sock.sendMessage(id, { 
                    text: welcomeMsg,
                    mentions: [participant]
                });
            }
        } else if (action === 'remove' && settings.welcome) {
            // Goodbye message (optional)
            for (const participant of participants) {
                let goodbyeMsg = settings.goodbyeMessage;
                goodbyeMsg = goodbyeMsg.replace('@user', `@${participant.split('@')[0]}`);
                
                await sock.sendMessage(id, { 
                    text: goodbyeMsg,
                    mentions: [participant]
                });
            }
        }
    } catch (error) {
        console.log('Group participants handler error:', error.message);
    }
}

// === WHATSAPP CONNECTION ===
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

            if (qr) {
                console.log('\n' + '='.repeat(60));
                console.log('📱 QR CODE DITEMUKAN!');
                console.log('='.repeat(60));
                console.log('SCAN QR CODE INI:');
                console.log('='.repeat(60));
                
                qrcode.generate(qr, { small: true });
                
                console.log('='.repeat(60));
                console.log('CARA SCAN:');
                console.log('1. Buka WhatsApp di HP');
                console.log('2. Tap 3 titik → Linked Devices → Link a Device');
                console.log('3. Scan QR code di atas');
                console.log('='.repeat(60) + '\n');
                reconnectAttempts = 0;
            }

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
        
        // Handle group participants updates
        newSock.ev.on('group-participants.update', async (update) => {
            await groupParticipantsHandler(newSock, update);
        });
        
        // Handle incoming messages
        newSock.ev.on('messages.upsert', async (m) => {
            await messageHandler(newSock, m);
        });

        return newSock;

    } catch (error) {
        console.log('❌ Connection setup error:', error.message);
        
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
│   ╰─ .deepseek <pertanyaan>
└─────────────────────┘

┌─≻∘ 𝐌𝐄𝐃𝐈𝐀 𝐒𝐘𝐒𝐓𝐄𝐌 ∘≺─┐
│ ➣ Media Commands
│   ╰─ .tiktok <url>
│   ╰─ .spotify <query>
└─────────────────────┘

┌─≻∘ 𝐑𝐀𝐍𝐃𝐎𝐌 𝐒𝐘𝐒𝐓𝐄𝐌 ∘≺─┐
│ ➣ Random Commands
│   ╰─ .brat <teks>
│   ╰─ .waifu (random waifu)
│   ╰─ .pinterest <query>
└─────────────────────┘

┌─≻∘ 𝐈𝐍𝐅𝐎 𝐒𝐘𝐒𝐓𝐄𝐌 ∘≺─┐
│ ➣ Info Commands
│   ╰─ .lacak <nomor>
│   ╰─ .info (bot info)
│   ╰─ .owner (kontak owner)
└─────────────────────┘

┌─≻∘ 𝐆𝐑𝐎𝐔𝐏 𝐒𝐘𝐒𝐓𝐄𝐌 ∘≺─┐
│ ➣ Group Commands
│   ╰─ .tag (tag semua member)
│   ╰─ .infogrup (info group)
│   ╰─ .listadmin (list admin)
│   ╰─ .antilink [on/off]
│   ╰─ .welcome [on/off]
│   ╰─ .kick @user
│   ╰─ .promote @user
│   ╰─ .demote @user
└─────────────────────┘

┌─≻∘ 𝐔𝐓𝐈𝐋𝐈𝐓𝐘 𝐒𝐘𝐒𝐓𝐄𝐌 ∘≺─┐
│ ➣ Utility Commands
│   ╰─ .b (view once)
│   ╰─ .block <nomor> (block user)
│   ╰─ .iqc (fake iMessage)
│   ╰─ .resetsender
│   ╰─ .menu
│   ╰─ .ping
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

        // === ANTI-LINK CHECK (for groups only) ===
        if (jid.endsWith('@g.us')) {
            const settings = getGroupSettings(jid);
            
            if (settings.antilink && (body.includes('http://') || body.includes('https://') || body.includes('www.'))) {
                const isSenderAdmin = await isAdmin(sock, jid, message.key.participant || message.key.remoteJid);
                if (!isSenderAdmin) {
                    // Delete the message containing link
                    await sock.sendMessage(jid, { delete: message.key });
                    
                    // Send warning
                    await sock.sendMessage(jid, { 
                        text: `❌ Link tidak diizinkan di grup ini!`,
                        mentions: [message.key.participant || message.key.remoteJid]
                    });
                    return;
                }
            }
        }

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

                case 'deepseek':
                    if (!args) {
                        await sock.sendMessage(jid, { 
                            text: `Format: ${prefix}deepseek <pertanyaan>\nContoh: ${prefix}deepseek Apa itu JavaScript?` 
                        });
                        break;
                    }

                    try {
                        await sock.sendMessage(jid, { text: '🤖 DeepSeek AI sedang berpikir...' });
                        const aiResponse = await deepseekAI(args);
                        
                        console.log('📤 Mengirim respons AI ke WhatsApp...');
                        console.log('📝 Respons:', aiResponse.substring(0, 100) + '...');
                        
                        await sock.sendMessage(jid, { 
                            text: `🤖 *DeepSeek AI Response*\n\n${aiResponse}\n\n_Powered by VinzOffc API_` 
                        });
                        
                        console.log('✅ Respons AI berhasil dikirim');
                    } catch (error) {
                        console.log('AI error:', error.message);
                        await sock.sendMessage(jid, { 
                            text: `❌ Gagal menghubungi AI\n\nError: ${error.message}\n\nCoba lagi nanti atau gunakan pertanyaan yang berbeda.` 
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

                case 'spotify':
                    if (!args) {
                        await sock.sendMessage(jid, { 
                            text: `Format: ${prefix}spotify <query>\nContoh: ${prefix}spotify coldplay\n\nNote: Mencari musik di Spotify` 
                        });
                        break;
                    }

                    try {
                        await sock.sendMessage(jid, { text: `🔍 Mencari "${args}" di Spotify...` });
                        const results = await searchSpotify(args);
                        
                        if (!results || results.length === 0) {
                            await sock.sendMessage(jid, { text: '❌ Tidak ada hasil ditemukan' });
                            break;
                        }

                        let resultText = `🎵 *HASIL PENCARIAN SPOTIFY:* ${args}\n`;
                        resultText += `════════════════════════════\n\n`;
                        
                        const limitedResults = results.slice(0, 5);
                        
                        limitedResults.forEach((track, index) => {
                            resultText += `*${index + 1}.* ${track.title || 'Unknown'}\n`;
                            if (track.artist) resultText += `   👤 *Artis:* ${track.artist}\n`;
                            if (track.album) resultText += `   💿 *Album:* ${track.album}\n`;
                            if (track.duration) resultText += `   ⏱️ *Durasi:* ${track.duration}\n`;
                            if (track.preview_url) resultText += `   🔊 *Preview:* Tersedia\n`;
                            resultText += `\n`;
                        });
                        
                        resultText += `════════════════════════════\n`;
                        resultText += `_Powered by VinzOffc API_`;
                        
                        await sock.sendMessage(jid, { text: resultText });
                        
                    } catch (error) {
                        console.log('Spotify error:', error.message);
                        await sock.sendMessage(jid, { 
                            text: `❌ Gagal mencari di Spotify: ${error.message}` 
                        });
                    }
                    break;

                case 'brat':
                    if (!args) {
                        await sock.sendMessage(jid, { 
                            text: `Format: ${prefix}brat <teks>\nContoh: ${prefix}brat Hello World\n\nNote: Buat gambar dengan teks kreatif` 
                        });
                        break;
                    }

                    try {
                        await sock.sendMessage(jid, { text: '🎨 Membuat gambar brat...' });
                        const bratImage = await getBratImage(args);
                        if (bratImage) {
                            await sock.sendMessage(jid, { 
                                image: bratImage,
                                caption: `Brat - ${botName}\nTeks: ${args}\n_Powered by VinzOffc API_`
                            });
                        } else {
                            await sock.sendMessage(jid, { text: 'Gagal membuat gambar brat. Coba lagi nanti.' });
                        }
                    } catch (error) {
                        await sock.sendMessage(jid, { text: 'Error saat membuat gambar brat.' });
                    }
                    break;

                case 'lacak':
                case 'cek':
                case 'nomor':
                    if (!args) {
                        await sock.sendMessage(jid, { 
                            text: `Format: ${prefix}lacak <nomor>\nContoh: ${prefix}lacak 6281234567890\n\nNote: Melacak informasi nomor telepon` 
                        });
                        break;
                    }

                    try {
                        await sock.sendMessage(jid, { text: `🔍 Melacak nomor ${args}...` });
                        const data = await lacakNomor(args);
                        
                        let resultText = `📱 *INFORMASI NOMOR TELEPON*\n`;
                        resultText += `══════════════════════\n\n`;
                        
                        if (data.nomor) resultText += `📞 *Nomor:* ${data.nomor}\n`;
                        if (data.operator) resultText += `📡 *Operator:* ${data.operator}\n`;
                        if (data.tipe) resultText += `💰 *Tipe:* ${data.tipe}\n`;
                        if (data.lokasi_perkiraan) resultText += `📍 *Lokasi Perkiraan:* ${data.lokasi_perkiraan}\n`;
                        
                        if (data.catatan) {
                            resultText += `\n📝 *Catatan:*\n${data.catatan}\n`;
                        }
                        
                        resultText += `\n══════════════════════\n`;
                        resultText += `_Powered by VinzOffc API_`;
                        
                        await sock.sendMessage(jid, { text: resultText });
                    } catch (error) {
                        console.log('Lacak error:', error.message);
                        await sock.sendMessage(jid, { 
                            text: `❌ Gagal melacak nomor: ${error.message}` 
                        });
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

                // ========== GROUP COMMANDS ==========
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

                case 'infogrup':
                case 'groupinfo':
                    if (!jid.endsWith('@g.us')) {
                        await sock.sendMessage(jid, { text: 'Command ini hanya bisa digunakan di grup!' });
                        break;
                    }
                    
                    try {
                        const metadata = await sock.groupMetadata(jid);
                        const participants = metadata.participants;
                        const admins = participants.filter(p => p.admin).map(p => p.id);
                        const settings = getGroupSettings(jid);
                        
                        const infoText = `
┌─⋆⋅「 Group Info 」⋅⋆─┐
│ • Nama: ${metadata.subject}
│ • Dibuat: ${new Date(metadata.creation * 1000).toLocaleString()}
│ • Owner: @${metadata.owner.split('@')[0]}
│ • Jumlah Member: ${participants.length}
│ • Jumlah Admin: ${admins.length}
│ • Antilink: ${settings.antilink ? '🟢 Aktif' : '🔴 Tidak aktif'}
│ • Welcome: ${settings.welcome ? '🟢 Aktif' : '🔴 Tidak aktif'}
└─────────────────────┘
                        `.trim();
                        
                        await sock.sendMessage(jid, { 
                            text: infoText,
                            mentions: [metadata.owner]
                        });
                    } catch (error) {
                        console.log(error);
                        await sock.sendMessage(jid, { text: 'Gagal mendapatkan info grup.' });
                    }
                    break;

                case 'listadmin':
                    if (!jid.endsWith('@g.us')) {
                        await sock.sendMessage(jid, { text: 'Command ini hanya bisa digunakan di grup!' });
                        break;
                    }
                    
                    try {
                        const metadata = await sock.groupMetadata(jid);
                        const admins = metadata.participants.filter(p => p.admin);
                        
                        if (admins.length === 0) {
                            await sock.sendMessage(jid, { text: '❌ Tidak ada admin di grup ini.' });
                            break;
                        }
                        
                        let adminText = '┌─⋆⋅「 List Admin 」⋅⋆─┐\n';
                        admins.forEach((admin, index) => {
                            const adminType = admin.admin === 'superadmin' ? '(Owner)' : '(Admin)';
                            adminText += `│ ${index + 1}. @${admin.id.split('@')[0]} ${adminType}\n`;
                        });
                        adminText += '└─────────────────────┘';
                        
                        await sock.sendMessage(jid, { 
                            text: adminText,
                            mentions: admins.map(a => a.id)
                        });
                    } catch (error) {
                        await sock.sendMessage(jid, { text: 'Gagal mendapatkan list admin.' });
                    }
                    break;

                case 'antilink':
                    if (!jid.endsWith('@g.us')) {
                        await sock.sendMessage(jid, { text: 'Command ini hanya bisa digunakan di grup!' });
                        break;
                    }
                    
                    // Cek apakah pengirim adalah admin
                    const senderAntilink = message.key.participant || message.key.remoteJid;
                    if (!await isAdmin(sock, jid, senderAntilink)) {
                        await sock.sendMessage(jid, { text: '❌ Hanya admin yang bisa menggunakan command ini!' });
                        break;
                    }
                    
                    if (args === 'on') {
                        const settings = getGroupSettings(jid);
                        settings.antilink = true;
                        groupSettings[jid] = settings;
                        saveGroupSettings();
                        await sock.sendMessage(jid, { text: '✅ Antilink diaktifkan di grup ini!' });
                    } else if (args === 'off') {
                        const settings = getGroupSettings(jid);
                        settings.antilink = false;
                        groupSettings[jid] = settings;
                        saveGroupSettings();
                        await sock.sendMessage(jid, { text: '✅ Antilink dimatikan di grup ini!' });
                    } else {
                        await sock.sendMessage(jid, { text: `Penggunaan: ${prefix}antilink [on/off]` });
                    }
                    break;

                case 'welcome':
                    if (!jid.endsWith('@g.us')) {
                        await sock.sendMessage(jid, { text: 'Command ini hanya bisa digunakan di grup!' });
                        break;
                    }
                    
                    // Cek apakah pengirim adalah admin
                    const senderWelcome = message.key.participant || message.key.remoteJid;
                    if (!await isAdmin(sock, jid, senderWelcome)) {
                        await sock.sendMessage(jid, { text: '❌ Hanya admin yang bisa menggunakan command ini!' });
                        break;
                    }
                    
                    if (args === 'on') {
                        const settings = getGroupSettings(jid);
                        settings.welcome = true;
                        groupSettings[jid] = settings;
                        saveGroupSettings();
                        await sock.sendMessage(jid, { text: '✅ Welcome message diaktifkan di grup ini!' });
                    } else if (args === 'off') {
                        const settings = getGroupSettings(jid);
                        settings.welcome = false;
                        groupSettings[jid] = settings;
                        saveGroupSettings();
                        await sock.sendMessage(jid, { text: '✅ Welcome message dimatikan di grup ini!' });
                    } else {
                        await sock.sendMessage(jid, { text: `Penggunaan: ${prefix}welcome [on/off]` });
                    }
                    break;

                case 'kick':
                    if (!jid.endsWith('@g.us')) {
                        await sock.sendMessage(jid, { text: 'Command ini hanya bisa digunakan di grup!' });
                        break;
                    }
                    
                    // Cek apakah pengirim adalah admin
                    const senderKick = message.key.participant || message.key.remoteJid;
                    if (!await isAdmin(sock, jid, senderKick)) {
                        await sock.sendMessage(jid, { text: '❌ Hanya admin yang bisa menggunakan command ini!' });
                        break;
                    }
                    
                    if (!message.message.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
                        await sock.sendMessage(jid, { text: `Tag member yang akan di-kick!\nContoh: ${prefix}kick @user` });
                        break;
                    }
                    
                    const mentionedJid = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
                    
                    // Cek apakah target adalah admin/bot owner
                    if (await isAdmin(sock, jid, mentionedJid) || mentionedJid === sock.user.id) {
                        await sock.sendMessage(jid, { text: '❌ Tidak bisa mengeluarkan admin atau bot!' });
                        break;
                    }
                    
                    try {
                        await sock.groupParticipantsUpdate(jid, [mentionedJid], 'remove');
                        await sock.sendMessage(jid, { 
                            text: `✅ Berhasil mengeluarkan @${mentionedJid.split('@')[0]} dari grup`, 
                            mentions: [mentionedJid] 
                        });
                    } catch (error) {
                        await sock.sendMessage(jid, { text: `❌ Gagal mengeluarkan member: ${error.message}` });
                    }
                    break;

                case 'promote':
                    if (!jid.endsWith('@g.us')) {
                        await sock.sendMessage(jid, { text: 'Command ini hanya bisa digunakan di grup!' });
                        break;
                    }
                    
                    // Cek apakah pengirim adalah admin
                    const senderPromote = message.key.participant || message.key.remoteJid;
                    if (!await isAdmin(sock, jid, senderPromote)) {
                        await sock.sendMessage(jid, { text: '❌ Hanya admin yang bisa menggunakan command ini!' });
                        break;
                    }
                    
                    if (!message.message.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
                        await sock.sendMessage(jid, { text: `Tag member yang akan di-promote!\nContoh: ${prefix}promote @user` });
                        break;
                    }
                    
                    const mentionedJidPromote = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
                    
                    // Cek apakah sudah admin
                    if (await isAdmin(sock, jid, mentionedJidPromote)) {
                        await sock.sendMessage(jid, { text: '❌ User sudah menjadi admin!' });
                        break;
                    }
                    
                    try {
                        await sock.groupParticipantsUpdate(jid, [mentionedJidPromote], 'promote');
                        await sock.sendMessage(jid, { 
                            text: `✅ Berhasil promote @${mentionedJidPromote.split('@')[0]} menjadi admin`, 
                            mentions: [mentionedJidPromote] 
                        });
                    } catch (error) {
                        await sock.sendMessage(jid, { text: `❌ Gagal promote member: ${error.message}` });
                    }
                    break;

                case 'demote':
                    if (!jid.endsWith('@g.us')) {
                        await sock.sendMessage(jid, { text: 'Command ini hanya bisa digunakan di grup!' });
                        break;
                    }
                    
                    // Cek apakah pengirim adalah admin
                    const senderDemote = message.key.participant || message.key.remoteJid;
                    if (!await isAdmin(sock, jid, senderDemote)) {
                        await sock.sendMessage(jid, { text: '❌ Hanya admin yang bisa menggunakan command ini!' });
                        break;
                    }
                    
                    if (!message.message.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
                        await sock.sendMessage(jid, { text: `Tag admin yang akan di-demote!\nContoh: ${prefix}demote @user` });
                        break;
                    }
                    
                    const mentionedJidDemote = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
                    
                    // Cek apakah target adalah owner
                    if (await isOwner(sock, jid, mentionedJidDemote)) {
                        await sock.sendMessage(jid, { text: '❌ Tidak bisa demote owner grup!' });
                        break;
                    }
                    
                    // Cek apakah target adalah admin
                    if (!await isAdmin(sock, jid, mentionedJidDemote)) {
                        await sock.sendMessage(jid, { text: '❌ User bukan admin!' });
                        break;
                    }
                    
                    try {
                        await sock.groupParticipantsUpdate(jid, [mentionedJidDemote], 'demote');
                        await sock.sendMessage(jid, { 
                            text: `✅ Berhasil demote @${mentionedJidDemote.split('@')[0]} dari admin`, 
                            mentions: [mentionedJidDemote] 
                        });
                    } catch (error) {
                        await sock.sendMessage(jid, { text: `❌ Gagal demote member: ${error.message}` });
                    }
                    break;
                // ========== END GROUP COMMANDS ==========

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
        
        // Load group settings
        loadGroupSettings();
        
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
    // Save group settings before exit
    saveGroupSettings();
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