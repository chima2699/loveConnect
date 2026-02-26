// config/paths.js
const path = require('path');
const { ensureFile } = require('../utils/jsonDb');

const dataDir = path.join(__dirname, '..', 'data');

const usersFile        = path.join(dataDir, 'users.json');
const postsFile        = path.join(dataDir, 'posts.json');
const configFile       = path.join(dataDir, 'config.json');
const notificationsFile= path.join(dataDir, 'notifications.json');
const likesFile        = path.join(dataDir, 'likes.json');
const commentsFile     = path.join(dataDir, 'comments.json');
const followsFile      = path.join(dataDir, 'follows.json');
const transactionsFile = path.join(dataDir, 'transactions.json');
const withdrawalsFile  = path.join(dataDir, 'withdrawals.json');
const loginsFile       = path.join(dataDir, 'logins.json');
const messagesFile     = path.join(dataDir, 'messages.json');
const blockedFile      = path.join(dataDir, 'blocked.json');
const reportsFile      = path.join(dataDir, 'reports.json');

// Ensure exist
[
  usersFile,
  postsFile,
  configFile,
  notificationsFile,
  likesFile,
  commentsFile,
  followsFile,
  transactionsFile,
  withdrawalsFile,
  loginsFile,
  messagesFile,
  blockedFile,
  reportsFile
].forEach(f => ensureFile(f, []));

module.exports = {
  dataDir,
  usersFile,
  postsFile,
  configFile,
  notificationsFile,
  likesFile,
  commentsFile,
  followsFile,
  transactionsFile,
  withdrawalsFile,
  loginsFile,
  messagesFile,
  blockedFile,
  reportsFile
};
