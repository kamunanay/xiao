// Gunakan colors sebagai pengganti chalk
const colors = require('colors');

console.log(`
╔══════════════════════════════╗
║         XIS CORE SYSTEMS     ║
║      WhatsApp Bot MD         ║
║         v2025.1.0            ║
╚══════════════════════════════╝`.red);

// Import dan start bot
const { initialize } = require('./xiao.js');

console.log('🚀 Starting XIS CORE SYSTEMS Bot...'.yellow);

// Start bot
initialize().catch(error => {
    console.log('❌ Bot startup error:'.red, error);
    process.exit(1);
});

// Handle process events
process.on('uncaughtException', (error) => {
    console.log('[UNCAUGHT EXCEPTION]'.red, error);
});

process.on('unhandledRejection', (error) => {
    console.log('[UNHANDLED REJECTION]'.red, error);
});

process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down XIS CORE SYSTEMS...'.yellow);
    process.exit(0);
});