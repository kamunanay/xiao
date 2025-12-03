# 🤖 XIS WhatsApp Bot

<div align="center">

![Banner](https://img.shields.io/badge/XIS_BOT-v3.5.0-blueviolet?style=for-the-badge&logo=whatsapp)
![Node](https://img.shields.io/badge/Node.js-18.x-green?style=for-the-badge&logo=node.js)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Online-success?style=for-the-badge)

<p align="center">
  <img src="https://raw.githubusercontent.com/whiskeysockets/baileys/master/logo.png" width="200" alt="Baileys" />
</p>

**WhatsApp Multi-Device Bot dengan fitur AI, media downloader, dan management grup lengkap**

</div>

## ✨ **Fitur Utama**

### 🚀 **Multi-Function Bot**
- ✅ **AI Assistant** - DeepSeek AI integration
- ✅ **Media Downloader** - TikTok, Spotify, Pinterest
- ✅ **Group Management** - Full admin tools
- ✅ **Utilities** - View once, block, fake iMessage
- ✅ **Auto Features** - Welcome, anti-link, auto reply

### 🛠️ **Tech Stack**
```bash
@whiskeysockets/baileys  # WhatsApp API
Node.js 18+              # Runtime
REST APIs                # External services
```

## 📦 **Instalasi Cepat**

```bash
# Clone repository
git clone https://github.com/username/xis-bot.git
cd xis-bot

# Install dependencies
npm install

# Configure bot
nano setting.js

# Run bot
npm start
```

## ⚙️ **Konfigurasi**

Edit `setting.js`:
```javascript
{
    prefix: '.',
    botName: 'XIS Bot',
    ownerNumber: '6281234567890' // Your number
}
```

## 📋 **Daftar Perintah**

### 🤖 **AI & Media**
| Command | Description |
|---------|-------------|
| `.deepseek <text>` | Ask AI anything |
| `.tiktok <url>` | Download TikTok |
| `.spotify <query>` | Search music |

### 👥 **Group Management**
| Command | Description |
|---------|-------------|
| `.antilink on/off` | Enable/disable link protection |
| `.welcome on/off` | Welcome message |
| `.kick @user` | Remove member |
| `.promote @user` | Make admin |

### ⚡ **Utility**
| Command | Description |
|---------|-------------|
| `.menu` | Show all commands |
| `.ping` | Check latency |
| `.resetsender` | Reset bot |

## 🚀 **Quick Start**

1. **Install Node.js 18+**
2. **Clone repository**
3. **Edit setting.js**
4. **Run npm install**
5. **Start with npm start**
6. **Scan QR Code**

## 🔧 **Maintenance**

```bash
# Reset sessions
npm run reset

# Clean install
npm run clean

# Fix issues
npm run repair
```

## 📊 **Stats Example**

```javascript
// Bot Performance
Memory Usage:  ▰▰▰▰▱ 78%
Uptime:        24/7
Session:       30 days
Features:      25+ commands
```

## 🎯 **Use Cases**

- **Personal Assistant** - AI chat, media download
- **Group Moderation** - Auto management
- **Entertainment** - Games, fun commands
- **Utilities** - Info lookup, tools

## 🤝 **Support**

### **Common Issues**
1. QR not showing → `npm install qrcode-terminal`
2. Connection failed → Check internet
3. Commands not working → Check prefix

### **Need Help?**
- Check `setting.js` configuration
- Ensure stable internet
- Verify Node.js version

## 📄 **License**

MIT License - Free to use and modify

---

<div align="center">

**Created with ❤️ by 小舞 Ga**

```javascript
console.log('🚀 Bot is ready!');
```

</div>

## 🏷️ **Tags**

```
#whatsapp-bot #baileys #nodejs #automation 
#chatbot #ai #media-downloader #group-management
```

---

<div align="center">

**⭐ Star this repo if you find it useful!**

</div>
