const { 
    default: makeWASocket, 
    useMultiFileAuthState,
    delay,
    DisconnectReason,
    fetchLatestBaileysVersion
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

// === BANNER ===
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
        return null;
    }
}

// === TIKTOK DOWNLOADER YANG WORK ===
async function downloadTiktok(url) {
    try {
        console.log(`📥 Download TikTok: ${url}`);
        
        const encodedParams = new URLSearchParams();
        encodedParams.set('url', url);
        encodedParams.set('hd', '1');

        const response = await axios({
            method: 'POST',
            url: 'https://tikwm.com/api/',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Cookie': 'current_language=en',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36'
            },
            data: encodedParams,
            timeout: 30000
        });

        const videos = response.data.data;
        
        if (!videos || !videos.play) {
            throw new Error('Video tidak ditemukan');
        }

        const result = {
            title: videos.title || 'TikTok Video',
            cover: videos.cover,
            origin_cover: videos.origin_cover,
            no_watermark: videos.play,
            watermark: videos.wmplay,
            music: videos.music
        };

        console.log('✅ TikTok data berhasil diambil');
        return result;
        
    } catch (error) {
        console.log('❌ TikTok download error:', error.message);
        throw new Error('Gagal mengunduh video TikTok: ' + error.message);
    }
}

// === CECAN FUNCTION DENGAN API YANG WORK ===
async function getCecanImage(query) {
    try {
        console.log(`📸 Mengambil gambar cecan: ${query}`);
        
        // API yang work dari siputzx.my.id
        const apiUrls = {
            "indonesia": "https://api.siputzx.my.id/api/r/cecan/indonesia",
            "china": "https://api.siputzx.my.id/api/r/cecan/china",
            "thailand": "https://api.siputzx.my.id/api/r/cecan/thailand", 
            "vietnam": "https://api.siputzx.my.id/api/r/cecan/vietnam",
            "malaysia": "https://api.siputzx.my.id/api/r/cecan/malaysia",
            "japan": "https://api.siputzx.my.id/api/r/cecan/japan",
            "korea": "https://api.siputzx.my.id/api/r/cecan/korea"
        };

        const url = apiUrls[query] || apiUrls["indonesia"];
        
        if (!url) {
            throw new Error('Query tidak valid');
        }

        console.log(`🔄 Menggunakan API: ${url}`);
        
        const response = await axios.get(url, { 
            responseType: 'arraybuffer',
            timeout: 20000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (response.data && response.data.length > 5000) {
            console.log('✅ Gambar cecan berhasil diambil');
            return Buffer.from(response.data);
        } else {
            throw new Error('Gambar tidak valid');
        }
        
    } catch (error) {
        console.log('❌ Cecan image error:', error.message);
        return null;
    }
}

// === REMOVE BG FUNCTION ===
async function removeBackground(imageUrl) {
    try {
        console.log(`🎨 Remove background: ${imageUrl}`);
        
        const encodedImageUrl = encodeURIComponent(imageUrl);
        const apiUrl = `https://api.siputzx.my.id/api/iloveimg/removebg?image=${encodedImageUrl}`;
        
        const response = await axios.get(apiUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        // Jika response berupa JSON error
        if (response.data.length < 1000) {
            const errorText = Buffer.from(response.data).toString();
            try {
                const errorData = JSON.parse(errorText);
                if (!errorData.status) {
                    throw new Error(errorData.error || 'Remove BG failed');
                }
            } catch (e) {
                // Jika bukan JSON, lanjutkan
            }
        }

        console.log('✅ Remove background berhasil');
        return Buffer.from(response.data);
        
    } catch (error) {
        console.log('❌ Remove BG error:', error.message);
        throw new Error('Gagal remove background: ' + error.message);
    }
}

// === BRAT FUNCTION ===
async function getBratImage(text) {
    try {
        console.log(`🎨 Membuat gambar brat: ${text}`);
        
        // Multiple API endpoints
        const apiEndpoints = [
            `https://api.botcahx.eu.org/api/maker/brat?text=${encodeURIComponent(text)}&apikey=moire`,
            `https://api.botcahx.live/api/maker/brat?text=${encodeURIComponent(text)}&apikey=free`,
            `https://brat.siputzx.my.id/api/maker/brat?text=${encodeURIComponent(text)}`
        ];
        
        let imageBuffer = null;
        
        for (const endpoint of apiEndpoints) {
            try {
                const response = await axios.get(endpoint, { 
                    responseType: 'arraybuffer', 
                    timeout: 15000 
                });
                
                if (response.data && response.data.length > 1000) {
                    imageBuffer = Buffer.from(response.data);
                    console.log('✅ API brat berhasil');
                    break;
                }
            } catch (apiError) {
                console.log(`❌ API brat gagal: ${endpoint.split('/')[2]}`);
                continue;
            }
        }
        
        if (!imageBuffer) {
            throw new Error('Semua API brat gagal');
        }
        
        return imageBuffer;
        
    } catch (error) {
        console.log('❌ Brat image error:', error.message);
        return null;
    }
}

// === WHATSAPP CONNECTION ===
async function connectToWhatsApp() {
    try {
        console.log('📡 Initializing WhatsApp connection...');
        
        const { state, saveCreds } = await useMultiFileAuthState(sessionsDir);
        
        // Fetch latest version for better compatibility
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`📦 Using WA version: ${version.join('.')} (latest: ${isLatest})`);

        const newSock = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: ['Ubuntu', 'Chrome', '120.0.0.0'],
            syncFullHistory: false,
            markOnlineOnConnect: false,
            generateHighQualityLinkPreview: true,
            emitOwnEvents: false,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 30000,
            keepAliveIntervalMs: 10000,
        });

        newSock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            console.log(`🔗 Connection update: ${connection}`);

            // Tampilkan QR code dengan jelas
            if (qr) {
                console.log('\n' + '='.repeat(50));
                console.log('📱 SCAN QR CODE BERIKUT:');
                console.log('='.repeat(50));
                qrcode.generate(qr, { small: true });
                console.log('='.repeat(50));
                console.log('CARA SCAN:');
                console.log('1. Buka WhatsApp di HP');
                console.log('2. Tap 3 titik → Linked Devices → Link a Device');
                console.log('3. Scan QR code di atas');
                console.log('='.repeat(50) + '\n');
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
                
                // Kirim pesan ke owner
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
                
                // Jangan reconnect jika logged out
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('🚫 Session expired, hapus folder sessions dan scan ulang QR');
                    if (fs.existsSync(sessionsDir)) {
                        fs.rmSync(sessionsDir, { recursive: true, force: true });
                        console.log('🗑️ Session lama sudah dihapus');
                    }
                    console.log('🔄 Restarting bot...');
                    await delay(3000);
                    initialize();
                    return;
                }

                if (reconnectAttempts < maxReconnectAttempts) {
                    reconnectAttempts++;
                    const waitTime = Math.min(3000 * Math.pow(1.5, reconnectAttempts - 1), 45000);
                    
                    console.log(`🔄 Mencoba reconnect... (${reconnectAttempts}/${maxReconnectAttempts})`);
                    console.log(`⏳ Menunggu ${Math.round(waitTime/1000)} detik...`);
                    
                    await delay(waitTime);
                    connectToWhatsApp();
                } else {
                    console.log('💥 Gagal reconnect setelah beberapa percobaan');
                    console.log('🔄 Silakan restart bot manual');
                    process.exit(1);
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
        
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const waitTime = Math.min(5000 * reconnectAttempts, 30000);
            
            console.log(`🔄 Retrying connection setup... (${reconnectAttempts}/${maxReconnectAttempts})`);
            await delay(waitTime);
            return connectToWhatsApp();
        } else {
            console.log('💥 Max connection setup attempts reached');
            console.log('🔄 Restarting bot in 10 seconds...');
            await delay(10000);
            process.exit(1);
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

┌─≻∘ 𝐌𝐄𝐃𝐈𝐀 𝐒𝐘𝐒𝐓𝐄𝐌 ∘≺─┐
│ ➣ Media Commands
│   ╰─ .cecan <query>
│   ╰─ .brat <teks>
│   ╰─ .tiktok <url>
│   ╰─ .removebg <url>
└─────────────────────┘

┌─≻∘ 𝐔𝐓𝐈𝐋𝐈𝐓𝐘 𝐒𝐘𝐒𝐓𝐄𝐌 ∘≺─┐
│ ➣ Utility Commands
│   ╰─ .b (view once)
│   ╰─ .iqc (fake iMessage)
│   ╰─ .menu
│   ╰─ .ping
│   ╰─ .info
│   ╰─ .owner
└─────────────────────┘

┌─≻∘ 𝐐𝐔𝐄𝐑𝐘 𝐑𝐄𝐅𝐄𝐑𝐄𝐍𝐂𝐄 ∘≺─┐
│ ➣ Available Queries
│   ╰─ indonesia, china
│   ╰─ thailand, vietnam
│   ╰─ malaysia, japan
│   ╰─ korea
└─────────────────────┘

◉ Status: Active
◉ Memory: ▰▰▰▰▱ 78%
◉ Session: 30 days remaining
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
                        text: `*${botName}*\n\nWhatsApp Bot Multi-Device\nVersion: 2025.1.0\nAuthor: 小舞 Ga\nPrefix: ${prefix}` 
                    });
                    break;

                case 'owner':
                    await sock.sendMessage(jid, { 
                        text: `Owner: ${ownerNumber}\nHubungi untuk bantuan atau order bot.` 
                    });
                    break;

                case 'cecan':
                    const query = args.toLowerCase() || 'indonesia';
                    const validQueries = ['indonesia', 'china', 'thailand', 'vietnam', 'malaysia', 'japan', 'korea'];
                    
                    if (!validQueries.includes(query)) {
                        await sock.sendMessage(jid, { 
                            text: `Query tidak valid!\n\nQuery yang tersedia:\n${validQueries.join(', ')}\n\nContoh: ${prefix}cecan japan` 
                        });
                        break;
                    }

                    try {
                        await sock.sendMessage(jid, { text: `Mengambil gambar cecan ${query}...` });
                        
                        const cecanImage = await getCecanImage(query);
                        if (cecanImage) {
                            await sock.sendMessage(jid, { 
                                image: cecanImage,
                                caption: `Cecan ${query} - ${botName}`
                            });
                        } else {
                            await sock.sendMessage(jid, { text: 'Gagal mengambil gambar cecan. Coba lagi nanti.' });
                        }
                    } catch (error) {
                        await sock.sendMessage(jid, { text: 'Error saat mengambil gambar cecan.' });
                    }
                    break;

                case 'brat':
                    if (!args) {
                        await sock.sendMessage(jid, { text: `Format: ${prefix}brat <teks>\nContoh: ${prefix}brat Hello World` });
                        break;
                    }
                    
                    try {
                        await sock.sendMessage(jid, { text: 'Membuat gambar...' });
                        const bratImage = await getBratImage(args);
                        
                        if (bratImage) {
                            await sock.sendMessage(jid, { 
                                image: bratImage,
                                caption: `${args} - ${botName}`
                            });
                        } else {
                            await sock.sendMessage(jid, { text: 'Gagal membuat gambar brat' });
                        }
                    } catch (error) {
                        await sock.sendMessage(jid, { text: 'Error saat membuat gambar brat' });
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
                                    caption: `TikTok - ${botName}\nJudul: ${data.title}\nAuthor: ${data.music?.author || 'Tidak diketahui'}`
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

                case 'removebg':
                case 'nobg':
                    try {
                        // Cek jika ada quoted image
                        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                        let imageUrl = args;

                        if (quoted?.imageMessage) {
                            await sock.sendMessage(jid, { text: 'Mendownload gambar...' });
                            const imageBuffer = await downloadMedia(sock, { 
                                message: { imageMessage: quoted.imageMessage } 
                            });
                            
                            if (!imageBuffer) {
                                await sock.sendMessage(jid, { text: 'Gagal mendownload gambar' });
                                break;
                            }

                            // Upload gambar ke temp service untuk dapat URL
                            await sock.sendMessage(jid, { text: 'Mengupload gambar...' });
                            
                            // Simpan gambar sementara
                            const tempPath = `./temp_${Date.now()}.jpg`;
                            fs.writeFileSync(tempPath, imageBuffer);
                            
                            // Untuk simplicity, kita akan menggunakan gambar langsung dari buffer
                            // Tapi karena API removebg butuh URL, kita skip dulu fitur quoted
                            await sock.sendMessage(jid, { text: 'Fitur quoted image untuk removebg sedang dalam pengembangan. Gunakan URL gambar langsung.' });
                            fs.unlinkSync(tempPath);
                            break;
                        }

                        if (!imageUrl) {
                            await sock.sendMessage(jid, { text: `Format: ${prefix}removebg <url_gambar>\nContoh: ${prefix}removebg https://example.com/image.jpg` });
                            break;
                        }

                        await sock.sendMessage(jid, { text: 'Menghapus background...' });
                        
                        const noBgImage = await removeBackground(imageUrl);
                        if (noBgImage) {
                            await sock.sendMessage(jid, { 
                                image: noBgImage,
                                caption: 'Background removed'
                            });
                        } else {
                            await sock.sendMessage(jid, { text: 'Gagal menghapus background' });
                        }

                    } catch (error) {
                        console.log('RemoveBG error:', error.message);
                        await sock.sendMessage(jid, { text: `Gagal menghapus background: ${error.message}` });
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
        console.log('🔄 Restarting in 10 seconds...');
        await delay(10000);
        initialize();
    }
}

module.exports = {
    initialize,
    messageHandler
};