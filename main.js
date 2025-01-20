require('dotenv').config();
const { Telegraf } = require('telegraf');
const { SocksProxyAgent } = require('socks-proxy-agent');
const db = require('./db'); // Import db module
const {Web3} = require('web3');

const web3 = new Web3(`https://sepolia.infura.io/v3/${process.env.INFURA_TOKEN}`);

const proxyUrl = 'socks5h://127.0.0.1:2080';
const agent = new SocksProxyAgent(proxyUrl);

// Function to get the balance from Infura by wallet address and update the database if needed
async function checkAndUpdateBalance(userId) {
  try {
    const walletAddress = await db.getWalletById(userId);
    if (!walletAddress) {
      console.error('Wallet address not found for user:', userId);
      return;
    }

    const balanceInWei = await web3.eth.getBalance(walletAddress);
    const balanceInEth = web3.utils.fromWei(balanceInWei, 'ether');

    const dbBalance = await db.getUserBalance(userId);

    if (parseFloat(balanceInEth) !== dbBalance) {
      await db.updateBalance(userId, parseFloat(balanceInEth));
      console.log(`Balance updated for user ${userId}: ${balanceInEth} ETH`);
    }
  } catch (error) {
    console.error('Error checking and updating balance:', error);
  }
}

//Generate Wallet : 
function generateWalletAddress() {
  const account = web3.eth.accounts.create();
  return account.address;
}

const bot = new Telegraf(process.env.BOT_TOKEN, {
  telegram: { agent },
});

// Event handlers and bot logic
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username || null;

  try {
    const userExists = await db.getUserById(userId);
    if (userExists) {
      ctx.reply('Welcome back! Your account is already set up.');
    } else {
      const walletaddress = generateWalletAddress();
      await db.addUser(userId, username, walletaddress);
      ctx.reply('Welcome! Your account has been set up.');
    }
  } catch (err) {
    console.error('Error checking or adding user:', err);
    ctx.reply('There was an error initializing your account.');
  }
});


// /balance command
bot.command('balance', async (ctx) => {
  const userId = ctx.from.id;
  checkAndUpdateBalance(userId)
  try {
    const balance = await db.getUserBalance(userId);
    await ctx.reply(`Your balance is: ${balance} ETH.`);
  } catch (error) {
    console.error('Error fetching balance:', error);
    await ctx.reply('An error occurred while fetching your balance.');
  }
});

// /tip command
bot.command('tip', async (ctx) => {
    const senderId = ctx.from.id;
    const senderUsername = ctx.from.username || 'Anonymous';  // Ensure senderUsername is defined
  
    const message = ctx.message.text.split(' '); // Command should be: /tip <username or userId> <amount>
  
    if (message.length < 3) {
      return ctx.reply('Usage: /tip <userId or username> <amount>');
    }
  
    const recipientIdentifier = message[1];  // username or userId
    const amount = parseFloat(message[2]);  // Tip amount
  
    if (isNaN(amount) || amount <= 0) {
      return ctx.reply('Please provide a valid amount.');
    }
  
    // Check if the recipient is a valid user (username or userId)
    let recipientId = null;
  
    // Check if recipientIdentifier is a valid number (userId)
    if (!isNaN(recipientIdentifier)) {
      recipientId = parseInt(recipientIdentifier);
    } else {
      // Check if recipient is a registered username
      try {
        const user = await db.getUserByUsername(recipientIdentifier);
        if (user) {
          recipientId = user.userId;
        } else {
          return ctx.reply(`The user with username @${recipientIdentifier} has not registered with the bot.`);
        }
      } catch (error) {
        return ctx.reply('An error occurred while checking the username.');
      }
    }
  
    if (!recipientId) {
      return ctx.reply('Recipient is not found or not registered.');
    }
  
    // Check sender balance
    const senderBalance = await db.getUserBalance(senderId);
    if (senderBalance < amount) {
      return ctx.reply('Insufficient balance to send the tip.');
    }
  
    // Deduct tip from sender
    const success = await db.updateBalance(senderId, -amount);
    if (!success) {
      return ctx.reply('Failed to process the tip. Please try again later.');
    }
  
    // Add tip to receiver
    const receiverSuccess = await db.updateBalance(recipientId, amount);
    if (!receiverSuccess) {
      return ctx.reply('Failed to process the receiver\'s balance. Please try again later.');
    }
  
    // Log the transaction
    await db.logTransaction(senderId, recipientId, amount);
  
    // Notify the sender
    ctx.reply(`Successfully sent ${amount} units to @${recipientIdentifier}.`);
  
    // Send notification to receiver
    const receiverUser = await db.getUserById(recipientId);
    if (receiverUser) {
      const notificationMessage = `You have received ${amount} units from @${senderUsername}.`;
      await bot.telegram.sendMessage(recipientId, notificationMessage);
    }
  });
  
  

  
// Deposit button command (sample wallet address)
bot.command('deposit', async (ctx) => {
  const senderId = ctx.from.id;
  const walletaddress = await db.getWalletById(senderId);
  
  if (walletaddress) {
  await ctx.reply(`To deposit, please send funds to this address: ${walletaddress}`);
  }
});


bot.launch()
  .then(() => console.log('Bot started with proxy support'))
  .catch((err) => console.error('Error launching bot:', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
