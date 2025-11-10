const { initialize } = require('./xiao.js');
const chalk = require('chalk');

console.log(chalk.red(`
╔══════════════════════════════╗
║         XIS CORE SYSTEMS     ║
║      WhatsApp Bot MD         ║
║         v2025.1.0            ║
╚══════════════════════════════╝`));

// Start the bot
initialize().catch(console.error);

// Handle process events
process.on('uncaughtException', (err) => {
    console.log(chalk.red('[UNCAUGHT EXCEPTION]'), err);
});

process.on('unhandledRejection', (err) => {
    console.log(chalk.red('[UNHANDLED REJECTION]'), err);
});

process.on('SIGINT', () => {
    console.log(chalk.yellow(`\nShutting down XIS CORE SYSTEMS...`));
    process.exit(0);
});
