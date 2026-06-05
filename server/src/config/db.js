import mongoose from 'mongoose';

async function dropLegacyRefreshTokenIndexes() {
  try {
    const collection = mongoose.connection.collection('refreshtokens');
    const indexes = await collection.indexes();
    const legacyIndex = indexes.find((index) => index.name === 'sessionId_1');
    if (legacyIndex) {
      await collection.dropIndex('sessionId_1');
      console.log('Dropped legacy refreshtokens.sessionId_1 index');
    }
  } catch (err) {
    if (err.codeName !== 'NamespaceNotFound') {
      console.warn('Could not clean legacy refresh token indexes:', err.message);
    }
  }
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined');
  }
  await mongoose.connect(uri);
  await dropLegacyRefreshTokenIndexes();
  console.log('MongoDB connected');
}
