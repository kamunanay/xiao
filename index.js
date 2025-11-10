console.log(`
╔══════════════════════════════╗
║         XIS CORE SYSTEMS     ║
║      WhatsApp Bot MD         ║
║         v2025.1.0            ║
╚══════════════════════════════╝`);

console.log('🚀 Starting XIS CORE SYSTEMS Bot...');

const { initialize } = require('./xiao.js');

// Simple error handling
process.on('uncaughtException', (error) => {
    console.log('❌ Uncaught Exception:', error.message);
});

process.on('unhandledRejection', (error) => {
    console.log('❌ Unhandled Rejection:', error.message);
});

process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    process.exit(0);
});

// Start bot
initialize().catch(error => {
    console.log('❌ Bot stopped:', error.message);
});
